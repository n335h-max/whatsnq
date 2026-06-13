const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "data", "conversations.db");
let db = null;

/**
 * Convert db.exec() result rows to clean objects.
 * db.exec returns [{columns: string[], values: any[][]}]
 */
function rowsToObjects(execResult) {
  if (!execResult || execResult.length === 0) return [];
  const { columns, values } = execResult[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

/**
 * Save in-memory DB to disk.
 */
function persist() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error("[Database] Persist error:", err.message);
  }
}

async function init() {
  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL mode for better concurrent read/write performance
  db.run("PRAGMA journal_mode = WAL");

  // Create conversations table
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      contact_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Index for fast lookups per contact
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_conversations_lookup
      ON conversations(client_id, contact_id, created_at)
  `);

  persist();
  console.log(`[Database] Initialized at ${DB_PATH}`);
  return db;
}

/**
 * Fetch recent conversation history for a contact.
 * Returns array of { role, content } ordered oldest-first (for the AI prompt).
 */
function getHistory(clientId, contactId, limit = 10) {
  if (!db) throw new Error("Database not initialized. Call init() first.");
  const stmt = db.prepare(`
    SELECT role, content FROM conversations
    WHERE client_id = ? AND contact_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  stmt.bind([clientId, contactId, limit]);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows.reverse(); // oldest-first for AI context
}

/**
 * Store a message in the conversation history.
 */
function addMessage(clientId, contactId, role, content) {
  if (!db) throw new Error("Database not initialized. Call init() first.");
  const stmt = db.prepare(`
    INSERT INTO conversations (client_id, contact_id, role, content)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run([clientId, contactId, role, content]);
  stmt.free();
  persist(); // Save to disk after each write
}

/**
 * Delete all conversation history for a specific contact.
 */
function resetHistory(clientId, contactId) {
  if (!db) throw new Error("Database not initialized. Call init() first.");
  const stmt = db.prepare(`
    DELETE FROM conversations
    WHERE client_id = ? AND contact_id = ?
  `);
  stmt.run([clientId, contactId]);
  stmt.free();
  persist();
}

/**
 * Delete ALL conversation data for a client (used when deleting a client).
 */
function deleteClientHistory(clientId) {
  if (!db) throw new Error("Database not initialized. Call init() first.");
  const stmt = db.prepare("DELETE FROM conversations WHERE client_id = ?");
  stmt.run([clientId]);
  stmt.free();
  persist();
}

/**
 * Get total message count for a client (dashboard stats).
 */
function getMessageCount(clientId) {
  if (!db) return 0;
  const rows = rowsToObjects(db.exec(`
    SELECT COUNT(*) as count FROM conversations WHERE client_id = '${clientId.replace(/'/g, "''")}'
  `));
  return rows.length > 0 ? rows[0].count : 0;
}

/**
 * Get total message count across all clients.
 */
function getTotalMessageCount() {
  if (!db) return 0;
  const rows = rowsToObjects(db.exec("SELECT COUNT(*) as count FROM conversations"));
  return rows.length > 0 ? rows[0].count : 0;
}

/**
 * Get distinct contacts that have conversations for a client.
 */
function getContacts(clientId) {
  if (!db) return [];
  return rowsToObjects(db.exec(`
    SELECT contact_id, COUNT(*) as message_count,
           MIN(created_at) as first_seen, MAX(created_at) as last_seen
    FROM conversations
    WHERE client_id = '${clientId.replace(/'/g, "''")}'
    GROUP BY contact_id
    ORDER BY last_seen DESC
  `));
}

/**
 * Get the most recent conversations across all clients (for admin overview).
 */
function getAllConversations(limit = 50) {
  if (!db) return [];
  return rowsToObjects(db.exec(`
    SELECT client_id, contact_id, COUNT(*) as message_count,
           MIN(created_at) as first_seen, MAX(created_at) as last_seen
    FROM conversations
    GROUP BY client_id, contact_id
    ORDER BY last_seen DESC
    LIMIT ${parseInt(limit)}
  `));
}

/**
 * Search conversation content across all clients.
 */
function searchConversations(query, limit = 50, clientId = "") {
  if (!db) return [];
  const safe = query.replace(/'/g, "''");
  const safeClientId = clientId.replace(/'/g, "''");
  const clientFilter = safeClientId ? `c.client_id = '${safeClientId}' AND` : "";
  const searchFilter = safe
    ? `EXISTS (
      SELECT 1
      FROM conversations c2
      WHERE c2.client_id = c.client_id
        AND c2.contact_id = c.contact_id
        AND c2.content LIKE '%${safe}%'
    )`
    : "1=1";
  return rowsToObjects(db.exec(`
    SELECT c.client_id, c.contact_id, COUNT(*) as message_count,
           MIN(c.created_at) as first_seen, MAX(c.created_at) as last_seen
    FROM conversations c
    WHERE ${clientFilter} ${searchFilter}
    GROUP BY c.client_id, c.contact_id
    ORDER BY last_seen DESC
    LIMIT ${parseInt(limit)}
  `));
}

/**
 * Close the database connection gracefully.
 */
function close() {
  if (db) {
    persist();
    db.close();
    db = null;
    console.log("[Database] Connection closed.");
  }
}

module.exports = { init, getHistory, addMessage, resetHistory, deleteClientHistory, getMessageCount, getTotalMessageCount, getContacts, getAllConversations, searchConversations, close };
