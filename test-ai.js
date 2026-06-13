// test-ai.js
// Verification script to test Gemini and OpenAI API responses using AIService
require("dotenv").config();
const fs = require("fs");
const path = require("path");

// Parse client ID from arguments (e.g., node test-ai.js --id=dentist)
const clientArg = process.argv.find(arg => arg.startsWith("--id="));
const clientId = clientArg ? clientArg.split("=")[1].trim() : "default";

const configPath = clientId === "default"
  ? path.join(__dirname, "config.json")
  : path.join(__dirname, `config-${clientId}.json`);

const AIService = require("./ai-service.js");

async function test() {
  console.log(`🔍 Starting AI Service Verification Test for client: ${clientId}...\n`);

  if (!fs.existsSync(configPath)) {
    console.error(`❌ Configuration file not found at ${configPath}`);
    console.log(`💡 Tip: Run the bot once using 'node index.js --id=${clientId}' to automatically generate the configuration file.`);
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  console.log(`🤖 Configuration Loaded:`);
  console.log(` - Active Provider: ${config.aiProvider}`);
  console.log(` - Gemini Model: ${config.geminiModel}`);
  console.log(` - OpenAI Model: ${config.openaiModel}`);

  const aiService = new AIService(config);

  const contactId = "test_user_12345@c.us";
  const userMessage = "Hello! What is this AI Bot and how much does it cost?";

  console.log(`\n💬 Sending user message to AI Service: "${userMessage}"`);

  try {
    const response = await aiService.generateResponse(contactId, userMessage);
    console.log(`\n✅ Response received successfully:`);
    console.log(`----------------------------------------`);
    console.log(response);
    console.log(`----------------------------------------`);
    
    // Test context memory
    const followUpMessage = "Awesome! Can I pay with Touch 'n Go e-wallet?";
    console.log(`\n💬 Sending follow-up message: "${followUpMessage}"`);
    const followUpResponse = await aiService.generateResponse(contactId, followUpMessage);
    console.log(`\n✅ Follow-up response received successfully:`);
    console.log(`----------------------------------------`);
    console.log(followUpResponse);
    console.log(`----------------------------------------`);
  } catch (error) {
    console.error(`❌ Test failed with error:`, error.message);
    console.log("\n💡 Note: This is normal if you haven't set up your API keys in the `.env` file yet.");
  }
}

test();
