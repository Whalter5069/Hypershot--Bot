const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("./securityConfig");
const db = require("./securityDb");

function getQuarantineRole(guild) {
  if (!guild) return null;

  // 1. Configured / Default ID
  if (config.DEFAULT_QUARANTINE_ROLE_ID) {
    const role = guild.roles.cache.get(config.DEFAULT_QUARANTINE_ROLE_ID);
    if (role) return role;
  }

  // 2. Database settings
  const settings = db.getGuildSettings(guild.id);
  if (settings && settings.quarantine_role_id) {
    const role = guild.roles.cache.get(settings.quarantine_role_id);
    if (role) return role;
  }

  // 3. Name lookup fallback
  return guild.roles.cache.find(
    r => r.name.toLowerCase() === "quarantine" || r.name.toLowerCase() === "quarantined"
  ) || null;
}

async function sendModLog(guild, embed) {
  if (!guild) return null;

  const settings = db.getGuildSettings(guild.id);
  let channel = null;

  if (settings && settings.mod_log_channel_id) {
    channel = guild.channels.cache.get(settings.mod_log_channel_id);
  }

  if (!channel) {
    channel = guild.channels.cache.find(
      c => c.isTextBased() && ["mod-logs", "mod-log", "security-logs", "audit-logs"].includes(c.name.toLowerCase())
    );
  }

  if (channel && channel.permissionsFor(guild.members.me)?.has("SendMessages")) {
    try {
      return await channel.send({ embeds: [embed] });
    } catch (e) {
      console.error(`[sendModLog Error] Failed to send embed to #${channel.name}:`, e.message);
    }
  }
  return null;
}

function checkHierarchy(moderator, target, botMember) {
  if (target.id === target.guild.ownerId) {
    return { allowed: false, msg: "Cannot perform moderation actions on the Server Owner." };
  }
  if (target.id === moderator.id) {
    if (!moderator.permissions.has(PermissionFlagsBits.Administrator) && moderator.id !== target.guild.ownerId) {
      return { allowed: false, msg: "You cannot perform moderation actions on yourself." };
    }
  }
  if (target.id === botMember.id) {
    return { allowed: false, msg: "I cannot perform moderation actions on myself." };
  }
  if (moderator.id !== target.guild.ownerId && target.roles.highest.position >= moderator.roles.highest.position) {
    return {
      allowed: false,
      msg: `You cannot moderate ${target} because their highest role (${target.roles.highest.name}) is equal to or higher than yours.`
    };
  }
  if (target.roles.highest.position >= botMember.roles.highest.position) {
    return {
      allowed: false,
      msg: `I cannot moderate ${target} because their highest role (${target.roles.highest.name}) is equal to or higher than my highest role (${botMember.roles.highest.name}).`
    };
  }
  return { allowed: true, msg: "" };
}

async function executeQuarantine(guild, member, reason = "Manual quarantine", moderatorId = "0", moderatorTag = "SYSTEM SECURITY") {
  const botMember = guild.members.me;

  // Safety checks
  if (member.id === guild.ownerId) {
    return { success: false, message: "Cannot quarantine the Server Owner." };
  }
  if (member.id === botMember.id) {
    return { success: false, message: "Cannot quarantine the bot itself." };
  }

  const quarantineRole = getQuarantineRole(guild);
  if (!quarantineRole) {
    return { success: false, message: "Quarantine role not found in this server. Run `/setup_security` first." };
  }

  if (botMember.roles.highest.position <= quarantineRole.position) {
    return {
      success: false,
      message: `My highest role (${botMember.roles.highest.name}) must be placed higher than the '${quarantineRole.name}' role in Server Settings > Roles.`
    };
  }

  const isAlreadyQuarantined = db.isUserQuarantined(guild.id, member.id);
  if (isAlreadyQuarantined && member.roles.cache.has(quarantineRole.id)) {
    return { success: false, message: `${member} is already quarantined.` };
  }

  // Collect roles to strip
  const rolesToStrip = [];
  const savedRoleIds = [];

  for (const role of member.roles.cache.values()) {
    if (role.id === guild.id) continue; // @everyone
    if (role.id === quarantineRole.id) continue;
    if (role.managed || botMember.roles.highest.position <= role.position) continue;

    rolesToStrip.push(role);
    savedRoleIds.push(role.id);
  }

  // Save to SQLite
  if (!isAlreadyQuarantined) {
    db.saveQuarantinedUser(guild.id, member.id, savedRoleIds, reason, moderatorId);
  }

  // 1. Add Quarantine role FIRST
  try {
    if (!member.roles.cache.has(quarantineRole.id)) {
      await member.roles.add(quarantineRole, `Quarantined by ${moderatorTag}: ${reason}`);
    }
  } catch (err) {
    return { success: false, message: `Failed to assign quarantine role: ${err.message}` };
  }

  // 2. Strip previous roles
  if (rolesToStrip.length > 0) {
    try {
      await member.roles.remove(rolesToStrip, `Quarantined by ${moderatorTag}: ${reason}`);
    } catch (err) {
      console.warn(`[Warning] Failed to strip some roles from ${member.user.tag}:`, err.message);
    }
  }

  // Internal DB log
  db.logModAction(guild.id, member.id, moderatorId, "QUARANTINE", reason);

  // Send to #quarantine channel
  const settings = db.getGuildSettings(guild.id);
  let quarantineChannel = null;
  if (settings && settings.quarantine_channel_id) {
    quarantineChannel = guild.channels.cache.get(settings.quarantine_channel_id);
  }
  if (!quarantineChannel) {
    quarantineChannel = guild.channels.cache.find(c => c.isTextBased() && c.name.toLowerCase() === "quarantine");
  }

  if (quarantineChannel && quarantineChannel.permissionsFor(botMember)?.has("SendMessages")) {
    const qEmbed = new EmbedBuilder()
      .setColor(config.COLOR_QUARANTINE)
      .setTitle("🚨 Server Access Restricted (Quarantine)")
      .setDescription(
        `${member}, your account has been placed into quarantine by security protocols.\n\n` +
        `**Reason:** ${reason}\n` +
        `**Action Taken By:** ${moderatorTag}\n` +
        `**Saved Roles Count:** ${savedRoleIds.length}\n\n` +
        `You have been stripped of your permissions. Please wait patiently in this channel for staff to review your status.`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    try {
      await quarantineChannel.send({ content: `${member}`, embeds: [qEmbed] });
    } catch {}
  }

  // Mod-logs embed
  const logEmbed = new EmbedBuilder()
    .setColor(config.COLOR_QUARANTINE)
    .setTitle("🛡️ Security Event: User Quarantined")
    .addFields(
      { name: "User", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Enforcer", value: `${moderatorTag} (\`${moderatorId}\`)`, inline: true },
      { name: "Reason", value: reason, inline: false },
      { name: "Roles Saved & Stripped", value: `${savedRoleIds.length}`, inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  await sendModLog(guild, logEmbed);

  // DM user
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(config.COLOR_QUARANTINE)
      .setTitle(`⚠️ You were quarantined in ${guild.name}`)
      .setDescription(
        `**Reason:** ${reason}\n\n` +
        `Your roles and access to all standard channels have been suspended.\n` +
        `Please check the \`#quarantine\` channel in the server for further instructions.`
      )
      .setTimestamp();
    await member.send({ embeds: [dmEmbed] });
  } catch {}

  return { success: true, message: `Successfully quarantined ${member} and saved ${savedRoleIds.length} role(s).` };
}

async function executeUnquarantine(guild, member, moderatorId = "0", moderatorTag = "SYSTEM") {
  const botMember = guild.members.me;

  const record = db.getQuarantinedUser(guild.id, member.id);
  if (!record) {
    return { success: false, message: `${member} is not recorded as quarantined in the database.` };
  }

  const savedRoleIds = record.saved_roles || [];
  const quarantineRole = getQuarantineRole(guild);

  // Remove Quarantined role
  if (quarantineRole && member.roles.cache.has(quarantineRole.id)) {
    try {
      await member.roles.remove(quarantineRole, `Unquarantined by ${moderatorTag}`);
    } catch (e) {
      return { success: false, message: "Bot lacks permission to remove the Quarantined role." };
    }
  }

  // Restore saved roles
  const rolesToRestore = [];
  for (const roleId of savedRoleIds) {
    const role = guild.roles.cache.get(roleId);
    if (role && botMember.roles.highest.position > role.position && !role.managed) {
      rolesToRestore.push(role);
    }
  }

  if (rolesToRestore.length > 0) {
    try {
      await member.roles.add(rolesToRestore, `Unquarantine: Restored by ${moderatorTag}`);
    } catch (e) {
      console.warn("Error restoring some roles:", e.message);
    }
  }

  // Remove from DB
  db.removeQuarantinedUser(guild.id, member.id);
  db.logModAction(guild.id, member.id, moderatorId, "UNQUARANTINE", "Manual restoration");

  // Mod-logs embed
  const logEmbed = new EmbedBuilder()
    .setColor(config.COLOR_SUCCESS)
    .setTitle("🛡️ Security Event: User Unquarantined")
    .addFields(
      { name: "User", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
      { name: "Restored By", value: `${moderatorTag} (\`${moderatorId}\`)`, inline: true },
      { name: "Roles Restored", value: `${rolesToRestore.length}`, inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  await sendModLog(guild, logEmbed);

  // DM user
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(config.COLOR_SUCCESS)
      .setTitle(`✅ Quarantine Lifted in ${guild.name}`)
      .setDescription("Your quarantine status has been revoked and your server roles have been restored. Welcome back!")
      .setTimestamp();
    await member.send({ embeds: [dmEmbed] });
  } catch {}

  return { success: true, message: `Successfully unquarantined ${member} and restored ${rolesToRestore.length} role(s).` };
}

// Quarantine slash commands
const quarantineCommand = {
  data: new SlashCommandBuilder()
    .setName("quarantine")
    .setDescription("Immediately strips a user's roles, saves them, and assigns the Quarantine role.")
    .addUserOption(opt => opt.setName("user").setDescription("The member to quarantine").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("The justification for quarantine").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "Manual quarantine by moderator";

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.editReply({ content: "❌ Member not found in this server." });
    }

    const { allowed, msg } = checkHierarchy(interaction.member, member, interaction.guild.members.me);
    if (!allowed) {
      return interaction.editReply({ content: `❌ ${msg}` });
    }

    const res = await executeQuarantine(
      interaction.guild,
      member,
      reason,
      interaction.user.id,
      interaction.user.tag
    );

    if (res.success) {
      const embed = new EmbedBuilder()
        .setColor(config.COLOR_QUARANTINE)
        .setTitle("🔒 User Quarantined")
        .setDescription(`${member} has been isolated to the quarantine channel.\n**Reason:** ${reason}`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ content: `❌ Could not quarantine ${member}: ${res.message}` });
    }
  }
};

const unquarantineCommand = {
  data: new SlashCommandBuilder()
    .setName("unquarantine")
    .setDescription("Lifts quarantine and restores the user's original roles from the database.")
    .addUserOption(opt => opt.setName("user").setDescription("The member to unquarantine").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const targetUser = interaction.options.getUser("user");
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return interaction.editReply({ content: "❌ Member not found in this server." });
    }

    const res = await executeUnquarantine(
      interaction.guild,
      member,
      interaction.user.id,
      interaction.user.tag
    );

    if (res.success) {
      const embed = new EmbedBuilder()
        .setColor(config.COLOR_SUCCESS)
        .setTitle("🔓 Quarantine Revoked")
        .setDescription(`${member} has been released from quarantine and their previous roles have been restored.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ content: `❌ Error: ${res.message}` });
    }
  }
};

// Sticky Quarantine on member join
async function handleStickyQuarantine(member) {
  const guild = member.guild;
  if (!db.isUserQuarantined(guild.id, member.id)) return;

  const record = db.getQuarantinedUser(guild.id, member.id);
  const reason = record ? record.reason : "Active quarantine status";
  const quarantineRole = getQuarantineRole(guild);
  if (!quarantineRole) return;

  const botMember = guild.members.me;
  if (botMember.roles.highest.position <= quarantineRole.position) {
    console.warn(`[Sticky Quarantine] Bot role is below quarantine role in ${guild.name}`);
    return;
  }

  try {
    const rolesToStrip = member.roles.cache.filter(
      r => r.id !== guild.id && !r.managed && botMember.roles.highest.position > r.position
    );
    if (rolesToStrip.size > 0) {
      await member.roles.remove(rolesToStrip, "Sticky Quarantine: Stripped auto-assigned join roles");
    }
    await member.roles.add(quarantineRole, "Sticky Quarantine: Rejoined server while under quarantine");
  } catch (err) {
    console.error(`[Sticky Quarantine Error] Failed to enforce on ${member.user.tag}:`, err.message);
    return;
  }

  // Notification in #quarantine
  const settings = db.getGuildSettings(guild.id);
  let qChannel = null;
  if (settings && settings.quarantine_channel_id) {
    qChannel = guild.channels.cache.get(settings.quarantine_channel_id);
  }
  if (!qChannel) {
    qChannel = guild.channels.cache.find(c => c.isTextBased() && c.name.toLowerCase() === "quarantine");
  }

  if (qChannel && qChannel.permissionsFor(botMember)?.has("SendMessages")) {
    const qEmbed = new EmbedBuilder()
      .setColor(config.COLOR_QUARANTINE)
      .setTitle("🚨 Quarantine Evasion Blocked")
      .setDescription(
        `${member}, you left and rejoined the server while your account was still under quarantine.\n\n` +
        `**Original Reason:** ${reason}\n` +
        `Your **Quarantined** status and role have been re-enforced. You remain blocked from standard server channels.`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    try {
      await qChannel.send({ content: `${member}`, embeds: [qEmbed] });
    } catch {}
  }

  // Mod-logs alert
  const logEmbed = new EmbedBuilder()
    .setColor(config.COLOR_WARNING)
    .setTitle("🛡️ Sticky Quarantine: Evasion Prevented")
    .setDescription(
      `**User:** ${member} (\`${member.user.tag}\` / \`${member.id}\`)\n` +
      `**Event:** User rejoined while listed in quarantine database.\n` +
      `**Action:** Re-applied quarantine role (${quarantineRole.name}).\n` +
      `**Original Reason:** ${reason}`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  await sendModLog(guild, logEmbed);

  // DM
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(config.COLOR_QUARANTINE)
      .setTitle(`⚠️ Quarantine Re-applied in ${guild.name}`)
      .setDescription("Leaving and rejoining the server does not bypass your quarantine.\nYour quarantine role has been re-applied automatically. Please wait in `#quarantine`.")
      .setTimestamp();
    await member.send({ embeds: [dmEmbed] });
  } catch {}
}

module.exports = {
  getQuarantineRole,
  sendModLog,
  checkHierarchy,
  executeQuarantine,
  executeUnquarantine,
  handleStickyQuarantine,
  quarantineCommand,
  unquarantineCommand
};

