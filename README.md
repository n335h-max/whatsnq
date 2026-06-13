# 🤖 WhatsApp AI Chatbot Builder

A premium, commercial-ready WhatsApp automation solution that turns any standard WhatsApp number into an intelligent, 24/7 AI Sales and Customer Support Agent. Built for local businesses, e-commerce stores, service providers, and startups.

Powered by **Google Gemini** (Gemini 1.5 Flash), **OpenAI GPT** (GPT-4o Mini), and **OpenRouter** (which supports any LLM model including Claude and Llama), this bot maintains context, simulates human typing delay, and is completely manageable directly from WhatsApp via Admin Commands.

---

## 🌟 Key Features

*   **Multi-Client Scaling**: Run multiple client bots simultaneously from a single server/codebase. Each client has its own independent session, config file, and admin list.
*   **Triple AI Engines**: Supports Google Gemini, OpenAI GPT, or OpenRouter models. Switch providers in a single config setting or with a chat command.
*   **Contextual Chat Memory**: Remembers the context of previous messages in a conversation (up to a configurable limit) for natural back-and-forth dialogues.
*   **Human-like Behavior**: Simulates real typing status and introduces a customizable, randomized delay before replying to look natural.
*   **No Code Configuration**: Adjust the business details, promotional pricing, FAQs, and AI persona in a single `config.json` file.
*   **WhatsApp Admin Control Panel**: Control, pause, or update the bot on the fly using commands directly inside WhatsApp from defined admin phone numbers.
*   **Persistent Auth Session**: Saves authentication details locally in `.wwebjs_auth` so you only scan the QR code once.

---

## 🛠️ Tech Stack

*   **Core**: Node.js
*   **WhatsApp API**: `whatsapp-web.js`
*   **AI Integration**: `@google/generative-ai` & `openai`
*   **Environment Configuration**: `dotenv`

---

## 🚀 Setup & Installation

### 1. Prerequisites
Ensure you have **Node.js** (v18 or higher recommended) installed on your machine.

### 2. Install Dependencies
Run the following command in your terminal to install all required libraries:
```bash
npm install
```

### 3. Configure Environment Variables
1. Copy the `.env.example` file to a new file named `.env`:
   ```bash
   copy .env.example .env
   ```
2. Open `.env` and configure your API key(s) and select the active provider:
   ```env
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your_actual_google_gemini_api_key
   OPENAI_API_KEY=your_actual_openai_api_key
   OPENROUTER_API_KEY=your_actual_openrouter_api_key
   ```
   *To get a Gemini API Key (highly recommended, has a generous free tier), visit [Google AI Studio](https://aistudio.google.com/).*

### 4. Customize Bot and Business Context
Open `config.template.json` and configure it for your business template:
*   **`adminNumbers`**: Enter the admin phone numbers allowed to control the bot. Must include the country code without symbols (e.g. `["60123456789"]` for a Malaysian number).
*   **`business`**: Update the name, product, promotional pricing, and background details.
*   **`business.faqs`**: Add common customer questions and answers. The AI will automatically reference these to answer questions accurately.
*   **`systemPrompt`**: Define the bot's tone and personality (e.g. friendly, professional, eager sales agent).

---

## 🏃 Running the Bot (Single vs. Multi-Client)

### Running a Default Single Bot
To run the bot using the default settings:
```bash
npm start
```
If `config.json` does not exist yet, the app will create it automatically from `config.template.json`.

### Running Multiple Client Bots (RM50/month Hosted SaaS Model)
To host the bot for multiple clients simultaneously, run the script with a unique `--id` flag for each client:
```bash
node index.js --id=client_name
```
*Example:*
```bash
node index.js --id=dentist
node index.js --id=carwash
```

**How Multi-Client mode works under the hood:**
1.  **Automatic Config Creation**: If `config-dentist.json` does not exist, the bot will automatically copy `config.template.json` to create it. You can edit the new file to set up client-specific prompts, FAQs, and admin numbers.
2.  **Separate Sessions**: The bot saves session authentication keys in separate folders: `.wwebjs_auth/session-dentist` and `.wwebjs_auth/session-carwash`.
3.  **Shared API Billing**: All clients will run using your single API key configured in `.env` (meaning you pay one central bill, while charging each client RM50/month).

### Scanning the QR Code
1. On startup, a **QR Code** will generate directly in your terminal.
2. Open **WhatsApp** on the client's mobile phone.
3. Tap **Linked Devices** -> **Link a Device**.
4. Scan the QR code in the terminal.
5. Once connected, you will see `Client is ready!` in the terminal.

---

## 🎮 Admin Commands

Designated admins can send commands to the bot directly in WhatsApp. All commands start with a `!` prefix:

| Command | Description |
| :--- | :--- |
| `!status` | Displays whether the bot is active, active AI provider, uptime, and stats. |
| `!pause` | Pauses auto-replies. The bot will ignore new customer messages. |
| `!resume` | Resumes auto-replies. |
| `!reset` | Clears your own conversation memory context. |
| `!reset <phone_number>` | Clears conversation memory for a specific customer JID or phone number. |
| `!setprompt <new prompt>` | Instantly updates the AI system prompt. Saves automatically. |
| `!provider <gemini/openai/openrouter>` | Switches the AI engine between Gemini, OpenAI, and OpenRouter on the fly. |
| `!help` | Lists all available admin commands. |

---

## 💡 Commercial Value & Reselling Tips

This project is structured so it can be easily whitelabeled and sold as a **WhatsApp Automation Service** (SaaS or setup service) to local businesses (e.g., dental clinics, gyms, consultants, e-commerce sellers, property agents).

1.  **Low Operating Costs**: Using Gemini Flash API is virtually free or fraction-of-a-cent per call, making this solution highly profitable to run.
2.  **Lifetime License Offer**: Pitch it to clients at a one-time setup fee (e.g. RM69 to RM199 as used in the sales templates) to get fast adoption.
3.  **Maintenance Plan**: Charge a monthly retainer (e.g., RM20/month) for hosting the bot, updating their FAQ list, and managing the AI.
4.  **Personalized Demos**: Show potential clients how the bot responds to common questions instantly with their business info. The speed and quality of replies are the best selling points.
