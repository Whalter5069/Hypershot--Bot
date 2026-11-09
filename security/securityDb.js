const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "security.db");
const db = new Database(dbPath);

// Enable WAL mode for high performance
db.pragma("journal_mode = WAL");

// Initialize tables matching Prohori Bot architecture
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    quarantine_role_id TEXT,
    quarantine_channel_id TEXT,
    mod_log_channel_id TEXT,
    verified_role_id TEXT,
    verification_channel_id TEXT,
    anti_nuke_enabled INTEGER DEFAULT 1,
    anti_raid_enabled INTEGER DEFAULT 1,
    anti_spam_enabled INTEGER DEFAULT 1,
    automod_enabled INTEGER DEFAULT 1,
    anti_invite_enabled INTEGER DEFAULT 1,
    anti_webhook_enabled INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS quarantined_users (
    guild_id TEXT,
    user_id TEXT,
    saved_roles TEXT NOT NULL,
    reason TEXT,
    quarantined_at TEXT NOT NULL,
    quarantined_by TEXT,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS mod_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    target_id TEXT,
    moderator_id TEXT,
    action TEXT,
    reason TEXT,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS whitelist (
    guild_id TEXT,
    target_id TEXT,
    target_type TEXT NOT NULL,
    added_by TEXT,
    added_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, target_id)
  );
`);

module.exports = {
  db,

  getGuildSettings(guildId) {
    const row = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(String(guildId));
    return row || null;
  },

  updateGuildSettings(guildId, settings = {}) {
    const gId = String(guildId);
    db.prepare("INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)").run(gId);
    const keys = Object.keys(settings);
    if (keys.length === 0) return;

    const setClauses = keys.map(k => `${k} = ?`).join(", ");
    const values = keys.map(k => settings[k]);
    values.push(gId);

    db.prepare(`UPDATE guild_settings SET ${setClauses} WHERE guild_id = ?`).run(...values);
  },

  saveQuarantinedUser(guildId, userId, roleIds, reason, quarantinedBy) {
    const rolesJson = JSON.stringify(roleIds);
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO quarantined_users (guild_id, user_id, saved_roles, reason, quarantined_at, quarantined_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(String(guildId), String(userId), rolesJson, reason || "No reason", nowIso, String(quarantinedBy || "0"));
  },

  getQuarantinedUser(guildId, userId) {
    const row = db.prepare("SELECT * FROM quarantined_users WHERE guild_id = ? AND user_id = ?").get(String(guildId), String(userId));
    if (!row) return null;
    try {
      row.saved_roles = JSON.parse(row.saved_roles);
    } catch {
      row.saved_roles = [];
    }
    return row;
  },

  removeQuarantinedUser(guildId, userId) {
    const record = this.getQuarantinedUser(guildId, userId);
    if (!record) return null;
    db.prepare("DELETE FROM quarantined_users WHERE guild_id = ? AND user_id = ?").run(String(guildId), String(userId));
    return record.saved_roles;
  },

  isUserQuarantined(guildId, userId) {
    const row = db.prepare("SELECT 1 FROM quarantined_users WHERE guild_id = ? AND user_id = ?").get(String(guildId), String(userId));
    return !!row;
  },

  logModAction(guildId, targetId, moderatorId, action, reason) {
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO mod_logs (guild_id, target_id, moderator_id, action, reason, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(String(guildId), String(targetId), String(moderatorId), action, reason || "", nowIso);
  },

  addWhitelist(guildId, targetId, targetType, addedBy) {
    const nowIso = new Date().toISOString();
    try {
      db.prepare(`
        INSERT OR REPLACE INTO whitelist (guild_id, target_id, target_type, added_by, added_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(String(guildId), String(targetId), targetType, String(addedBy), nowIso);
      return true;
    } catch (e) {
      console.error("Error adding whitelist:", e);
      return false;
    }
  },

  removeWhitelist(guildId, targetId) {
    const res = db.prepare("DELETE FROM whitelist WHERE guild_id = ? AND target_id = ?").run(String(guildId), String(targetId));
    return res.changes > 0;
  },

  isWhitelisted(guildId, targetId, roleIds = []) {
    const gId = String(guildId);
    const tId = String(targetId);

    // 1. Direct user / bot whitelist check
    const userRow = db.prepare("SELECT 1 FROM whitelist WHERE guild_id = ? AND target_id = ?").get(gId, tId);
    if (userRow) return true;

    // 2. Role whitelist check
    if (roleIds && roleIds.length > 0) {
      const placeholders = roleIds.map(() => "?").join(",");
      const roleRow = db.prepare(`SELECT 1 FROM whitelist WHERE guild_id = ? AND target_id IN (${placeholders})`).get(gId, ...roleIds.map(String));
      if (roleRow) return true;
    }

    return false;
  },

  getWhitelist(guildId) {
    return db.prepare("SELECT target_id, target_type, added_by, added_at FROM whitelist WHERE guild_id = ?").all(String(guildId));
  }
};

