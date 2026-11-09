const {
  Events,
  AuditLogEvent,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");
const config = require("./securityConfig");
const db = require("./securityDb");
const { executeQuarantine, sendModLog, getQuarantineRole } = require("./quarantine");

// Sliding window trackers
const channelDeletions = new Map(); // key -> timestamps array
const roleDeletions = new Map();
const banActions = new Map();
const recentJoins = new Map(); // guildId -> [{ member, time }]
const userMessageTimes = new Map(); // `${guildId}_${userId}` -> timestamps array
const userChannelActivity = new Map(); // `${guildId}_${userId}` -> [{ channelId, time, messageId }]

// Cleanup interval to avoid memory growth
setInterval(() => {
  const now = Date.now();
  for (const [k, times] of channelDeletions.entries()) {
    const valid = times.filter(t => now - t < 30000);
    if (valid.length === 0) channelDeletions.delete(k);
    else channelDeletions.set(k, valid);
  }
  for (const [k, times] of roleDeletions.entries()) {
    const valid = times.filter(t => now - t < 30000);
    if (valid.length === 0) roleDeletions.delete(k);
    else roleDeletions.set(k, valid);
  }
  for (const [k, times] of banActions.entries()) {
    const valid = times.filter(t => now - t < 30000);
    if (valid.length === 0) banActions.delete(k);
    else banActions.set(k, valid);
  }
  for (const [guildId, joins] of recentJoins.entries()) {
    const valid = joins.filter(j => now - j.time < 15000);
    if (valid.length === 0) recentJoins.delete(guildId);
    else recentJoins.set(guildId, valid);
  }
  for (const [k, times] of userMessageTimes.entries()) {
    const valid = times.filter(t => now - t < 10000);
    if (valid.length === 0) userMessageTimes.delete(k);
    else userMessageTimes.set(k, valid);
  }
  for (const [k, acts] of userChannelActivity.entries()) {
    const valid = acts.filter(a => now - a.time < 20000);
    if (valid.length === 0) userChannelActivity.delete(k);
    else userChannelActivity.set(k, valid);
  }
}, 60000);

async function handleAntiNukeAction(guild, actor, actionType, tracker, limit, windowMs, client) {
  if (!guild || !actor) return;
  if (actor.id === guild.ownerId || actor.id === client.user.id) return;

  const member = await guild.members.fetch(actor.id).catch(() => null);
  const roleIds = member ? Array.from(member.roles.cache.keys()) : [];
  if (db.isWhitelisted(guild.id, actor.id, roleIds)) return;

  const key = `${guild.id}_${actor.id}`;
  const now = Date.now();
  const times = tracker.get(key) || [];
  const validTimes = times.filter(t => now - t < windowMs);
  validTimes.push(now);
  tracker.set(key, validTimes);

  if (validTimes.length >= limit) {
    tracker.delete(key);
    const reason = `Anti-Nuke Trigger: Mass ${actionType} (${limit} actions within ${Math.round(windowMs / 1000)}s)`;

    let quarantined = false;
    if (member) {
      const res = await executeQuarantine(guild, member, reason, client.user.id, "ANTI-NUKE LOCKDOWN");
      quarantined = res.success;
      if (!quarantined) {
        try {
          await member.kick(reason);
        } catch {}
      }
    }

    const emergencyEmbed = new EmbedBuilder()
      .setColor(config.COLOR_DANGER)
      .setTitle("🚨 CRITICAL SECURITY ALERT: ANTI-NUKE TRIGGERED")
      .setDescription(
        `**Offending User:** <@${actor.id}> (\`${actor.tag || actor.id}\` / \`${actor.id}\`)\n` +
        `**Action Category:** Mass ${actionType}\n` +
        `**Velocity:** ${limit} actions in < ${Math.round(windowMs / 1000)} seconds\n` +
        `**Containment Action:** ${quarantined ? "Quarantined" : "Emergency Lockdown / Kick Attempt"}\n\n` +
        `⚠️ <@${guild.ownerId}> Server integrity protected. Offender isolated.`
      )
      .setThumbnail(actor.displayAvatarURL ? actor.displayAvatarURL({ dynamic: true }) : null)
      .setTimestamp();

    await sendModLog(guild, emergencyEmbed);
  }
}

function registerSecurityListeners(client) {
  // 1. Anti-Nuke: Channel Delete
  client.on(Events.ChannelDelete, async channel => {
    try {
      const guild = channel.guild;
      if (!guild) return;
      const settings = db.getGuildSettings(guild.id);
      if (settings && settings.anti_nuke_enabled === 0) return;

      const audit = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.ChannelDelete }).catch(() => null);
      if (!audit) return;

      const entry = audit.entries.find(e => e.targetId === channel.id || (Date.now() - e.createdTimestamp < 5000));
      if (entry && entry.executor) {
        await handleAntiNukeAction(guild, entry.executor, "Channel Deletion", channelDeletions, config.NUKE_CHANNEL_DELETE_LIMIT, config.NUKE_CHANNEL_DELETE_WINDOW, client);
      }
    } catch (e) {
      console.error("Error in ChannelDelete anti-nuke:", e);
    }
  });

  // 2. Anti-Nuke: Role Delete
  client.on(Events.GuildRoleDelete, async role => {
    try {
      const guild = role.guild;
      if (!guild) return;
      const settings = db.getGuildSettings(guild.id);
      if (settings && settings.anti_nuke_enabled === 0) return;

      const audit = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.RoleDelete }).catch(() => null);
      if (!audit) return;

      const entry = audit.entries.find(e => e.targetId === role.id || (Date.now() - e.createdTimestamp < 5000));
      if (entry && entry.executor) {
        await handleAntiNukeAction(guild, entry.executor, "Role Deletion", roleDeletions, config.NUKE_ROLE_DELETE_LIMIT, config.NUKE_ROLE_DELETE_WINDOW, client);
      }
    } catch (e) {
      console.error("Error in RoleDelete anti-nuke:", e);
    }
  });

  // 3. Anti-Nuke: Member Ban
  client.on(Events.GuildBanAdd, async ban => {
    try {
      const guild = ban.guild;
      if (!guild) return;
      const settings = db.getGuildSettings(guild.id);
      if (settings && settings.anti_nuke_enabled === 0) return;

      const audit = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
      if (!audit) return;

      const entry = audit.entries.find(e => e.targetId === ban.user.id || (Date.now() - e.createdTimestamp < 5000));
      if (entry && entry.executor) {
        await handleAntiNukeAction(guild, entry.executor, "Member Ban", banActions, config.NUKE_BAN_LIMIT, config.NUKE_BAN_WINDOW, client);
      }
    } catch (e) {
      console.error("Error in GuildBanAdd anti-nuke:", e);
    }
  });

  // 4. Anti-Raid: Mass Join Velocity
  client.on(Events.GuildMemberAdd, async member => {
    try {
      const guild = member.guild;
      if (!guild) return;
      const settings = db.getGuildSettings(guild.id);
      if (settings && settings.anti_raid_enabled === 0) return;

      const now = Date.now();
      const joins = recentJoins.get(guild.id) || [];
      const validJoins = joins.filter(j => now - j.time < config.RAID_JOIN_WINDOW);
      validJoins.push({ member, time: now });
      recentJoins.set(guild.id, validJoins);

      if (validJoins.length >= config.RAID_JOIN_LIMIT) {
        const reason = `Anti-Raid: Mass join velocity detected (${validJoins.length} joins in ${Math.round(config.RAID_JOIN_WINDOW / 1000)}s)`;

        for (const item of validJoins) {
          if (!db.isUserQuarantined(guild.id, item.member.id)) {
            await executeQuarantine(guild, item.member, reason, client.user.id, "ANTI-RAID ENGINE");
          }
        }

        const raidEmbed = new EmbedBuilder()
          .setColor(config.COLOR_DANGER)
          .setTitle("🛡️ Anti-Raid Defense Activated")
          .setDescription(
            `**Detected Velocity:** ${validJoins.length} joins in < ${Math.round(config.RAID_JOIN_WINDOW / 1000)} seconds.\n` +
            `**Action:** Quarantined joining accounts immediately.\n` +
            `Server entered lockdown state for joining accounts.`
          )
          .setTimestamp();

        await sendModLog(guild, raidEmbed);
      }
    } catch (e) {
      console.error("Error in Anti-Raid handler:", e);
    }
  });

  // 5. Anti-Message (Compromised Account, Automod, Antispam, Anti-Invite)
  client.on(Events.MessageCreate, async message => {
    try {
      if (!message.guild || message.author.bot) return;

      const guild = message.guild;
      const author = message.author;
      const member = message.member || await guild.members.fetch(author.id).catch(() => null);
      const roleIds = member ? Array.from(member.roles.cache.keys()) : [];

      // Whitelist bypass
      if (db.isWhitelisted(guild.id, author.id, roleIds)) return;

      const settings = db.getGuildSettings(guild.id);
      const content = message.content || "";
      const contentLower = content.toLowerCase();
      const hasAttachments = message.attachments.size > 0;
      const hasLinks = contentLower.includes("http://") || contentLower.includes("https://");
      const hasEveryonePing = message.mentions.everyone || content.includes("@everyone") || content.includes("@here");

      // -------------------------------------------------------------
      // (A) COMPROMISED ACCOUNT: UNAUTHORIZED @EVERYONE WITH MEDIA/LINKS
      // -------------------------------------------------------------
      if (hasEveryonePing && (hasAttachments || hasLinks)) {
        await message.delete().catch(() => {});
        if (member) {
          await executeQuarantine(guild, member, "Compromised Account: Unauthorized @everyone mass mention with media/scam links", client.user.id, "SECURITY SHIELD");
        }
        const alert = await message.channel.send(`🚨 ${author} was automatically quarantined for compromised account behavior (unauthorized @everyone media spam).`).catch(() => null);
        if (alert) setTimeout(() => alert.delete().catch(() => {}), 7000);
        return;
      }

      // -------------------------------------------------------------
      // (B) CRYPTO CASINO & CELEBRITY GIVEAWAY SCAMS
      // -------------------------------------------------------------
      let matchedCrypto = false;
      for (const rx of config.COMPILED_CRYPTO_REGEX) {
        if (rx.test(content)) {
          matchedCrypto = true;
          break;
        }
      }

      if (matchedCrypto) {
        await message.delete().catch(() => {});
        if (member) {
          await executeQuarantine(guild, member, "Compromised Account: High-severity Crypto Casino / Celebrity Giveaway Scam detected", client.user.id, "AUTOMOD SHIELD");
        }
        const alert = await message.channel.send(`🚨 ${author} was quarantined for posting fraudulent cryptocurrency/casino scams.`).catch(() => null);
        if (alert) setTimeout(() => alert.delete().catch(() => {}), 7000);
        return;
      }

      // -------------------------------------------------------------
      // (C) CROSS-CHANNEL BLAST RAID
      // -------------------------------------------------------------
      const now = Date.now();
      const chanKey = `${guild.id}_${author.id}`;
      const acts = userChannelActivity.get(chanKey) || [];
      const validActs = acts.filter(a => now - a.time < config.CROSS_CHANNEL_WINDOW);
      validActs.push({ channelId: message.channel.id, time: now, messageId: message.id });
      userChannelActivity.set(chanKey, validActs);

      const uniqueChannels = new Set(validActs.map(a => a.channelId));
      const isCrossChannelRaid = uniqueChannels.size >= config.CROSS_CHANNEL_LIMIT || (uniqueChannels.size >= 2 && hasAttachments);

      if (isCrossChannelRaid) {
        await message.delete().catch(() => {});
        if (member) {
          await executeQuarantine(guild, member, `Compromised Account: Cross-channel broadcast raid (${uniqueChannels.size} channels in <${Math.round(config.CROSS_CHANNEL_WINDOW / 1000)}s)`, client.user.id, "SECURITY SHIELD");
        }

        // Purge recent messages across affected channels
        for (const act of validActs) {
          const ch = guild.channels.cache.get(act.channelId);
          if (ch && ch.isTextBased()) {
            ch.messages.delete(act.messageId).catch(() => {});
          }
        }
        userChannelActivity.delete(chanKey);

        const alert = await message.channel.send(`🚨 ${author} was auto-quarantined for cross-channel spam blasting (compromised account).`).catch(() => null);
        if (alert) setTimeout(() => alert.delete().catch(() => {}), 7000);
        return;
      }

      // -------------------------------------------------------------
      // (D) ANTI-INVITE SCANNER
      // -------------------------------------------------------------
      if (!settings || settings.anti_invite_enabled !== 0) {
        if (config.COMPILED_INVITE_REGEX.test(content)) {
          await message.delete().catch(() => {});
          if (member) {
            await executeQuarantine(guild, member, "Anti-Invite: Unauthorized Discord Server Invite link posted", client.user.id, "SECURITY SHIELD");
          }
          const alert = await message.channel.send(`🚨 ${author} was quarantined for posting unauthorized Discord server invites.`).catch(() => null);
          if (alert) setTimeout(() => alert.delete().catch(() => {}), 7000);
          return;
        }
      }

      // -------------------------------------------------------------
      // (E) SEVERE AUTOMOD (Phishing & Blacklisted words)
      // -------------------------------------------------------------
      if (!settings || settings.automod_enabled !== 0) {
        let triggeredReason = null;
        for (const rx of config.COMPILED_PHISHING_REGEX) {
          if (rx.test(content)) {
            triggeredReason = "Malicious phishing / scam URL detected";
            break;
          }
        }
        if (!triggeredReason) {
          for (const word of config.BLACKLISTED_WORDS) {
            if (contentLower.includes(word.toLowerCase())) {
              triggeredReason = `Blacklisted phrase detected: '${word}'`;
              break;
            }
          }
        }

        if (triggeredReason) {
          await message.delete().catch(() => {});
          if (member) {
            await executeQuarantine(guild, member, `Severe Automod: ${triggeredReason}`, client.user.id, "AUTOMOD SHIELD");
          }
          const alert = await message.channel.send(`🚨 ${author} was quarantined for posting prohibited/malicious content.`).catch(() => null);
          if (alert) setTimeout(() => alert.delete().catch(() => {}), 7000);
          return;
        }
      }

      // -------------------------------------------------------------
      // (F) ANTISPAM RATE LIMITER (>5 messages in 3 seconds)
      // -------------------------------------------------------------
      if (!settings || settings.anti_spam_enabled !== 0) {
        if (author.id !== guild.ownerId) {
          const spamKey = `${guild.id}_${author.id}`;
          const times = userMessageTimes.get(spamKey) || [];
          const validTimes = times.filter(t => now - t < config.SPAM_TIME_WINDOW);
          validTimes.push(now);
          userMessageTimes.set(spamKey, validTimes);

          if (validTimes.length >= config.SPAM_MESSAGE_LIMIT) {
            userMessageTimes.delete(spamKey);

            let deletedCount = 0;
            if (message.channel && message.channel.isTextBased()) {
              try {
                const fetched = await message.channel.messages.fetch({ limit: 25 });
                const spamMsgs = fetched.filter(m => m.author.id === author.id && now - m.createdTimestamp < config.SPAM_TIME_WINDOW + 2000);
                const purged = await message.channel.bulkDelete(spamMsgs, true);
                deletedCount = purged.size;
              } catch {
                await message.delete().catch(() => {});
                deletedCount = 1;
              }
            }

            if (member) {
              const reason = `Antispam: Exceeded rate limit (sent >= ${config.SPAM_MESSAGE_LIMIT} messages in ${Math.round(config.SPAM_TIME_WINDOW / 1000)}s). Purged ${deletedCount} message(s).`;
              await executeQuarantine(guild, member, reason, client.user.id, "ANTISPAM SHIELD");
            }

            const alert = await message.channel.send(`🛑 ${author} was quarantined for rapid spamming. **${deletedCount} spam message(s) deleted.**`).catch(() => null);
            if (alert) setTimeout(() => alert.delete().catch(() => {}), 7000);
          }
        }
      }
    } catch (e) {
      console.error("Error in MessageCreate security:", e);
    }
  });

  // 6. Anti-Webhook: Unauthorized creation
  client.on(Events.WebhooksUpdate, async channel => {
    try {
      const guild = channel.guild;
      if (!guild) return;
      const settings = db.getGuildSettings(guild.id);
      if (settings && settings.anti_webhook_enabled === 0) return;

      const audit = await guild.fetchAuditLogs({ limit: 2, type: AuditLogEvent.WebhookCreate }).catch(() => null);
      if (!audit) return;

      const entry = audit.entries.find(e => Date.now() - e.createdTimestamp < 5000);
      if (!entry || !entry.executor) return;

      const actor = entry.executor;
      if (actor.id === guild.ownerId || actor.id === client.user.id) return;

      const member = await guild.members.fetch(actor.id).catch(() => null);
      const roleIds = member ? Array.from(member.roles.cache.keys()) : [];
      if (db.isWhitelisted(guild.id, actor.id, roleIds)) return;

      // Delete unauthorized webhook
      if (channel.fetchWebhooks) {
        const hooks = await channel.fetchWebhooks().catch(() => null);
        if (hooks) {
          for (const hook of hooks.values()) {
            if (hook.owner && hook.owner.id === actor.id) {
              await hook.delete("Anti-Webhook: Unauthorized creation intercepted").catch(() => {});
            }
          }
        }
      }

      if (member) {
        await executeQuarantine(guild, member, "Anti-Webhook Trigger: Unauthorized webhook creation intercepted", client.user.id, "ANTI-WEBHOOK SHIELD");
      }

      const logEmbed = new EmbedBuilder()
        .setColor(config.COLOR_DANGER)
        .setTitle("🚨 Security Event: Unauthorized Webhook Intercepted")
        .setDescription(
          `**Actor:** <@${actor.id}> (\`${actor.tag || actor.id}\` / \`${actor.id}\`)\n` +
          `**Channel:** ${channel}\n` +
          `**Action:** Webhook deleted and creator quarantined.`
        )
        .setTimestamp();

      await sendModLog(guild, logEmbed);
    } catch (e) {
      console.error("Error in WebhooksUpdate:", e);
    }
  });

  // 7. Ghost Ping Detection
  client.on(Events.MessageDelete, async message => {
    try {
      if (!message.guild || message.author?.bot) return;

      const hasMentions =
        message.mentions.everyone ||
        (message.mentions.users && message.mentions.users.size > 0) ||
        (message.mentions.roles && message.mentions.roles.size > 0);

      if (hasMentions) {
        const embed = new EmbedBuilder()
          .setColor(config.COLOR_WARNING)
          .setTitle("👻 Ghost Ping Detected")
          .setDescription(
            `**Author:** <@${message.author.id}> (\`${message.author.id}\`)\n` +
            `**Channel:** ${message.channel}\n` +
            `**Content:**\n${message.content || "*[No text / Embed or Attachment]*"}`
          )
          .setFooter({ text: "A message containing mentions was deleted." })
          .setTimestamp();

        await sendModLog(message.guild, embed);
      }
    } catch (e) {
      console.error("Error in MessageDelete ghost ping:", e);
    }
  });
}

// Slash command: /security_status
const securityStatusCommand = {
  data: new SlashCommandBuilder()
    .setName("security_status")
    .setDescription("Displays the live defense matrix and active security modules for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const guild = interaction.guild;
    const settings = db.getGuildSettings(guild.id) || {};

    const icon = val => (val !== 0 ? "🟢 `ACTIVE`" : "🔴 `DISABLED`");
    const qRoleId = settings.quarantine_role_id || config.DEFAULT_QUARANTINE_ROLE_ID;
    const qRole = guild.roles.cache.get(qRoleId);

    const embed = new EmbedBuilder()
      .setColor(config.COLOR_INFO)
      .setTitle("🛡️ Prohori Security Engine — Defense Matrix")
      .setDescription(`Real-time protection status for **${guild.name}**`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: "1. Anti-Nuke (Channel/Role/Ban Rate Limit)", value: icon(settings.anti_nuke_enabled), inline: true },
        { name: "2. Anti-Raid (Mass Join Velocity)", value: icon(settings.anti_raid_enabled), inline: true },
        { name: "3. Anti-Spam (Burst Rate Limiter)", value: icon(settings.anti_spam_enabled), inline: true },
        { name: "4. Severe Automod & Phishing Filter", value: icon(settings.automod_enabled), inline: true },
        { name: "5. Anti-Hacked Account (Crypto/Casino Raid)", value: "🟢 `ACTIVE` *(Zero Tolerance)*", inline: true },
        { name: "6. Anti-Invite (Server Link Filter)", value: icon(settings.anti_invite_enabled), inline: true },
        { name: "7. Anti-Webhook (Backdoor Blocker)", value: icon(settings.anti_webhook_enabled), inline: true },
        { name: "8. Sticky Quarantine (Anti-Evasion)", value: "🟢 `ACTIVE` *(Persistent)*", inline: true },
        { name: "9. Quarantine Isolation Role", value: qRole ? `${qRole}` : `\`ID: ${qRoleId}\``, inline: true }
      )
      .setFooter({ text: "Use /security_toggle to adjust specific defense modules." })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

// Slash command: /security_toggle
const securityToggleCommand = {
  data: new SlashCommandBuilder()
    .setName("security_toggle")
    .setDescription("Enables or disables a specific security defense engine.")
    .addStringOption(opt =>
      opt.setName("module")
        .setDescription("The security module to toggle")
        .setRequired(true)
        .addChoices(
          { name: "Anti-Nuke", value: "anti_nuke_enabled" },
          { name: "Anti-Raid", value: "anti_raid_enabled" },
          { name: "Anti-Spam", value: "anti_spam_enabled" },
          { name: "Severe Automod", value: "automod_enabled" },
          { name: "Anti-Invite", value: "anti_invite_enabled" },
          { name: "Anti-Webhook", value: "anti_webhook_enabled" }
        )
    )
    .addBooleanOption(opt =>
      opt.setName("enabled")
        .setDescription("Whether this module should be active or inactive")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const moduleKey = interaction.options.getString("module");
    const enabled = interaction.options.getBoolean("enabled");
    const guild = interaction.guild;

    db.updateGuildSettings(guild.id, { [moduleKey]: enabled ? 1 : 0 });

    const stateStr = enabled ? "ENABLED 🟢" : "DISABLED 🔴";
    const embed = new EmbedBuilder()
      .setColor(enabled ? config.COLOR_SUCCESS : config.COLOR_WARNING)
      .setTitle("🛡️ Security Engine Configuration Updated")
      .setDescription(`Module **${moduleKey}** has been **${stateStr}** by ${interaction.user}.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await sendModLog(guild, embed);
  }
};

module.exports = {
  registerSecurityListeners,
  securityStatusCommand,
  securityToggleCommand
};

