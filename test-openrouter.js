const { OpenAI } = require("openai");
require("dotenv").config();

const openrouterKey = process.env.OPENROUTER_API_KEY;
console.log("Using API Key:", openrouterKey ? openrouterKey.substring(0, 10) + "..." : "undefined");

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: openrouterKey,
});

async function main() {
  const model = "deepseek/deepseek-v4-flash";
  console.log(`Sending request to OpenRouter using model "${model}"...`);
  const start = Date.now();
  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: "Hello! Reply with 'Hello' in 1 word." }]
    });
    console.log("Response:", response.choices[0].message.content);
    console.log(`Success! Time taken: ${Date.now() - start}ms`);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
