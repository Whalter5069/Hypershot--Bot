const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require("discord.js");
const config = require("./securityConfig");
const db = require("./securityDb");

const setupSecurityCommand = {
  data: new SlashCommandBuilder()
    .setName("setup_security")
    .setDescription("Automatically creates & configures the Quarantined role, #quarantine channel, and #mod-logs channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const guild = interaction.guild;
    const botMember = guild.members.me;

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({
        content: "❌ I require both **Manage Roles** and **Manage Channels** permissions to configure security isolation."
      });
    }

    const statusUpdates = [];

    // 1. Role Setup
    let quarantineRole = guild.roles.cache.find(r => r.name.toLowerCase() === "quarantined");
    if (!quarantineRole) {
      try {
        quarantineRole = await guild.roles.create({
          name: "Quarantined",
          color: 0x808080,
          reason: "Hypershot Prohori Security Setup: Quarantine Role"
        });
        statusUpdates.push(`✅ Created role: ${quarantineRole}`);
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to create Quarantined role: ${err.message}` });
      }
    } else {
      statusUpdates.push(`ℹ️ Found existing role: ${quarantineRole}`);
    }

    // 2. Quarantine Channel Setup
    let quarantineChannel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText && c.name.toLowerCase() === "quarantine"
    );

    if (!quarantineChannel) {
      try {
        quarantineChannel = await guild.channels.create({
          name: "quarantine",
          type: ChannelType.GuildText,
          topic: "Isolated holding zone for users flagged by Prohori Security Engine.",
          reason: "Hypershot Prohori Security Setup: Quarantine Channel",
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: quarantineRole.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            },
            {
              id: botMember.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels]
            }
          ]
        });
        statusUpdates.push(`✅ Created channel: ${quarantineChannel}`);
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to create #quarantine channel: ${err.message}` });
      }
    } else {
      try {
        await quarantineChannel.permissionOverwrites.set([
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: quarantineRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: botMember.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels]
          }
        ]);
        statusUpdates.push(`ℹ️ Configured permissions on: ${quarantineChannel}`);
      } catch (err) {
        console.warn("Could not set quarantine channel overwrites:", err.message);
      }
    }

    // 3. Mod Logs Channel Setup
    let modLogChannel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText && ["mod-logs", "mod-log", "security-logs"].includes(c.name.toLowerCase())
    );

    if (!modLogChannel) {
      try {
        modLogChannel = await guild.channels.create({
          name: "mod-logs",
          type: ChannelType.GuildText,
          topic: "Audit log stream for Prohori Bot security events and moderation actions.",
          reason: "Hypershot Prohori Security Setup: Mod Logs Channel",
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: botMember.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
            }
          ]
        });
        statusUpdates.push(`✅ Created channel: ${modLogChannel}`);
      } catch (err) {
        return interaction.editReply({ content: `❌ Failed to create #mod-logs channel: ${err.message}` });
      }
    } else {
      statusUpdates.push(`ℹ️ Found existing logs channel: ${modLogChannel}`);
    }

    // 4. Channel Overrides: Deny @Quarantined access to other channels
    let isolatedCount = 0;
    for (const channel of guild.channels.cache.values()) {
      if (channel.id === quarantineChannel.id) continue;
      if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildCategory) {
        try {
          await channel.permissionOverwrites.create(quarantineRole, {
            ViewChannel: false
          }, { reason: "Prohori Security: Isolate Quarantined role" });
          isolatedCount++;
        } catch {}
      }
    }

    statusUpdates.push(`🔒 Isolated **${isolatedCount}** channel(s) from ${quarantineRole}.`);

    // 5. Save settings to SQLite
    db.updateGuildSettings(guild.id, {
      quarantine_role_id: quarantineRole.id,
      quarantine_channel_id: quarantineChannel.id,
      mod_log_channel_id: modLogChannel.id
    });

    const embed = new EmbedBuilder()
      .setColor(config.COLOR_SUCCESS)
      .setTitle("🛡️ Security Isolation System Configured")
      .setDescription(
        statusUpdates.join("\n") + "\n\n" +
        "**Important Next Step:** In **Server Settings > Roles**, drag the **Hypershot Bot role** to be **ABOVE** the **Quarantined** role so the bot has permission to assign and strip roles."
      )
      .setFooter({ text: "Prohori Security Engine is ready." })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

module.exports = {
  setupSecurityCommand
};

