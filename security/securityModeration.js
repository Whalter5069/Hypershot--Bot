const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require("discord.js");
const config = require("./securityConfig");
const db = require("./securityDb");
const { sendModLog, checkHierarchy } = require("./quarantine");

function parseDuration(durationStr) {
  if (!durationStr) return null;
  const match = durationStr.trim().match(/^(\d+)([smhdw])$/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  let ms = 0;
  if (unit === "s") ms = amount * 1000;
  else if (unit === "m") ms = amount * 60 * 1000;
  else if (unit === "h") ms = amount * 60 * 60 * 1000;
  else if (unit === "d") ms = amount * 24 * 60 * 60 * 1000;
  else if (unit === "w") ms = amount * 7 * 24 * 60 * 60 * 1000;

  const maxMs = 28 * 24 * 60 * 60 * 1000; // 28 days max
  if (ms <= 0 || ms > maxMs) return null;

  return ms;
}

const purgeCommand = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Deletes a specified number of messages in the current channel.")
    .addIntegerOption(opt =>
      opt.setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("Optional: Only delete messages from this specific user")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const amount = interaction.options.getInteger("amount");
    const targetUser = interaction.options.getUser("user");
    const channel = interaction.channel;

    if (!channel || !channel.isTextBased()) {
      return interaction.editReply({ content: "❌ Purge can only be performed in text channels." });
    }

    try {
      let messagesToDelete;
      if (targetUser) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        messagesToDelete = fetched.filter(m => m.author.id === targetUser.id).first(amount);
      } else {
        messagesToDelete = amount;
      }

      const deleted = await channel.bulkDelete(messagesToDelete, true);

      let msgText = `🗑️ Purged **${deleted.size}** message(s)`;
      if (targetUser) msgText += ` sent by ${targetUser}`;
      await interaction.editReply({ content: msgText });

      const logEmbed = new EmbedBuilder()
        .setColor(config.COLOR_INFO)
        .setTitle("🧹 Messages Purged")
        .addFields(
          { name: "Channel", value: `${channel}`, inline: true },
          { name: "Moderator", value: `${interaction.user}`, inline: true },
          { name: "Amount Deleted", value: `${deleted.size}`, inline: true }
        )
        .setTimestamp();

      if (targetUser) {
        logEmbed.addFields({ name: "Target User Filter", value: `${targetUser}`, inline: false });
      }

      await sendModLog(interaction.guild, logEmbed);
    } catch (err) {
      await interaction.editReply({ content: `❌ Failed to purge messages: ${err.message}` });
    }
  }
};

const lockdownCommand = {
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Locks down a channel or all public channels to halt raids or spam attacks.")
    .addChannelOption(opt =>
      opt.setName("channel")
        .setDescription("The specific channel to lock (leave empty for current channel)")
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("server_wide")
        .setDescription("Lock ALL text channels across the entire server")
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("reason")
        .setDescription("Reason for emergency lockdown")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const guild = interaction.guild;
    const serverWide = interaction.options.getBoolean("server_wide") || false;
    const reason = interaction.options.getString("reason") || "Emergency security lockdown";

    if (serverWide) {
      let lockedCount = 0;
      for (const ch of guild.channels.cache.values()) {
        if (ch.type !== ChannelType.GuildText) continue;
        if (["quarantine", "mod-logs", "security-logs", "audit-logs"].includes(ch.name.toLowerCase())) continue;

        try {
          await ch.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: false
          }, { reason: `Server Lockdown: ${reason}` });
          lockedCount++;
        } catch {}
      }

      const embed = new EmbedBuilder()
        .setColor(config.COLOR_DANGER)
        .setTitle("🚨 SERVER-WIDE LOCKDOWN ACTIVATED")
        .setDescription(
          `**Locked Channels:** \`${lockedCount}\`\n` +
          `**Enforced By:** ${interaction.user}\n` +
          `**Reason:** ${reason}\n\n` +
          `⚠️ *All public chat privileges have been temporarily frozen.*`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendModLog(guild, embed);
    } else {
      const targetChannel = interaction.options.getChannel("channel") || interaction.channel;
      if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        return interaction.editReply({ content: "❌ Can only lock text channels." });
      }

      try {
        await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: false
        }, { reason: `Lockdown: ${reason}` });
      } catch (err) {
        return interaction.editReply({ content: `❌ Missing permission to lock channel: ${err.message}` });
      }

      const lockEmbed = new EmbedBuilder()
        .setColor(config.COLOR_DANGER)
        .setTitle("🔒 Channel Locked")
        .setDescription(`This channel has been locked down by ${interaction.user}.\n**Reason:** ${reason}`)
        .setTimestamp();

      await targetChannel.send({ embeds: [lockEmbed] });
      await interaction.editReply({ content: `✅ Successfully locked ${targetChannel}.` });

      const logEmbed = new EmbedBuilder()
        .setColor(config.COLOR_DANGER)
        .setTitle("🛡️ Moderation: Channel Locked")
        .addFields(
          { name: "Channel", value: `${targetChannel}`, inline: true },
          { name: "Moderator", value: `${interaction.user}`, inline: true },
          { name: "Reason", value: reason, inline: false }
        )
        .setTimestamp();

      await sendModLog(guild, logEmbed);
    }
  }
};

const unlockCommand = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Lifts lockdown and restores chat privileges for a channel or the entire server.")
    .addChannelOption(opt =>
      opt.setName("channel")
        .setDescription("The specific channel to unlock (leave empty for current channel)")
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName("server_wide")
        .setDescription("Unlock ALL text channels across the entire server")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const guild = interaction.guild;
    const serverWide = interaction.options.getBoolean("server_wide") || false;

    if (serverWide) {
      let unlockedCount = 0;
      for (const ch of guild.channels.cache.values()) {
        if (ch.type !== ChannelType.GuildText) continue;
        if (["quarantine", "mod-logs", "security-logs", "audit-logs"].includes(ch.name.toLowerCase())) continue;

        try {
          await ch.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: null
          }, { reason: "Server Unlock" });
          unlockedCount++;
        } catch {}
      }

      const embed = new EmbedBuilder()
        .setColor(config.COLOR_SUCCESS)
        .setTitle("🔓 SERVER LOCKDOWN LIFTED")
        .setDescription(`Standard messaging privileges restored across **${unlockedCount}** channel(s).`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendModLog(guild, embed);
    } else {
      const targetChannel = interaction.options.getChannel("channel") || interaction.channel;
      if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        return interaction.editReply({ content: "❌ Can only unlock text channels." });
      }

      try {
        await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: null
        }, { reason: "Channel Unlock" });
      } catch (err) {
        return interaction.editReply({ content: `❌ Missing permission to unlock channel: ${err.message}` });
      }

      const unlockEmbed = new EmbedBuilder()
        .setColor(config.COLOR_SUCCESS)
        .setTitle("🔓 Channel Unlocked")
        .setDescription(`This channel has been unlocked by ${interaction.user}. Normal chatting has resumed.`)
        .setTimestamp();

      await targetChannel.send({ embeds: [unlockEmbed] });
      await interaction.editReply({ content: `✅ Successfully unlocked ${targetChannel}.` });
    }
  }
};

const timeoutSecurityCommand = {
  data: new SlashCommandBuilder()
    .setName("timeout_security")
    .setDescription("Times out (mutes) a member for a specified duration with audit logging.")
    .addUserOption(opt => opt.setName("user").setDescription("The member to timeout").setRequired(true))
    .addStringOption(opt =>
      opt.setName("duration")
        .setDescription("Duration (e.g. 30s, 10m, 2h, 1d, 7d, max 28d)")
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for timeout").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const targetUser = interaction.options.getUser("user");
    const durationStr = interaction.options.getString("duration");
    const reason = interaction.options.getString("reason") || "No reason provided";

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.editReply({ content: "❌ Member not found in this server." });
    }

    const { allowed, msg } = checkHierarchy(interaction.member, member, interaction.guild.members.me);
    if (!allowed) {
      return interaction.editReply({ content: `❌ ${msg}` });
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.editReply({
        content: "❌ Invalid duration format. Please use formats like `30s`, `10m`, `2h`, `7d` (Maximum: 28 days)."
      });
    }

    try {
      await member.timeout(durationMs, `${interaction.user.tag}: ${reason}`);
    } catch (err) {
      return interaction.editReply({ content: `❌ Failed to timeout member: ${err.message}` });
    }

    db.logModAction(interaction.guildId, targetUser.id, interaction.user.id, "TIMEOUT", `${durationStr} - ${reason}`);

    const endTs = Math.floor((Date.now() + durationMs) / 1000);
    const embed = new EmbedBuilder()
      .setColor(config.COLOR_WARNING)
      .setTitle("⏳ Member Timed Out")
      .setDescription(`${member} has been timed out until <t:${endTs}:F> (<t:${endTs}:R>).\n**Reason:** ${reason}`)
      .setFooter({ text: `Enforced by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    const logEmbed = new EmbedBuilder()
      .setColor(config.COLOR_WARNING)
      .setTitle("🛡️ Moderation: Timeout")
      .addFields(
        { name: "Target", value: `${member} (\`${member.id}\`)`, inline: true },
        { name: "Moderator", value: `${interaction.user}`, inline: true },
        { name: "Duration", value: `${durationStr} (Ends <t:${endTs}:R>)`, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setTimestamp();

    await sendModLog(interaction.guild, logEmbed);
  }
};

const untimeoutSecurityCommand = {
  data: new SlashCommandBuilder()
    .setName("untimeout_security")
    .setDescription("Removes timeout from a member early.")
    .addUserOption(opt => opt.setName("user").setDescription("The member to untimeout").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for removing timeout").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const targetUser = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "Timeout revoked early";

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.editReply({ content: "❌ Member not found in this server." });
    }

    const { allowed, msg } = checkHierarchy(interaction.member, member, interaction.guild.members.me);
    if (!allowed) {
      return interaction.editReply({ content: `❌ ${msg}` });
    }

    try {
      await member.timeout(null, `${interaction.user.tag}: ${reason}`);
    } catch (err) {
      return interaction.editReply({ content: `❌ Failed to remove timeout: ${err.message}` });
    }

    db.logModAction(interaction.guildId, targetUser.id, interaction.user.id, "UNTIMEOUT", reason);

    const embed = new EmbedBuilder()
      .setColor(config.COLOR_SUCCESS)
      .setTitle("🔊 Timeout Removed")
      .setDescription(`${member}'s timeout has been cleared.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

module.exports = {
  purgeCommand,
  lockdownCommand,
  unlockCommand,
  timeoutSecurityCommand,
  untimeoutSecurityCommand
};

