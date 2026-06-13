/**
 * Telegram Notifier — sends lead alerts to the business owner's personal Telegram
 * Each business creates their own bot via @BotFather and enters the token + chat ID in the dashboard.
 */
const https = require("https");
const { URL } = require("url");

/**
 * Send a Telegram message using the bot token and chat ID from config
 * @param {string} botToken - Telegram bot token from @BotFather
 * @param {string|number} chatId - Business owner's Telegram chat ID
 * @param {string} message - The message to send
 * @returns {Promise<boolean>} - true if sent successfully
 */
function sendTelegram(botToken, chatId, message) {
  return new Promise((resolve) => {
    if (!botToken || !chatId) {
      resolve(false);
      return;
    }

    const url = new URL(`https://api.telegram.org/bot${botToken}/sendMessage`);
    url.searchParams.set("chat_id", chatId);
    url.searchParams.set("text", message);
    url.searchParams.set("parse_mode", "HTML");

    const req = https.get(url.toString(), (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json.ok === true);
        } catch {
          resolve(false);
        }
      });
    });

    req.on("error", () => resolve(false));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Format a lead notification message
 */
function formatLeadMessage(clientId, businessName, contactName, phone, email, message, orderDetails, source) {
  const title = source === "handover" ? "🚨 HANDOVER REQUESTED" : "🆕 NEW LEAD";
  return `<b>${title}</b>\n` +
    `━━━━━━━━━━━━━━━\n` +
    `<b>🏪 Bot:</b> ${businessName || clientId}\n` +
    `<b>👤 Contact:</b> ${contactName}\n` +
    `${phone ? `<b>📞 Phone:</b> ${phone}\n` : ""}` +
    `${email ? `<b>📧 Email:</b> ${email}\n` : ""}` +
    `${message ? `<b>💬 Last Msg:</b> ${message.substring(0, 200)}\n` : ""}` +
    `${orderDetails ? `<b>📋 Order:</b> ${orderDetails}\n` : ""}` +
    `━━━━━━━━━━━━━━━\n` +
    `<i>Sent by WhatsApp AI Bot • ${new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}</i>`;
}

module.exports = { sendTelegram, formatLeadMessage };