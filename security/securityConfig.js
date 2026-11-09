module.exports = {
  // Default Quarantine Role ID from Prohori Bot
  DEFAULT_QUARANTINE_ROLE_ID: "1566167183837626499",

  // --- Security & Anti-Nuke Thresholds ---
  NUKE_CHANNEL_DELETE_LIMIT: 3,
  NUKE_CHANNEL_DELETE_WINDOW: 10000, // 10 seconds

  NUKE_ROLE_DELETE_LIMIT: 3,
  NUKE_ROLE_DELETE_WINDOW: 10000, // 10 seconds

  NUKE_BAN_LIMIT: 3,
  NUKE_BAN_WINDOW: 10000, // 10 seconds

  // --- Anti-Raid Thresholds ---
  RAID_JOIN_LIMIT: 5,
  RAID_JOIN_WINDOW: 5000, // 5 seconds

  // --- Antispam & Cross-Channel Blast Thresholds ---
  SPAM_MESSAGE_LIMIT: 5,
  SPAM_TIME_WINDOW: 3000, // 3 seconds

  CROSS_CHANNEL_LIMIT: 3,
  CROSS_CHANNEL_WINDOW: 8000, // 8 seconds

  // --- Severe Automod (Phishing, Scams & Compromised Account Payloads) ---
  COMPILED_PHISHING_REGEX: [
    /(?:discord|discorcl|dlscord|discrod|disscord|discort|discorb|d1scord)[\w-]*\.(?:com|gift|net|org|xyz|ru|info|app|co|cc|top|click|link)\/[a-zA-Z0-9]+/i,
    /(?:free-nitro|nitro-discord|discordnitro|get-nitro|discordgift|discord-app|nitro-gift)[\w-]*\.(?:com|net|gift|xyz|org|app|click)/i,
    /(?:steamcommunnity|steamcomminuty|steamcommunitys|steam-trade)[\w-]*\.(?:com|net|org|xyz|gift)/i,
    /grabify\.link|iplogger\.org|2no\.co|blasze\.com/i,
    /bit\.ly\/[a-zA-Z0-9]+|tinyurl\.com\/[a-zA-Z0-9]+/i
  ],

  COMPILED_CRYPTO_REGEX: [
    /(?:crypto|cryptocurrency)\s*casino/i,
    /launch of my (?:very )?own (?:crypto|casino|cryptocurrency)/i,
    /giving away \$\d+(?:,\d+)?\s*(?:to everyone|everyone)/i,
    /withdraw (?:the )?bonus (?:immediately|instantly)/i,
    /withdrawal (?:success|successful)/i,
    /activate code for bonus/i,
    /promo code.*(?:bonus|receive)/i,
    /\b(?:mrbeast|kai\s*cenat|elon\s*musk|beast\s*games)\b.*(?:casino|crypto|giveaway|\$\d+)/i,
    /(?:usdt|btc|eth).*(?:withdrawal|deposited|giveaway|\$\d{3,})/i,
    /\$\d{3,}.*withdrawal success/i,
    /rake\s*back\s*percent/i,
    /select crypto to withdraw/i
  ],

  // Anti-Invite Regex
  COMPILED_INVITE_REGEX: /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li)|discord(?:app)?\.com\/invite)\/[a-zA-Z0-9-]+/i,

  // High-severity blacklisted terms
  BLACKLISTED_WORDS: [
    "free nitro",
    "discord nitro for free",
    "steam gift card free",
    "grabify",
    "token grabber",
    "t.me/joinchat"
  ],

  // Embed Colors
  COLOR_SUCCESS: 0x57F287,    // Green
  COLOR_WARNING: 0xFEE75C,    // Yellow
  COLOR_DANGER: 0xED4245,     // Red
  COLOR_QUARANTINE: 0xE67E22, // Dark Orange
  COLOR_INFO: 0x5865F2,       // Blurple
  COLOR_NEUTRAL: 0x2B2D31     // Dark Gray
};
