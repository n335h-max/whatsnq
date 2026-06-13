require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const AIService = require("./ai-service");
const { sendTelegram, formatLeadMessage } = require("./telegram-notifier");

// Holds all active WhatsApp client instances: { [clientId]: { client, aiService, status, messageCount, startTime } }
const instances = {};

const CONFIG_DIR = __dirname;
const TEMPLATE_CONFIG_PATH = path.join(CONFIG_DIR, "config.template.json");

function getConfigPath(clientId) {
  return clientId === "default"
    ? path.join(CONFIG_DIR, "config.json")
    : path.join(CONFIG_DIR, `config-${clientId}.json`);
}

function getTemplateConfigPath() {
  const legacyTemplatePath = path.join(CONFIG_DIR, "config.json");
  return fs.existsSync(TEMPLATE_CONFIG_PATH) ? TEMPLATE_CONFIG_PATH : legacyTemplatePath;
}

function loadConfig(clientId) {
  const configPath = getConfigPath(clientId);
  if (!fs.existsSync(configPath)) {
    const defaultPath = getTemplateConfigPath();
    if (fs.existsSync(defaultPath)) {
      fs.copyFileSync(defaultPath, configPath);
      console.log(`[Manager] Created config-${clientId}.json from template.`);
    } else {
      throw new Error(`Config template not found.`);
    }
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.chatSettings = {
    enableAutoReply: true,
    respondToGroups: false,
    showTypingIndicator: true,
    minDelayMs: 2000,
    maxDelayMs: 5000,
    maxHistoryLength: 10,
    ...(config.chatSettings || {})
  };
  return config;
}

function saveConfig(clientId, config) {
  const configPath = getConfigPath(clientId);
  config.chatSettings = {
    enableAutoReply: true,
    respondToGroups: false,
    showTypingIndicator: true,
    minDelayMs: 2000,
    maxDelayMs: 5000,
    maxHistoryLength: 10,
    ...(config.chatSettings || {})
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

function listClients() {
  const result = [];
  const files = fs.readdirSync(CONFIG_DIR).filter(f => f === "config.json" || f.match(/^config-.+\.json$/));
  for (const file of files) {
    const rawId = file === "config.json" ? "default" : file.replace("config-", "").replace(".json", "");
    const instance = instances[rawId];
    result.push({
      clientId: rawId,
      status: instance ? instance.status : "stopped",
      messageCount: instance ? instance.messageCount : 0,
      uptime: instance ? Math.floor((Date.now() - instance.startTime) / 1000) : 0,
    });
  }
  return result;
}

function getExecutablePath() {
  const paths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "C:\\Users\\User\\AppData\\Local", "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

function clearSessionLocks(clientId) {
  const sessionFolderName = clientId === "default" ? "session" : `session-${clientId}`;
  const sessionDir = path.join(__dirname, ".wwebjs_auth", sessionFolderName);
  if (!fs.existsSync(sessionDir)) return;

  const lockFiles = [
    path.join(sessionDir, "lockfile"),
    path.join(sessionDir, "SingletonLock"),
    path.join(sessionDir, "Default", "SingletonLock"),
  ];

  for (const f of lockFiles) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
        console.log(`[Manager:${clientId}] Removed stale lockfile: ${f}`);
      } catch (err) {
        console.warn(`[Manager:${clientId}] Failed to remove stale lockfile ${f}:`, err.message);
      }
    }
  }
}

async function startClient(clientId, io) {
  if (instances[clientId]) {
    const existing = instances[clientId];
    if (existing.status === "ready" || existing.status === "qr") {
      console.log(`[Manager] Client ${clientId} already running.`);
      return;
    }
    if (existing.reconnectTimeout) {
      clearTimeout(existing.reconnectTimeout);
      existing.reconnectTimeout = null;
    }
    // Clean up any stale browser before creating a new one
    try {
      await existing.client.destroy();
    } catch (_) {}
    delete instances[clientId];
  }

  // Clear stale session lock files to prevent "The browser is already running" crashes
  clearSessionLocks(clientId);

  let config;
  try {
    config = loadConfig(clientId);
  } catch (err) {
    io.emit(`client:${clientId}:error`, { message: err.message });
    return;
  }

  const aiService = new AIService(config, clientId);
  const sysBrowserPath = getExecutablePath();
  if (sysBrowserPath) {
    console.log(`[Manager:${clientId}] Launching system browser: ${sysBrowserPath}`);
  } else {
    console.log(`[Manager:${clientId}] Launching default bundled Chromium.`);
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId }),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    puppeteer: {
      headless: true,
      executablePath: sysBrowserPath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas", "--no-first-run", "--no-zygote", "--disable-gpu"],
      timeout: 60000,
      protocolTimeout: 60000
    }
  });

  // pausedContacts: { [contactId]: { reason: 'human'|'handover', pausedAt: timestamp, cooldownMs: number|null } }
  instances[clientId] = {
    client,
    aiService,
    status: "initializing",
    messageCount: 0,
    startTime: Date.now(),
    config,
    pausedContacts: {},
    io, // Store socket.io instance reference
  };

  client.on("qr", async (qr) => {
    console.log(`[Manager:${clientId}] QR Code generated.`);
    if (!instances[clientId]) {
      console.warn(`[Manager:${clientId}] QR event received but instance was already deleted.`);
      return;
    }
    instances[clientId].status = "qr";
    try {
      // Convert qr string to a data URL for the web browser
      const qrDataUrl = await qrcode.toDataURL(qr);
      instances[clientId].qrDataUrl = qrDataUrl;
      io.emit(`client:${clientId}:qr`, { qr: qrDataUrl });
      io.emit(`client:${clientId}:status`, { status: "qr" });
    } catch (err) {
      console.error(`[Manager:${clientId}] QR generation error:`, err.message);
    }
  });

  client.on("authenticated", () => {
    console.log(`[Manager:${clientId}] Authenticated.`);
    if (!instances[clientId]) return;
    instances[clientId].status = "authenticated";
    instances[clientId].qrDataUrl = null;
    io.emit(`client:${clientId}:status`, { status: "authenticated" });
  });

  client.on("auth_failure", (msg) => {
    console.error(`[Manager:${clientId}] Auth failure:`, msg);
    if (!instances[clientId]) return;
    instances[clientId].status = "auth_failure";
    instances[clientId].qrDataUrl = null;
    io.emit(`client:${clientId}:status`, { status: "auth_failure" });
  });

  client.on("ready", () => {
    console.log(`[Manager:${clientId}] Client is READY.`);
    if (!instances[clientId]) return;
    instances[clientId].status = "ready";
    instances[clientId].qrDataUrl = null;
    io.emit(`client:${clientId}:status`, { status: "ready" });
  });

  // ─── INCOMING CUSTOMER MESSAGES ───────────────────────────────────────────
  client.on("message", async (msg) => {
    if (msg.fromMe || msg.type !== "chat") return;

    const senderId = msg.from;
    const body = msg.body ? msg.body.trim() : "";
    const instance = instances[clientId];
    if (!instance) return;

    // Reload config dynamically
    try {
      instance.config = loadConfig(clientId);
      instance.aiService.updateConfig(instance.config);
    } catch (_) {}

    if (!instance.config.chatSettings.enableAutoReply) return;
    if (!instance.config.chatSettings.respondToGroups && senderId.endsWith("@g.us")) {
      console.log(`[Manager:${clientId}] Skipping group message from ${senderId}.`);
      return;
    }

    // ── CHECK: Is this contact paused (human took over or handover)? ──
    const paused = instance.pausedContacts[senderId];
    if (paused) {
      // If it's a human-pause with a cooldown, check if expired
      if (paused.cooldownMs && Date.now() - paused.pausedAt > paused.cooldownMs) {
        // Cooldown expired — auto-resume AI for this contact
        delete instance.pausedContacts[senderId];
        console.log(`[Manager:${clientId}] AI auto-resumed for ${senderId.split("@")[0]} (cooldown expired).`);
        io.emit(`client:${clientId}:paused_contacts`, getPausedContactsList(clientId));
      } else {
        // Still paused — AI stays silent, human is handling it
        console.log(`[Manager:${clientId}] AI silent for ${senderId.split("@")[0]} (paused: ${paused.reason}).`);
        return;
      }
    }

    try {
      const chat = await msg.getChat();
      if (instance.config.chatSettings.showTypingIndicator) {
        await chat.sendStateTyping();
      }

      const min = instance.config.chatSettings.minDelayMs ?? 2000;
      const max = instance.config.chatSettings.maxDelayMs ?? 5000;
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      await new Promise(r => setTimeout(r, delay));

      let response = await instance.aiService.generateResponse(senderId, body);

      if (instance.config.chatSettings.showTypingIndicator) {
        await chat.clearState();
      }

      // ── CHECK: Did AI request a handover? ──────────────────────────────────
      const HANDOVER_TAG = "[HANDOVER]";
      const LEAD_TAG = "[LEAD]";
      const needsHandover = response.includes(HANDOVER_TAG);
      const hasLeadTag = response.includes(LEAD_TAG);
      if (needsHandover) {
        // Strip the tag — customer never sees the internal marker
        response = response.replace(HANDOVER_TAG, "").trim();
        // Indefinitely pause AI for this customer (requires manual resume)
        instance.pausedContacts[senderId] = {
          reason: "handover",
          pausedAt: Date.now(),
          cooldownMs: null,
          contactName: senderId.split("@")[0],
          lastMessage: body,
        };
        console.log(`[Manager:${clientId}] HANDOVER triggered for ${senderId.split("@")[0]}.`);
        // Fire alert to dashboard
        io.emit(`client:${clientId}:handoff`, {
          contactId: senderId,
          contactName: senderId.split("@")[0],
          lastMessage: body,
          timestamp: Date.now(),
        });
        io.emit(`client:${clientId}:paused_contacts`, getPausedContactsList(clientId));
      }

      // Strip [LEAD] tag if present — customer never sees the internal marker
      if (hasLeadTag) {
        response = response.replace(LEAD_TAG, "").trim();
      }

      // 🔥 Mark outgoing message as AI-sent so message_create doesn't misidentify it as a human reply
      instance._pendingAISend = true;
      try {
        await chat.sendMessage(response);
        instance.messageCount++;
      } finally {
        instance._pendingAISend = false;
      }
      io.emit(`client:${clientId}:stats`, { messageCount: instance.messageCount });
      console.log(`[Manager:${clientId}] Replied to ${senderId.split("@")[0]}`);

      // ── LEAD DETECTION & TELEGRAM NOTIFICATION ─────────────────────────────
      const telegramToken = instance.config.telegramBotToken;
      const telegramChatId = instance.config.telegramChatId;
      const source = needsHandover ? "handover" : "lead";
      const isLead = needsHandover || hasLeadTag ||
        response.includes("[LEAD]") ||
        /[\d-]{7,}/.test(body) ||              // phone-like number in customer msg
        /[\w.-]+@[\w.-]+\.\w+/.test(body) ||    // email in customer msg
        /\b(buy|order|book|pay|purchase|sign up|subscribe|how to start|i want)\b/i.test(body);

      if (isLead && telegramToken && telegramChatId) {
        // Extract phone/email from customer message
        const phoneMatch = body.match(/(?:01[0-9])[\s-]?\d{3,4}[\s-]?\d{3,5}/);
        const emailMatch = body.match(/[\w.-]+@[\w.-]+\.\w+/);
        // Check if AI response contains order info (between "order" and next section)
        const orderMatch = response.match(/(?:order|booking|pickup|collect|ready)[^.]*\.?/i);

        const leadMsg = formatLeadMessage(
          clientId,
          instance.config.business?.name || instance.config.botName,
          senderId.split("@")[0],
          phoneMatch ? phoneMatch[0] : /[\d-]{7,}/.test(body) ? body.substring(0, 30) : null,
          emailMatch ? emailMatch[0] : null,
          body,
          orderMatch ? orderMatch[0].trim() : null,
          source
        );
        const sent = await sendTelegram(telegramToken, telegramChatId, leadMsg);
        if (sent) {
          console.log(`[Manager:${clientId}] Telegram lead alert sent for ${senderId.split("@")[0]}`);
        } else {
          console.log(`[Manager:${clientId}] Telegram lead alert failed (check token/chatId in config)`);
        }
      }
    } catch (err) {
      console.error(`[Manager:${clientId}] Reply error:`, err.message);
      try { const chat = await msg.getChat(); await chat.clearState(); } catch (_) {}
    }
  });

  // ─── OUTGOING MESSAGES: Human agent typed manually → Auto-Pause AI ────────
  client.on("message_create", (msg) => {
    if (!msg.fromMe) return; // Only care about messages the owner/human sent
    const instance = instances[clientId];
    if (!instance) return;

    // 🔥 Skip AI's own replies — only pause for genuine human-typed messages
    if (instance._pendingAISend) return;

    // The contact receiving this human reply = msg.to
    const contactId = msg.to;
    if (!contactId || contactId === "status@broadcast") return;

    // Already paused by handover? Don't override with a shorter cooldown, but update the last message
    const existing = instance.pausedContacts[contactId];
    if (existing && existing.reason === "handover") {
      existing.lastMessage = msg.body || "";
      return;
    }

    const HUMAN_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
    instance.pausedContacts[contactId] = {
      reason: "human",
      pausedAt: Date.now(),
      cooldownMs: HUMAN_COOLDOWN_MS,
      contactName: contactId.split("@")[0],
      lastMessage: msg.body || "",
    };
    console.log(`[Manager:${clientId}] Human took over for ${contactId.split("@")[0]}. AI paused for 30 min.`);
    io.emit(`client:${clientId}:paused_contacts`, getPausedContactsList(clientId));
  });

  client.on("disconnected", async (reason) => {
    console.log(`[Manager:${clientId}] Disconnected:`, reason);
    if (!instances[clientId] || instances[clientId].status === "stopped") {
      return;
    }
    instances[clientId].status = "disconnected";
    instances[clientId].qrDataUrl = null;
    io.emit(`client:${clientId}:status`, { status: "disconnected" });

    // Auto-reconnect after a short delay (with guard against overlapping retries)
    if (!instances[clientId]._reconnecting) {
      instances[clientId]._reconnecting = true;
      console.log(`[Manager:${clientId}] Will auto-reconnect in 5s...`);
      instances[clientId].reconnectTimeout = setTimeout(async () => {
        if (!instances[clientId] || instances[clientId].status === "stopped") {
          return;
        }
        try {
          await client.destroy();
        } catch (_) {}
        if (!instances[clientId] || instances[clientId].status === "stopped") {
          return;
        }
        try {
          await client.initialize();
          console.log(`[Manager:${clientId}] Auto-reconnect successful.`);
        } catch (err) {
          console.error(`[Manager:${clientId}] Auto-reconnect failed:`, err.message);
          if (instances[clientId]) {
            instances[clientId]._reconnecting = false;
            instances[clientId].status = "error";
            io.emit(`client:${clientId}:status`, { status: "error", message: err.message });
          }
        }
      }, 5000);
    }
  });

  client.initialize().catch(async (err) => {
    console.error(`[Manager:${clientId}] Init failed:`, err.message);
    if (instances[clientId]) {
      instances[clientId].status = "error";
    }
    io.emit(`client:${clientId}:status`, { status: "error", message: err.message });
    try {
      await client.destroy();
    } catch (_) {}
    delete instances[clientId];
  });
}

// ─── PAUSED CONTACTS HELPERS ───────────────────────────────────────────────

function getPausedContactsList(clientId) {
  const instance = instances[clientId];
  if (!instance) return [];
  
  // Clean up any expired cooldowns on access
  const now = Date.now();
  for (const [contactId, data] of Object.entries(instance.pausedContacts)) {
    if (data.cooldownMs && now - data.pausedAt > data.cooldownMs) {
      delete instance.pausedContacts[contactId];
    }
  }

  return Object.entries(instance.pausedContacts).map(([contactId, data]) => ({
    contactId,
    contactName: data.contactName || contactId.split("@")[0],
    reason: data.reason,
    pausedAt: data.pausedAt,
    expiresAt: data.cooldownMs ? data.pausedAt + data.cooldownMs : null,
    lastMessage: data.lastMessage || "",
  }));
}

function resumeContact(clientId, contactId, io) {
  const instance = instances[clientId];
  if (!instance) throw new Error(`Client ${clientId} not running.`);
  if (!instance.pausedContacts[contactId]) throw new Error(`Contact not paused.`);
  delete instance.pausedContacts[contactId];
  console.log(`[Manager:${clientId}] AI resumed for ${contactId.split("@")[0]}.`);
  if (io) io.emit(`client:${clientId}:paused_contacts`, getPausedContactsList(clientId));
}

// Background pruning interval: checks every 10 seconds and notifies client dashboard of auto-resumes
setInterval(() => {
  const now = Date.now();
  for (const [clientId, instance] of Object.entries(instances)) {
    let changed = false;
    for (const [contactId, data] of Object.entries(instance.pausedContacts)) {
      if (data.cooldownMs && now - data.pausedAt > data.cooldownMs) {
        delete instance.pausedContacts[contactId];
        console.log(`[Manager:${clientId}] AI auto-resumed for ${contactId.split("@")[0]} (cooldown expired in background).`);
        changed = true;
      }
    }
    if (changed && instance.io) {
      instance.io.emit(`client:${clientId}:paused_contacts`, getPausedContactsList(clientId));
    }
  }
}, 10000);

async function stopClient(clientId) {
  const instance = instances[clientId];
  if (!instance) return;
  if (instance.reconnectTimeout) {
    clearTimeout(instance.reconnectTimeout);
    instance.reconnectTimeout = null;
  }
  try {
    await instance.client.destroy();
  } catch (_) {}
  delete instances[clientId];
  console.log(`[Manager:${clientId}] Stopped.`);
}

function getStatus(clientId) {
  const instance = instances[clientId];
  if (!instance) return { status: "stopped", messageCount: 0, uptime: 0 };
  return {
    status: instance.status,
    messageCount: instance.messageCount,
    uptime: Math.floor((Date.now() - instance.startTime) / 1000),
    qrDataUrl: instance.qrDataUrl || null,
  };
}

function toggleAutoReply(clientId, enabled) {
  const configPath = getConfigPath(clientId);
  if (!fs.existsSync(configPath)) throw new Error(`Config not found for client: ${clientId}`);
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.chatSettings.enableAutoReply = enabled;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  if (instances[clientId]) {
    instances[clientId].config = config;
    instances[clientId].aiService.updateConfig(config);
  }
  return config;
}

async function deleteClient(clientId) {
  // 1. Stop client session if running
  await stopClient(clientId);

  // 2. Delete the config file. Preserve a hidden template so new bots can still be created.
  const configPath = getConfigPath(clientId);
  if (clientId === "default" && fs.existsSync(configPath) && !fs.existsSync(TEMPLATE_CONFIG_PATH)) {
    fs.copyFileSync(configPath, TEMPLATE_CONFIG_PATH);
  }
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }

  // 3. Wipe the auth session folder recursively
  const authFolderName = clientId === "default" ? "session" : `session-${clientId}`;
  const authDir = path.join(__dirname, ".wwebjs_auth", authFolderName);
  if (fs.existsSync(authDir)) {
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`[Manager:${clientId}] Failed to delete session folder:`, err.message);
    }
  }
  console.log(`[Manager:${clientId}] Session files and config successfully deleted.`);
}

module.exports = { startClient, stopClient, getStatus, listClients, loadConfig, saveConfig, toggleAutoReply, deleteClient, getPausedContactsList, resumeContact, instances };
