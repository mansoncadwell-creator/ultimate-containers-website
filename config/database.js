const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const defaultDir = path.join(__dirname, '..', 'data');
const dbPath = process.env.DB_PATH || path.join(defaultDir, 'ultimate-containers.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
CREATE TABLE IF NOT EXISTS admins (
 id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
 last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS quotations (
 id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT NOT NULL,
 customer_email TEXT NOT NULL, container_type TEXT NOT NULL,
 customer_phone TEXT NOT NULL DEFAULT '', preferred_size TEXT, quantity INTEGER NOT NULL,
 condition_preference TEXT, delivery_city TEXT NOT NULL,
 delivery_country TEXT NOT NULL, timeframe TEXT, additional_info TEXT,
 privacy_consent INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','quoted','completed','archived')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quotes_status_created ON quotations(status, created_at);
CREATE INDEX IF NOT EXISTS idx_quotes_email ON quotations(customer_email);
CREATE TABLE IF NOT EXISTS reviews (
 id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT NOT NULL,
 customer_email TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 review_text TEXT NOT NULL, processing_consent INTEGER NOT NULL DEFAULT 0,
 processing_consent_at TEXT, display_consent INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','hidden','rejected')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_status_created ON reviews(status, created_at);
CREATE TABLE IF NOT EXISTS quotation_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER NOT NULL,
 quotation_id INTEGER, action TEXT NOT NULL, detail TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 FOREIGN KEY(admin_id) REFERENCES admins(id), FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS review_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER NOT NULL,
 review_id INTEGER, action TEXT NOT NULL, detail TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 FOREIGN KEY(admin_id) REFERENCES admins(id), FOREIGN KEY(review_id) REFERENCES reviews(id) ON DELETE SET NULL
);
`);

try {
  db.exec("ALTER TABLE quotations ADD COLUMN customer_phone TEXT NOT NULL DEFAULT ''");
} catch (err) {
  if (!err.message.includes('duplicate column name')) throw err;
}

module.exports = db;