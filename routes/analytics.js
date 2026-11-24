const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');

const router = express.Router();

db.exec(`
CREATE TABLE IF NOT EXISTS analytics_visitors (
  visitor_id TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  total_visits INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analytics_sessions (
  session_id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  page_views INTEGER NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL DEFAULT 'unknown'
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  page_path TEXT NOT NULL DEFAULT '/',
  event_name TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT 'unknown',
  referrer_domain TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created
ON analytics_events(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type
ON analytics_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_page
ON analytics_events(page_path, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_last_seen
ON analytics_sessions(last_seen);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor
ON analytics_sessions(visitor_id);
`);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});

const validId = value =>
  typeof value === 'string' &&
  /^[a-f0-9-]{36}$/i.test(value);

const allowedDevices = ['mobile', 'tablet', 'desktop'];

router.post('/track', limiter, (req, res) => {
  try {
    const body = req.body || {};

    const visitorId = String(body.visitor_id || '');
    const sessionId = String(body.session_id || '');

    if (!validId(visitorId) || !validId(sessionId)) {
      return res.status(400).json({ success: false });
    }

    const pagePath = String(body.page_path || '/').slice(0, 300);

    if (!pagePath.startsWith('/') || pagePath.startsWith('//')) {
      return res.status(400).json({ success: false });
    }

    const device = allowedDevices.includes(body.device_type)
      ? body.device_type
      : 'unknown';

    let referrerDomain = '';

    try {
      if (body.referrer) {
        referrerDomain = new URL(String(body.referrer)).hostname.slice(0, 150);
      }
    } catch (_) {}

    db.prepare(`
      INSERT OR IGNORE INTO analytics_visitors (visitor_id)
      VALUES (?)
    `).run(visitorId);

    const sessionResult = db.prepare(`
      INSERT OR IGNORE INTO analytics_sessions
      (session_id, visitor_id, device_type)
      VALUES (?, ?, ?)
    `).run(sessionId, visitorId, device);

    db.prepare(`
      UPDATE analytics_sessions
      SET last_seen = datetime('now'),
          page_views = page_views + 1
      WHERE session_id = ?
    `).run(sessionId);

    db.prepare(`
      UPDATE analytics_visitors
      SET last_seen = datetime('now'),
          total_visits = total_visits + ?
      WHERE visitor_id = ?
    `).run(sessionResult.changes ? 1 : 0, visitorId);

    db.prepare(`
      INSERT INTO analytics_events
      (visitor_id, session_id, event_type, page_path, event_name, device_type, referrer_domain)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      visitorId,
      sessionId,
      'page_view',
      pagePath,
      'page_view',
      device,
      referrerDomain
    );

    res.json({ success: true });

  } catch (err) {
    console.error('Analytics tracking error:', err.message);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
