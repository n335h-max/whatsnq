const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OpenAI } = require("openai");
const db = require("./database");

class AIService {
  constructor(config, clientId = "default") {
    this.config = config;
    this.clientId = clientId;
    this.history = {}; // Keep in-memory cache for fast reads, synced to DB

    // Initialize API clients based on configuration
    this.initClients();
  }

  initClients() {
    // Load API Keys from process.env
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (this.config.aiProvider === "gemini") {
      if (!geminiKey || geminiKey.includes("your_gemini_api_key")) {
        console.warn("WARNING: Gemini API Key is missing or default. Please set GEMINI_API_KEY in your .env file.");
        this.genAI = null;
      } else {
        this.genAI = new GoogleGenerativeAI(geminiKey);
      }
    } else if (this.config.aiProvider === "openai") {
      if (!openaiKey || openaiKey.includes("your_openai_api_key")) {
        console.warn("WARNING: OpenAI API Key is missing or default. Please set OPENAI_API_KEY in your .env file.");
        this.openai = null;
      } else {
        this.openai = new OpenAI({ apiKey: openaiKey });
      }
    } else if (this.config.aiProvider === "openrouter") {
      if (!openrouterKey || openrouterKey.includes("your_openrouter_api_key")) {
        console.warn("WARNING: OpenRouter API Key is missing or default. Please set OPENROUTER_API_KEY in your .env file.");
        this.openrouter = null;
      } else {
        this.openrouter = new OpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: openrouterKey,
          defaultHeaders: {
            "HTTP-Referer": "https://localhost:3000",
            "X-Title": "WhatsApp AI Builder",
          }
        });
      }
    }
  }

  // Update configuration dynamically (e.g., if reloaded by admin)
  updateConfig(newConfig) {
    this.config = newConfig;
    this.initClients();
  }

  extractAssistantText(messageContent) {
    if (typeof messageContent === "string") {
      return messageContent.trim();
    }

    if (Array.isArray(messageContent)) {
      const combined = messageContent
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part.text === "string") return part.text;
          return "";
        })
        .join("\n")
        .trim();
      return combined;
    }

    return "";
  }

  // Build the complete system instructions injected into the AI model
  buildSystemInstructions() {
    const biz = this.config.business || {};
    let prompt = `${this.config.systemPrompt || ""}\n\n`;
    prompt += `### BUSINESS CONTEXT\n`;
    prompt += `- **Business Name**: ${biz.name || "N/A"}\n`;
    prompt += `- **Product/Service Offered**: ${biz.product || "N/A"}\n`;
    prompt += `- **Special Early Bird Promo**: ${biz.pricePromo || "N/A"}\n`;
    prompt += `- **Standard Price**: ${biz.priceRegular || "N/A"}\n`;
    prompt += `- **Remaining Promo Slots**: ${biz.slotsRemaining || "N/A"}\n`;
    prompt += `- **Company Background/Details**: ${biz.details || ""}\n`;
    if (biz.address) {
      prompt += `- **📍 Address**: ${biz.address}\n`;
    }
    if (biz.operatingHours) {
      prompt += `- **🕐 Operating Hours**: ${biz.operatingHours}\n`;
    }
    if (biz.phone) {
      prompt += `- **📞 Contact**: ${biz.phone}\n`;
    }
    prompt += `\n`;

    if (biz.faqs && biz.faqs.length > 0) {
      prompt += `### FREQUENTLY ASKED QUESTIONS (FAQs)\n`;
      biz.faqs.forEach((faq, index) => {
        prompt += `${index + 1}. **Q**: ${faq.question}\n   **A**: ${faq.answer}\n`;
      });
      prompt += `\n`;
    }

    prompt += `### CONSTRAINTS & RULES\n`;
    prompt += `1. NEVER talk about other competitor services.\n`;
    prompt += `2. Do not invent any pricing, features, or facts outside of the business context provided above. If you don't know the answer, politely ask them to wait for a human agent.\n`;
    prompt += `3. Keep replies friendly, concise, and structured (use bullet points or emojis to break up text). Do not write long blocks of text.`;

    return prompt;
  }

  // Retrieve chat history for a contact — from DB, with in-memory cache fallback
  getHistory(contactId) {
    const maxLength = this.config.chatSettings.maxHistoryLength || 10;

    // Try DB first
    try {
      const history = db.getHistory(this.clientId, contactId, maxLength);
      if (history.length > 0) {
        // Sync to in-memory cache for fast re-reads
        this.history[contactId] = history;
        return history;
      }
    } catch (err) {
      console.warn(`[AI-Service] DB read failed, falling back to cache:`, err.message);
    }

    // Fallback to in-memory cache
    if (!this.history[contactId]) {
      this.history[contactId] = [];
    }
    return this.history[contactId];
  }

  // Clear history for a contact
  resetHistory(contactId) {
    this.history[contactId] = [];
    // Also clear from DB
    try {
      db.resetHistory(this.clientId, contactId);
    } catch (err) {
      console.warn(`[AI-Service] DB reset failed:`, err.message);
    }
    console.log(`[AI-Service] Reset chat history for contact: ${contactId}`);
  }

  // Add message to conversation history (DB + in-memory cache)
  addMessage(contactId, role, content) {
    // Write to DB first
    try {
      db.addMessage(this.clientId, contactId, role, content);
    } catch (err) {
      console.warn(`[AI-Service] DB write failed, using memory-only:`, err.message);
    }

    // Update in-memory cache
    const history = this.getHistory(contactId);
    history.push({ role, content });

    // Truncate to max limit
    const maxLength = this.config.chatSettings.maxHistoryLength || 10;
    if (history.length > maxLength) {
      history.shift(); // Remove oldest message
    }
  }

  // Main method to generate a response
  async generateResponse(contactId, userMessageText) {
    const provider = this.config.aiProvider;
    const systemPrompt = this.buildSystemInstructions();
    
    // Add current user message to history
    this.addMessage(contactId, "user", userMessageText);

    try {
      if (provider === "gemini") {
        return await this.callGemini(contactId, systemPrompt);
      } else if (provider === "openai") {
        return await this.callOpenAI(contactId, systemPrompt);
      } else if (provider === "openrouter") {
        return await this.callOpenRouter(contactId, systemPrompt);
      } else {
        throw new Error(`Unsupported AI Provider: ${provider}`);
      }
    } catch (error) {
      console.error(`[AI-Service Error] Failed to generate response for ${contactId}:`, error.message);
      // Remove the last user message from history if the request failed
      const history = this.getHistory(contactId);
      if (history.length > 0 && history[history.length - 1].role === "user") {
        history.pop();
      }
      throw error;
    }
  }

  // Auto-generate system prompt based on raw client questionnaires
  async generateSystemPrompt(businessInfo) {
    const provider = this.config.aiProvider;
    
    const rawData = `
    Business Name: ${businessInfo.name}
    Product/Service Offered: ${businessInfo.product}
    Raw Background Info & Details:
    ${businessInfo.rawContext}
    `;

    const metaPrompt = `
    You are an expert AI Prompt Engineer.
    Analyze the business data provided below and generate a highly detailed, professional, and optimized "systemInstruction" prompt for a WhatsApp chatbot sales representative.
    
    The generated system prompt MUST specify:
    1. A friendly, professional customer support agent persona (give the agent a name, e.g. "Sparky" or similar).
    2. Operational instructions (be warm, keep answers short and structured, use emojis, and avoid long blocks of text).
    3. Rules for selling (summarize key services/prices, address FAQs from the context).
    4. Constraints (never fabricate info outside the provided context. If unable to answer a specific question or if the customer explicitly demands to speak to a human manager, politely state that you are handing them over to a representative, and you MUST append the exact tag "[HANDOVER]" at the very end of your final response).
    
    Return ONLY the final system prompt. Do NOT include any intro or outro markdown wrapper (like "Here is the prompt:"). Return plain text prompt only.

    BUSINESS DATA:
    ${rawData}
    `;

    try {
      if (provider === "gemini") {
        if (!this.genAI) throw new Error("Gemini API not initialized.");
        const model = this.genAI.getGenerativeModel({ model: this.config.geminiModel || "gemini-2.5-flash" });
        const result = await model.generateContent(metaPrompt);
        return result.response.text().trim();
      } else if (provider === "openai") {
        if (!this.openai) throw new Error("OpenAI API not initialized.");
        const response = await this.openai.chat.completions.create({
          model: this.config.openaiModel || "gpt-4o-mini",
          messages: [{ role: "user", content: metaPrompt }]
        });
        const responseText = this.extractAssistantText(response?.choices?.[0]?.message?.content);
        if (!responseText) {
          throw new Error("Received empty response from OpenAI API.");
        }
        return responseText;
      } else if (provider === "openrouter") {
        if (!this.openrouter) throw new Error("OpenRouter API not initialized.");
        const response = await this.openrouter.chat.completions.create({
          model: this.config.openrouterModel || "nex-agi/nex-n2-pro:free",
          messages: [{ role: "user", content: metaPrompt }]
        });
        const responseText = this.extractAssistantText(response?.choices?.[0]?.message?.content);
        if (!responseText) {
          throw new Error("Received empty response from OpenRouter API.");
        }
        return responseText;
      } else {
        throw new Error(`Unsupported AI Provider: ${provider}`);
      }
    } catch (error) {
      console.error(`[AI-Service Error] Failed to generate system prompt:`, error.message);
      throw error;
    }
  }

  async callGemini(contactId, systemPrompt) {
    if (!this.genAI) {
      throw new Error("Gemini AI client is not initialized. Please verify your GEMINI_API_KEY.");
    }

    const modelName = this.config.geminiModel || "gemini-2.5-flash";
    
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });

    const localHistory = this.getHistory(contactId);
    const geminiContents = localHistory.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const result = await model.generateContent({
      contents: geminiContents,
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error("Received empty response from Gemini API.");
    }

    this.addMessage(contactId, "assistant", responseText);
    return responseText;
  }

  async callOpenAI(contactId, systemPrompt) {
    if (!this.openai) {
      throw new Error("OpenAI client is not initialized. Please verify your OPENAI_API_KEY.");
    }

    const modelName = this.config.openaiModel || "gpt-4o-mini";
    const localHistory = this.getHistory(contactId);

    const messages = [
      { role: "system", content: systemPrompt },
      ...localHistory.map(msg => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content
      }))
    ];

    const response = await this.openai.chat.completions.create({
      model: modelName,
      messages: messages,
    });

    const responseText = this.extractAssistantText(response?.choices?.[0]?.message?.content);
    if (!responseText) {
      throw new Error("Received empty response from OpenAI API.");
    }

    this.addMessage(contactId, "assistant", responseText);
    return responseText;
  }

  async callOpenRouter(contactId, systemPrompt) {
    if (!this.openrouter) {
      throw new Error("OpenRouter client is not initialized. Please verify your OPENROUTER_API_KEY.");
    }

    const modelName = this.config.openrouterModel || "nex-agi/nex-n2-pro:free";
    const localHistory = this.getHistory(contactId);

    const messages = [
      { role: "system", content: systemPrompt },
      ...localHistory.map(msg => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content
      }))
    ];

    const response = await this.openrouter.chat.completions.create({
      model: modelName,
      messages: messages,
    });

    const responseText = this.extractAssistantText(response?.choices?.[0]?.message?.content);
    if (!responseText) {
      throw new Error("Received empty response from OpenRouter API.");
    }

    this.addMessage(contactId, "assistant", responseText);
    return responseText;
  }
}

module.exports = AIService;
