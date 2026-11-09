const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const config = require("./securityConfig");
const db = require("./securityDb");
const { sendModLog } = require("./quarantine");

const whitelistAddCommand = {
  data: new SlashCommandBuilder()
    .setName("whitelist_add")
    .setDescription("Grants security whitelist bypass permissions to a trusted user or role.")
    .addMentionableOption(opt =>
      opt.setName("target")
        .setDescription("The user or role to whitelist")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("reason")
        .setDescription("Reason for whitelisting this entity")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const target = interaction.options.getMentionable("target");
    const reason = interaction.options.getString("reason") || "Trusted administrator/integration";
    const guild = interaction.guild;

    const isRole = target.color !== undefined && target.guild !== undefined && target.permissions !== undefined && !target.user;
    const targetType = isRole ? "role" : (target.user?.bot ? "bot" : "user");

    if (db.isWhitelisted(guild.id, target.id)) {
      return interaction.editReply({ content: `ℹ️ ${target} is already on the security whitelist.` });
    }

    const success = db.addWhitelist(guild.id, target.id, targetType, interaction.user.id);
    if (!success) {
      return interaction.editReply({ content: "❌ Failed to add entity to the database whitelist." });
    }

    db.logModAction(guild.id, target.id, interaction.user.id, "WHITELIST_ADD", reason);

    const embed = new EmbedBuilder()
      .setColor(config.COLOR_SUCCESS)
      .setTitle("🛡️ Security Whitelist: Entity Added")
      .setDescription(
        `**Target:** ${target} (\`${target.name || target.user?.tag}\` / \`${target.id}\`)\n` +
        `**Type:** \`${targetType.toUpperCase()}\`\n` +
        `**Authorized By:** ${interaction.user}\n` +
        `**Reason:** ${reason}\n\n` +
        `⚡ *This entity will now bypass Anti-Nuke rate limits, Automod, and Anti-Spam filters.*`
      )
      .setTimestamp();

    if (target.user?.displayAvatarURL) {
      embed.setThumbnail(target.user.displayAvatarURL({ dynamic: true }));
    }

    await interaction.editReply({ embeds: [embed] });
    await sendModLog(guild, embed);
  }
};

const whitelistRemoveCommand = {
  data: new SlashCommandBuilder()
    .setName("whitelist_remove")
    .setDescription("Revokes security whitelist bypass permissions from a user or role.")
    .addMentionableOption(opt =>
      opt.setName("target")
        .setDescription("The user or role to remove from whitelist")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const target = interaction.options.getMentionable("target");
    const guild = interaction.guild;

    if (!db.isWhitelisted(guild.id, target.id)) {
      return interaction.editReply({ content: `❌ ${target} is not currently registered on the whitelist.` });
    }

    const removed = db.removeWhitelist(guild.id, target.id);
    if (!removed) {
      return interaction.editReply({ content: "❌ Failed to remove entity from whitelist database." });
    }

    db.logModAction(guild.id, target.id, interaction.user.id, "WHITELIST_REMOVE", "Manual removal");

    const embed = new EmbedBuilder()
      .setColor(config.COLOR_WARNING)
      .setTitle("🛡️ Security Whitelist: Entity Revoked")
      .setDescription(
        `**Target:** ${target} (\`${target.name || target.user?.tag}\` / \`${target.id}\`)\n` +
        `**Revoked By:** ${interaction.user}\n\n` +
        `⚠️ *This entity is now subject to standard Anti-Nuke, Automod, and Anti-Spam enforcement.*`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    await sendModLog(guild, embed);
  }
};

const whitelistListCommand = {
  data: new SlashCommandBuilder()
    .setName("whitelist_list")
    .setDescription("Displays all currently whitelisted users, bots, and roles for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const guild = interaction.guild;
    const records = db.getWhitelist(guild.id);

    if (!records || records.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setColor(config.COLOR_INFO)
        .setTitle("🛡️ Server Security Whitelist")
        .setDescription("No users, bots, or roles are currently whitelisted. (Only the Server Owner and Bot bypass security by default).")
        .setTimestamp();
      return interaction.editReply({ embeds: [emptyEmbed] });
    }

    const lines = records.map((item, idx) => {
      const mention = item.target_type === "role" ? `<@&${item.target_id}>` : `<@${item.target_id}>`;
      const addedByStr = item.added_by ? `<@${item.added_by}>` : "System";
      return `\`${idx + 1}.\` ${mention} \`[${item.target_type.toUpperCase()}]\` — Added by ${addedByStr}`;
    });

    const embed = new EmbedBuilder()
      .setColor(config.COLOR_INFO)
      .setTitle(`🛡️ Server Security Whitelist (${records.length} Total)`)
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Whitelisted entities are immune to Anti-Nuke, Automod, and Anti-Spam." })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

module.exports = {
  whitelistAddCommand,
  whitelistRemoveCommand,
  whitelistListCommand
};

