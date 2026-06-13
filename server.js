require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const Stripe = require("stripe");
const AIService = require("./ai-service");
const manager = require("./whatsapp-manager");
const db = require("./database");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const userManager = require("./user-manager");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 5000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PRICE_ID_BUSINESS = process.env.STRIPE_PRICE_ID_BUSINESS || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const OWNER_ADMIN_EMAIL = "n33sh07@gmail.com";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// ─── ADMIN CONFIG ──────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";
const JWT_EXPIRY = "24h";

app.use(cors());

function ensureStripeConfigured() {
  if (!stripe || !STRIPE_PRICE_ID_BUSINESS) {
    throw new Error("Stripe billing is not configured. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID_BUSINESS to .env.");
  }
}

function getStripeCustomerId(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

function getStripePriceId(subscription) {
  return subscription?.items?.data?.[0]?.price?.id || null;
}

function toPeriodEndMs(unixSeconds) {
  return unixSeconds ? unixSeconds * 1000 : null;
}

async function syncSubscriptionFromStripe(subscription) {
  const customerId = getStripeCustomerId(subscription.customer);
  if (!customerId) return;

  userManager.upsertStripeBilling(
    { customerId, subscriptionId: subscription.id },
    {
      customerId,
      subscriptionId: subscription.id,
      priceId: getStripePriceId(subscription),
      subscriptionStatus: subscription.status,
      currentPeriodEnd: toPeriodEndMs(subscription.current_period_end),
      planId: "business"
    }
  );
}

async function handleStripeWebhookEvent(event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      userManager.upsertStripeBilling(
        {
          userId: session.client_reference_id,
          email: session.customer_details?.email,
          customerId: getStripeCustomerId(session.customer)
        },
        {
          customerId: getStripeCustomerId(session.customer),
          subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
          priceId: STRIPE_PRICE_ID_BUSINESS,
          subscriptionStatus: session.payment_status === "paid" ? "active" : "trialing",
          planId: "business"
        }
      );
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscriptionFromStripe(event.data.object);
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      userManager.upsertStripeBilling(
        {
          customerId: getStripeCustomerId(invoice.customer),
          subscriptionId: typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id || null
        },
        {
          customerId: getStripeCustomerId(invoice.customer),
          subscriptionId: typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id || null,
          subscriptionStatus: "active",
          currentPeriodEnd: toPeriodEndMs(invoice.lines?.data?.[0]?.period?.end)
        }
      );
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      userManager.upsertStripeBilling(
        {
          customerId: getStripeCustomerId(invoice.customer),
          subscriptionId: typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id || null
        },
        {
          customerId: getStripeCustomerId(invoice.customer),
          subscriptionId: typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id || null,
          subscriptionStatus: "past_due"
        }
      );
      break;
    }
    default:
      break;
  }
}

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send("Stripe webhook is not configured.");
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing Stripe signature.");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await handleStripeWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error("[Stripe] Webhook handler failed:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use(express.json());

// Serve React frontend in production
const FRONTEND_DIST = path.join(__dirname, "frontend", "dist");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
}

// ─── API ROUTES ───────────────────────────────────────────────

function issueUserToken(user) {
  return jwt.sign(
    { userId: user.userId, email: user.email },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function userAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  try {
    const token = header.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const status = userManager.getUserStatus(payload.userId);
    req.user = payload;
    req.userStatus = status;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired session. Please sign in again." });
  }
}

function requireSelfOrOwner(req, res, next) {
  const { userId } = req.params;
  if (!req.userStatus) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
  if (req.userStatus.userId === userId || isOwnerAdminEmail(req.userStatus.email)) {
    return next();
  }
  return res.status(403).json({ success: false, message: "Access denied." });
}

function requireClientAccess(req, res, next) {
  const clientId = req.params.clientId || req.body?.clientId;
  if (!req.userStatus) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
  if (isOwnerAdminEmail(req.userStatus.email)) return next();
  const allowed = Array.isArray(req.userStatus.clientIds) ? req.userStatus.clientIds : [];
  if (clientId && allowed.includes(clientId)) return next();
  return res.status(403).json({ success: false, message: "This bot does not belong to your account." });
}

// Middleware to check if user has paid or is in a valid free trial
function checkTrialOrPaid(req, res, next) {
  try {
    const status = req.userStatus;
    if (!status) {
      return res.status(401).json({ success: false, message: "Authentication required. Please sign in." });
    }
    if (!status.hasAccess && status.trialExpired) {
      return res.status(402).json({ success: false, message: "Your free trial has expired. Start your Stripe subscription to keep your bots running.", trialExpired: true });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid session. Please sign in again." });
  }
}

function isOwnerAdminEmail(email = "") {
  return email.toLowerCase().trim() === OWNER_ADMIN_EMAIL;
}

function buildDemoSystemPrompt(lang = "en") {
  if (lang === "ms") {
    return [
      "Anda ialah UrbanBrew Assistant untuk demo laman web Whatsnyq.",
      "Jawab dalam Bahasa Melayu yang natural, mesra, dan ringkas.",
      "Fokus kepada harga, pakej, tempahan, menu, waktu operasi, dan pertanyaan umum pelanggan kafe.",
      "Jangan kata anda AI model atau sebut OpenRouter.",
      "Pastikan jawapan pendek, sekitar 1 hingga 3 ayat.",
      "Jika pengguna mahu bercakap dengan manusia atau staf, nyatakan bahawa anda akan serahkan kepada staf dan akhiri dengan teks tepat ini: [HANDOVER Triggered]."
    ].join(" ");
  }

  return [
    "You are UrbanBrew Assistant for the Whatsnyq website demo.",
    "Reply in natural, friendly, concise English.",
    "Focus on cafe pricing, packages, bookings, menu questions, opening hours, and customer enquiries.",
    "Do not mention that you are an AI model or mention OpenRouter.",
    "Keep responses short, around 1 to 3 sentences.",
    "If the user wants a human or staff member, say that you will hand over to the team and end with this exact text: [HANDOVER Triggered]."
  ].join(" ");
}

async function requestOpenRouterDemoReply({ lang = "en", message, history = [] }) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OpenRouter is not configured. Add OPENROUTER_API_KEY to .env.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const messages = [
      { role: "system", content: buildDemoSystemPrompt(lang) },
      ...history
        .filter((item) => item && typeof item.text === "string" && item.text.trim())
        .slice(-6)
        .map((item) => ({
          role: item.sender === "user" ? "user" : "assistant",
          content: item.text.trim()
        })),
      { role: "user", content: message.trim() }
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": APP_BASE_URL,
        "X-Title": "Whatsnyq Demo Chat"
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 180
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || "OpenRouter request failed.");
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error("OpenRouter returned an empty reply.");
    }

    return reply;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── AUTHENTICATION ENDPOINTS ───

// Sign Up
app.post("/api/auth/signup", (req, res) => {
  const { email, password } = req.body;
  try {
    const user = userManager.signUp(email, password, 'email');
    const token = issueUserToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Login
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  try {
    const user = userManager.login(email, password);
    const token = issueUserToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get("/api/auth/google/config", (_req, res) => {
  res.json({
    success: true,
    enabled: Boolean(GOOGLE_CLIENT_ID),
    clientId: GOOGLE_CLIENT_ID || null
  });
});

app.post("/api/demo/chat", async (req, res) => {
  const { message = "", history = [], lang = "en" } = req.body || {};
  const trimmedMessage = typeof message === "string" ? message.trim() : "";

  if (!trimmedMessage) {
    return res.status(400).json({ success: false, message: "Message is required." });
  }

  try {
    const reply = await requestOpenRouterDemoReply({
      lang: lang === "ms" ? "ms" : "en",
      message: trimmedMessage,
      history: Array.isArray(history) ? history : []
    });

    res.json({
      success: true,
      reply,
      model: OPENROUTER_MODEL
    });
  } catch (err) {
    console.error("[Demo Chat] OpenRouter request failed:", err.message);
    res.status(500).json({
      success: false,
      message: err.message || "Could not get a demo reply right now."
    });
  }
});

async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new Error("Google credential is required.");
  }
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google Sign-In is not configured on the server.");
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );

  if (!response.ok) {
    throw new Error("Google could not verify this sign-in token.");
  }

  const payload = await response.json();
  const issuer = payload.iss;
  const isValidIssuer =
    issuer === "accounts.google.com" || issuer === "https://accounts.google.com";

  if (payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error("Google Sign-In client ID does not match this app.");
  }
  if (payload.email_verified !== "true") {
    throw new Error("Google account email is not verified.");
  }
  if (!isValidIssuer) {
    throw new Error("Google token issuer is not valid.");
  }

  return payload;
}

app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body;

  try {
    const payload = await verifyGoogleIdToken(credential);
    const user = userManager.oauthLogin(payload.email, "google");
    const token = issueUserToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// OAuth (Google / Facebook)
app.post("/api/auth/oauth", (req, res) => {
  res.status(410).json({ success: false, message: "This endpoint is disabled. Use Google Sign-In or email/password login." });
});

// Get User Trial Status
app.get("/api/users/:userId/status", userAuth, requireSelfOrOwner, (req, res) => {
  const { userId } = req.params;
  try {
    const status = userManager.getUserStatus(userId);
    res.json({ success: true, status });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

app.post("/api/billing/checkout-session", userAuth, async (req, res) => {
  const userId = req.userStatus.userId;
  const { planId = "business" } = req.body || {};

  if (planId !== "business") {
    return res.status(400).json({ success: false, message: "Custom plans are handled manually. Please contact sales." });
  }

  try {
    ensureStripeConfigured();
    const user = userManager.getUserStatus(userId);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: userId,
      customer: user.stripeCustomerId || undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      line_items: [{ price: STRIPE_PRICE_ID_BUSINESS, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId, planId: "business" }
      },
      metadata: { userId, planId: "business" },
      allow_promotion_codes: true,
      success_url: `${APP_BASE_URL}/?billing=success`,
      cancel_url: `${APP_BASE_URL}/?billing=cancelled`
    });

    if (session.customer) {
      userManager.upsertStripeBilling(
        { userId },
        { customerId: getStripeCustomerId(session.customer), planId: "business" }
      );
    }

    res.json({ success: true, url: session.url });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post("/api/billing/portal-session", userAuth, async (req, res) => {
  const userId = req.userStatus.userId;

  try {
    ensureStripeConfigured();
    const user = userManager.getUserStatus(userId);
    if (!user.stripeCustomerId) {
      return res.status(400).json({ success: false, message: "No Stripe customer was found for this account yet." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${APP_BASE_URL}/`
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Upgrade user to Paid (manual fallback)
app.post("/api/users/:userId/pay", adminAuth, (req, res) => {
  const { userId } = req.params;
  try {
    const user = userManager.markPaid(userId);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// List all registered clients
app.get("/api/clients", userAuth, (req, res) => {
  try {
    const allClients = manager.listClients();
    const allowedClientIds = isOwnerAdminEmail(req.userStatus.email)
      ? null
      : (Array.isArray(req.userStatus.clientIds) ? req.userStatus.clientIds : []);
    const clients = allowedClientIds ? allClients.filter((c) => allowedClientIds.includes(c.clientId)) : allClients;
    res.json({ success: true, clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get status for a specific client
app.get("/api/clients/:clientId/status", userAuth, requireClientAccess, (req, res) => {
  const { clientId } = req.params;
  const status = manager.getStatus(clientId);
  res.json({ success: true, ...status });
});

// Step 1: Onboard a client → Generate AI system prompt + save config
app.post("/api/clients/onboard", userAuth, checkTrialOrPaid, async (req, res) => {
  const { clientId, businessInfo } = req.body;

  if (!clientId || !businessInfo || !businessInfo.name) {
    return res.status(400).json({ success: false, message: "clientId and businessInfo.name are required." });
  }

  try {
    const existingClients = manager.listClients();
    const clientAlreadyExists = existingClients.some((client) => client.clientId === clientId);
    const botLimit = req.userStatus.plan?.botLimit;
    const bypassBotLimit = isOwnerAdminEmail(req.userStatus.email);
    const allowedClientIds = Array.isArray(req.userStatus.clientIds) ? req.userStatus.clientIds : [];
    const ownedExistingClients = bypassBotLimit
      ? existingClients
      : existingClients.filter((client) => allowedClientIds.includes(client.clientId));

    if (clientAlreadyExists && !bypassBotLimit && !allowedClientIds.includes(clientId)) {
      return res.status(403).json({ success: false, message: "This bot already exists and does not belong to your account." });
    }

    if (!bypassBotLimit && !clientAlreadyExists && typeof botLimit === "number" && ownedExistingClients.length >= botLimit) {
      return res.status(403).json({
        success: false,
        message: `Your ${req.userStatus.plan.name} plan allows ${botLimit} bot${botLimit === 1 ? "" : "s"}. Upgrade before adding another bot.`
      });
    }

    // Load or create config for this client
    let config = manager.loadConfig(clientId);

    // Use the AI service to generate a custom system prompt from raw business info
    const aiService = new AIService(config);
    console.log(`[Server] Generating system prompt for client: ${clientId}...`);
    const generatedPrompt = await aiService.generateSystemPrompt(businessInfo);
    console.log(`[Server] System prompt generated successfully for: ${clientId}`);

    // Update and save the config
    config.botName = `${businessInfo.name} AI Assistant`;
    config.systemPrompt = generatedPrompt;
    config.business.name = businessInfo.name;
    config.business.product = businessInfo.product || config.business.product;
    config.business.details = businessInfo.rawContext || config.business.details;
    config.business.pricePromo = businessInfo.pricePromo || config.business.pricePromo;
    config.business.priceRegular = businessInfo.priceRegular || config.business.priceRegular;

    manager.saveConfig(clientId, config);
    if (!clientAlreadyExists) {
      userManager.addClientToUser(req.userStatus.userId, clientId);
    }

    res.json({ success: true, generatedPrompt, config });
  } catch (err) {
    console.error(`[Server] Onboard error:`, err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Step 2: Connect the WhatsApp bot for a client (starts QR generation)
app.post("/api/clients/:clientId/connect", userAuth, requireClientAccess, checkTrialOrPaid, async (req, res) => {
  const { clientId } = req.params;
  try {
    await manager.startClient(clientId, io);
    res.json({ success: true, message: `Starting WhatsApp client for: ${clientId}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Disconnect a client
app.post("/api/clients/:clientId/disconnect", userAuth, requireClientAccess, async (req, res) => {
  const { clientId } = req.params;
  try {
    await manager.stopClient(clientId);
    res.json({ success: true, message: `Client ${clientId} stopped.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a client completely (wipes config and session data)
app.delete("/api/clients/:clientId", userAuth, requireClientAccess, async (req, res) => {
  const { clientId } = req.params;
  try {
    await manager.deleteClient(clientId);
    db.deleteClientHistory(clientId);
    userManager.removeClientFromAllUsers(clientId);
    res.json({ success: true, message: `Client ${clientId} completely deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get paused contacts for a client
app.get("/api/clients/:clientId/paused", userAuth, requireClientAccess, (req, res) => {
  const { clientId } = req.params;
  try {
    const paused = manager.getPausedContactsList(clientId);
    res.json({ success: true, paused });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Resume AI for a specific contact
app.post("/api/clients/:clientId/resume", userAuth, requireClientAccess, (req, res) => {
  const { clientId } = req.params;
  const { contactId } = req.body;
  try {
    manager.resumeContact(clientId, contactId, io);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Toggle auto reply on/off
app.post("/api/clients/:clientId/toggle", userAuth, requireClientAccess, checkTrialOrPaid, (req, res) => {
  const { clientId } = req.params;
  const { enabled } = req.body;
  try {
    const config = manager.toggleAutoReply(clientId, enabled);
    res.json({ success: true, enableAutoReply: config.chatSettings.enableAutoReply });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update prompt directly
app.post("/api/clients/:clientId/prompt", userAuth, requireClientAccess, checkTrialOrPaid, (req, res) => {
  const { clientId } = req.params;
  const { systemPrompt } = req.body;
  try {
    const config = manager.loadConfig(clientId);
    config.systemPrompt = systemPrompt;
    manager.saveConfig(clientId, config);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get a client's full config
app.get("/api/clients/:clientId/config", userAuth, requireClientAccess, (req, res) => {
  const { clientId } = req.params;
  try {
    const config = manager.loadConfig(clientId);
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update a client's full config
app.put("/api/clients/:clientId/config", userAuth, requireClientAccess, (req, res) => {
  const { clientId } = req.params;
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ success: false, message: "config object is required." });
  }
  try {
    manager.saveConfig(clientId, config);
    // Sync with running instance if active
    const instance = manager.instances?.[clientId];
    if (instance) {
      instance.config = config;
      instance.aiService.updateConfig(config);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ADMIN AUTH MIDDLEWARE ─────────────────────────────────────
function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided." });
  }
  try {
    const token = header.split(" ")[1];
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

// ─── ADMIN ROUTES ──────────────────────────────────────────────

// Login — returns JWT token
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ success: false, message: "Invalid credentials." });
  }
  const token = jwt.sign({ username, role: "admin" }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.json({ success: true, token, expiresIn: JWT_EXPIRY });
});

// Verify an existing token
app.get("/api/admin/verify", adminAuth, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// Admin overview stats
app.get("/api/admin/stats", adminAuth, (req, res) => {
  const clients = manager.listClients();
  const totalConversations = db.getTotalMessageCount();
  res.json({
    success: true,
    stats: {
      totalClients: clients.length,
      activeClients: clients.filter(c => c.status === "ready").length,
      totalMessages: clients.reduce((a, c) => a + (c.messageCount || 0), 0),
      totalConversations,
    }
  });
});

// List all clients with full details for admin
app.get("/api/admin/clients", adminAuth, (req, res) => {
  const clients = manager.listClients().map(c => ({
    ...c,
    dbMessages: db.getMessageCount(c.clientId),
    contacts: db.getContacts(c.clientId),
  }));
  res.json({ success: true, clients });
});

// Get all recent conversations (grouped by client+contact)
app.get("/api/admin/conversations", adminAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const search = req.query.search || "";
  const clientId = req.query.clientId || "";
  let result;
  if (search || clientId) {
    result = db.searchConversations(search, limit, clientId);
  } else {
    result = db.getAllConversations(limit);
  }
  res.json({ success: true, conversations: result, search, clientId });
});

// Get contacts for a specific client
app.get("/api/admin/conversations/:clientId", adminAuth, (req, res) => {
  const { clientId } = req.params;
  const contacts = db.getContacts(clientId);
  res.json({ success: true, clientId, contacts });
});

// Get full conversation thread with a specific contact
app.get("/api/admin/conversations/:clientId/:contactId", adminAuth, (req, res) => {
  const { clientId, contactId } = req.params;
  const messages = db.getHistory(clientId, contactId, 500);
  res.json({ success: true, clientId, contactId, messages });
});

// Delete all conversation history for a client
app.delete("/api/admin/conversations/:clientId", adminAuth, (req, res) => {
  const { clientId } = req.params;
  db.deleteClientHistory(clientId);
  res.json({ success: true, message: `Deleted all conversations for ${clientId}` });
});

// Delete conversation for a specific contact
app.delete("/api/admin/conversations/:clientId/:contactId", adminAuth, (req, res) => {
  const { clientId, contactId } = req.params;
  db.resetHistory(clientId, contactId);
  res.json({ success: true, message: `Deleted conversation with ${contactId}` });
});

// Fallback: serve the React app for all other routes (SPA support)
app.use((req, res) => {
  const indexPath = path.join(FRONTEND_DIST, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: "WhatsApp AI Bot Server is running. Frontend not built yet." });
  }
});

// ─── SOCKET.IO ───────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ─── START SERVER ──────────────────────────────────────────────
// Initialize database before accepting connections
(async () => {
  try {
    await db.init();
    server.listen(PORT, () => {
      console.log("=========================================");
      console.log(`🚀 WhatsApp AI Bot Server running!`);
      console.log(`📡 API: http://localhost:${PORT}/api`);
      console.log(`🌐 Dashboard: http://localhost:${PORT}`);
      console.log("=========================================");
    });
  } catch (err) {
    console.error("[Server] Failed to initialize database:", err.message);
    process.exit(1);
  }
})();

// Graceful shutdown — close DB connection on exit
process.on("SIGINT", () => {
  console.log("\n[Server] Shutting down...");
  db.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("\n[Server] Shutting down...");
  db.close();
  process.exit(0);
});
