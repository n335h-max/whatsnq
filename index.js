require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const AIService = require("./ai-service");

// Parse client ID from arguments (e.g., node index.js --id=dentist)
const clientArg = process.argv.find(arg => arg.startsWith("--id="));
const clientId = clientArg ? clientArg.split("=")[1].trim() : "default";
const TEMPLATE_PATH = path.join(__dirname, "config.template.json");

const CONFIG_PATH = clientId === "default"
  ? path.join(__dirname, "config.json")
  : path.join(__dirname, `config-${clientId}.json`);

const logPrefix = `[Bot:${clientId}]`;
const startTime = Date.now();
let messageCount = 0;

// Load and parse configuration file
function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      if (clientId !== "default") {
        const defaultPath = fs.existsSync(TEMPLATE_PATH)
          ? TEMPLATE_PATH
          : path.join(__dirname, "config.json");
        if (fs.existsSync(defaultPath)) {
          fs.copyFileSync(defaultPath, CONFIG_PATH);
          console.log(`${logPrefix} Created new config file: config-${clientId}.json from template.`);
        } else {
          console.error(`${logPrefix} Config template not found at ${defaultPath}`);
          process.exit(1);
        }
      } else if (fs.existsSync(TEMPLATE_PATH)) {
        fs.copyFileSync(TEMPLATE_PATH, CONFIG_PATH);
        console.log(`${logPrefix} Created config.json from config.template.json.`);
      } else {
        console.error(`${logPrefix} config.json does not exist at ${CONFIG_PATH}`);
        process.exit(1);
      }
    }
    const data = fs.readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`${logPrefix} Error loading config:`, error.message);
    process.exit(1);
  }
}

// Save configuration file back to disk (to persist admin changes)
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
    console.log(`${logPrefix} Configuration saved successfully.`);
  } catch (error) {
    console.error(`${logPrefix} Error saving config:`, error.message);
  }
}

// Check if a sender is configured as an admin
function isAdmin(senderId, config) {
  const cleanSender = senderId.split("@")[0];
  if (!config.adminNumbers || config.adminNumbers.length === 0) {
    return false;
  }
  return config.adminNumbers.some(adminNum => {
    const cleanAdmin = adminNum.toString().replace(/\D/g, "");
    return cleanSender === cleanAdmin;
  });
}

// Calculate runtime uptime in human-readable format
function getUptime() {
  const diffMs = Date.now() - startTime;
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
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

// Main execution function
async function start() {
  console.log("=========================================");
  console.log(`🚀 Starting ${logPrefix} AI Chatbot...`);
  console.log(`📂 Config: ${path.basename(CONFIG_PATH)}`);
  console.log("=========================================");

  let config = loadConfig();
  const aiService = new AIService(config);

  const sysBrowserPath = getExecutablePath();
  if (sysBrowserPath) {
    console.log(`${logPrefix} Launching system browser: ${sysBrowserPath}`);
  } else {
    console.log(`${logPrefix} Launching default bundled Chromium.`);
  }

  // Initialize WhatsApp Client with LocalAuth partition
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: clientId // Automatically separates session folders in .wwebjs_auth/
    }),
    puppeteer: {
      headless: true,
      executablePath: sysBrowserPath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu"
      ]
    }
  });

  // Event: QR Code Generation
  client.on("qr", (qr) => {
    console.log(`\n${logPrefix} QR Code generated for client authentication:`);
    console.log(`${logPrefix} Scan this QR code with WhatsApp Linked Devices:`);
    qrcode.generate(qr, { small: true });
  });

  // Event: Client Authenticated
  client.on("authenticated", () => {
    console.log(`${logPrefix} Authenticated successfully.`);
  });

  // Event: Auth Failure
  client.on("auth_failure", (msg) => {
    console.error(`${logPrefix} Authentication failure:`, msg);
  });

  // Event: Client Ready
  client.on("ready", () => {
    console.log("\n=========================================");
    console.log(`✅ ${logPrefix} WhatsApp Client is READY!`);
    console.log(`🤖 Bot Name: ${config.botName}`);
    console.log(`📡 AI Provider: ${config.aiProvider.toUpperCase()}`);
    console.log(`💾 Session ID: ${clientId}`);
    console.log("=========================================\n");
  });

  // Event: Incoming Message
  client.on("message", async (msg) => {
    const senderId = msg.from;
    const body = msg.body ? msg.body.trim() : "";
    
    // Ignore group chats unless explicitly enabled
    const isGroup = senderId.endsWith("@g.us");
    if (isGroup && !config.chatSettings.respondToGroups) {
      return;
    }

    // Ignore self messages
    if (msg.fromMe) {
      return;
    }

    // Ignore contacts in the blocklist
    const cleanSender = senderId.split("@")[0];
    if (config.ignoredContacts && config.ignoredContacts.includes(cleanSender)) {
      return;
    }

    // Reload config on message to dynamically register manual edits
    config = loadConfig();
    aiService.updateConfig(config);

    // 1. Handle Admin Commands
    if (body.startsWith("!") && isAdmin(senderId, config)) {
      const args = body.slice(1).split(" ");
      const command = args[0].toLowerCase();
      const param = args.slice(1).join(" ");

      console.log(`${logPrefix} Admin Command: !${command} from ${cleanSender}`);

      switch (command) {
        case "help":
          const helpText = 
            `🌟 *AI Bot Admin Commands (${clientId})*:\n\n` +
            `• *!status*: Show active settings, uptime, stats.\n` +
            `• *!pause*: Pause all auto-replies.\n` +
            `• *!resume*: Resume auto-replies.\n` +
            `• *!reset*: Clear your own AI context.\n` +
            `• *!reset <number>*: Clear AI context for a specific user.\n` +
            `• *!setprompt <text>*: Instantly update the AI system prompt.\n` +
            `• *!provider <gemini|openai|openrouter>*: Toggle AI provider.`;
          await msg.reply(helpText);
          break;

        case "status":
          const activeModelName = config.aiProvider === "gemini" 
            ? config.geminiModel 
            : (config.aiProvider === "openai" ? config.openaiModel : config.openrouterModel);
          const statusText = 
            `🤖 *Bot Status Overview (${clientId})*:\n\n` +
            `• *System*: ${config.chatSettings.enableAutoReply ? "🟢 Active" : "🔴 Paused"}\n` +
            `• *Provider*: ${config.aiProvider} (${activeModelName})\n` +
            `• *Uptime*: ${getUptime()}\n` +
            `• *Messages Replied*: ${messageCount}\n` +
            `• *Active Sessions*: ${Object.keys(aiService.history).length}`;
          await msg.reply(statusText);
          break;

        case "pause":
          config.chatSettings.enableAutoReply = false;
          saveConfig(config);
          await msg.reply("🔴 *Auto-reply system paused.* The bot will no longer respond to inquiries.");
          break;

        case "resume":
          config.chatSettings.enableAutoReply = true;
          saveConfig(config);
          await msg.reply("🟢 *Auto-reply system resumed.* The bot is now responding to inquiries.");
          break;

        case "reset":
          if (param) {
            const targetJid = param.includes("@") ? param : `${param.replace(/\D/g, "")}@c.us`;
            aiService.resetHistory(targetJid);
            await msg.reply(`🧹 *Context cleared* for phone number: ${param}`);
          } else {
            aiService.resetHistory(senderId);
            await msg.reply("🧹 *Your personal context has been cleared.*");
          }
          break;

        case "setprompt":
          if (!param) {
            await msg.reply("⚠️ Please provide a new prompt text. Usage: `!setprompt <new prompt text>`");
          } else {
            config.systemPrompt = param;
            saveConfig(config);
            await msg.reply("✅ *AI system prompt updated and saved successfully!*");
          }
          break;

        case "provider":
          const targetProvider = param.toLowerCase();
          if (targetProvider !== "gemini" && targetProvider !== "openai" && targetProvider !== "openrouter") {
            await msg.reply("⚠️ Invalid provider. Please use `!provider gemini`, `!provider openai`, or `!provider openrouter`.");
          } else {
            config.aiProvider = targetProvider;
            saveConfig(config);
            aiService.updateConfig(config);
            await msg.reply(`✅ *AI provider changed to*: ${targetProvider.toUpperCase()}`);
          }
          break;

        default:
          await msg.reply("❓ Unknown admin command. Type `!help` to see list of commands.");
          break;
      }
      return; // Stop message processing after command executes
    }

    // 2. Handle Customer Inquiries (Auto-Replies)
    if (!config.chatSettings.enableAutoReply) {
      return;
    }

    // Ensure it's a standard text message
    if (msg.type !== "chat") {
      return;
    }

    console.log(`${logPrefix} Message from ${cleanSender}: "${body}"`);

    try {
      const chat = await msg.getChat();

      // Show typing indicator if configured
      if (config.chatSettings.showTypingIndicator) {
        await chat.sendStateTyping();
      }

      // Mimic human typing speed (randomized delay between min and max config settings)
      const min = config.chatSettings.minDelayMs ?? 2000;
      const max = config.chatSettings.maxDelayMs ?? 5000;
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Generate AI response
      const response = await aiService.generateResponse(senderId, body);

      // Stop typing indicator
      if (config.chatSettings.showTypingIndicator) {
        await chat.clearState();
      }

      // Send response
      await chat.sendMessage(response);
      messageCount++;
      console.log(`${logPrefix} Sent reply to ${cleanSender} (${delay}ms typing delay)`);

    } catch (error) {
      console.error(`${logPrefix} Error processing message from ${cleanSender}:`, error.message);
      
      // Stop typing state in case of failure
      try {
        const chat = await msg.getChat();
        await chat.clearState();
      } catch (_) {}

      // If sender is admin, let them know the exact API error
      if (isAdmin(senderId, config)) {
        await msg.reply(`❌ *API Error*: ${error.message}\nPlease check your API keys in the .env file.`);
      }
    }
  });

  // Event: Disconnected
  client.on("disconnected", async (reason) => {
    console.log(`${logPrefix} Client disconnected:`, reason);
    console.log(`${logPrefix} Re-initializing client...`);
    // Ensure clean state before re-initializing
    try {
      await client.destroy();
    } catch (_) {}
    setTimeout(() => {
      client.initialize().catch((err) => console.error(`${logPrefix} Re-initialization error:`, err.message));
    }, 2000);
  });

  // Start initialization
  client.initialize().catch(async (err) => {
    console.error(`${logPrefix} Initialization failed:`, err.message);
    try {
      await client.destroy();
    } catch (_) {}
    process.exit(1);
  });
}

// Catch unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error(`❌ ${logPrefix} [Fatal Error] Unhandled rejection:`, err.stack);
});

start();
