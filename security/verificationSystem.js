const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require("discord.js");
const config = require("./securityConfig");
const db = require("./securityDb");
const { sendModLog } = require("./quarantine");

// Cache for active captcha challenges: userId -> { code, expires }
const activeCaptchas = new Map();

const CAPTCHA_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateCaptchaCode(length = 5) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CAPTCHA_CHARS.charAt(Math.floor(Math.random() * CAPTCHA_CHARS.length));
  }
  return result;
}

const setupVerificationCommand = {
  data: new SlashCommandBuilder()
    .setName("setup_verification")
    .setDescription("Deploys the persistent CAPTCHA verification message in a specified channel.")
    .addChannelOption(opt =>
      opt.setName("channel")
        .setDescription("The verification channel where unverified users arrive")
        .setRequired(true)
    )
    .addRoleOption(opt =>
      opt.setName("verified_role")
        .setDescription("The role granted to users after solving the verification")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const targetChannel = interaction.options.getChannel("channel");
    const verifiedRole = interaction.options.getRole("verified_role");
    const botMember = interaction.guild.members.me;

    if (botMember.roles.highest.position <= verifiedRole.position) {
      return interaction.editReply({
        content: `❌ My highest role must be placed **above** the ${verifiedRole} role in Server Settings > Roles.`
      });
    }

    db.updateGuildSettings(interaction.guildId, {
      verification_channel_id: targetChannel.id,
      verified_role_id: verifiedRole.id
    });

    const portalEmbed = new EmbedBuilder()
      .setColor(config.COLOR_INFO)
      .setTitle("🛡️ Server Security Gate | Verification Required")
      .setDescription(
        `Welcome to **${interaction.guild.name}**!\n\n` +
        `To safeguard our community against automated bot attacks, raids, and malicious scrapers, ` +
        `all new members must pass a short human verification check.\n\n` +
        `**How to Verify:**\n` +
        `1. Click the **'🔒 Verify Yourself'** button below.\n` +
        `2. A private challenge code will appear for you.\n` +
        `3. Submit the 5-character code to unlock server access.\n\n` +
        `⚡ *Takes less than 10 seconds!*`
      )
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: "Protected by Prohori Security Engine" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prohori_verify_button")
        .setLabel("🔒 Verify Yourself")
        .setStyle(ButtonStyle.Primary)
    );

    try {
      await targetChannel.send({ embeds: [portalEmbed], components: [row] });
    } catch (e) {
      return interaction.editReply({ content: `❌ I do not have permission to send messages in ${targetChannel}: ${e.message}` });
    }

    await interaction.editReply({
      content:
        `✅ Verification gate successfully installed in ${targetChannel} with role ${verifiedRole}!\n\n` +
        `**Recommended Permission Setup:**\n` +
        `- Set \`@everyone\` role to have \`View Channel: False\` on all channels EXCEPT this verification channel.\n` +
        `- Grant ${verifiedRole} \`View Channel: True\` on your public channels.`
    });
  }
};

async function handleVerificationInteractions(interaction, client) {
  const guild = interaction.guild;
  if (!guild) return;

  // 1. Initial "🔒 Verify Yourself" button click
  if (interaction.isButton() && interaction.customId === "prohori_verify_button") {
    const member = interaction.member;
    const settings = db.getGuildSettings(guild.id);
    let verifiedRole = null;

    if (settings && settings.verified_role_id) {
      verifiedRole = guild.roles.cache.get(settings.verified_role_id);
    }
    if (!verifiedRole) {
      verifiedRole = guild.roles.cache.find(r => ["verified", "member", "members"].includes(r.name.toLowerCase()));
    }

    if (verifiedRole && member.roles.cache.has(verifiedRole.id)) {
      return interaction.reply({
        content: "ℹ️ You have already completed verification and hold server access.",
        ephemeral: true
      });
    }

    // Generate 5-char code
    const code = generateCaptchaCode(5);
    activeCaptchas.set(member.id, {
      code,
      expires: Date.now() + 180000 // 3 minutes
    });

    const displayCode = code.split("").join("   ");

    const challengeEmbed = new EmbedBuilder()
      .setColor(config.COLOR_INFO)
      .setTitle("🧩 Human Security Verification")
      .setDescription(
        `Please read the 5-character verification code below:\n\n` +
        `\`\`\`\n` +
        `┌─────────────────────────┐\n` +
        `│     ${displayCode}     │\n` +
        `└─────────────────────────┘\n` +
        `\`\`\`\n` +
        `**Instructions:**\n` +
        `1. Carefully note the code above (case-insensitive).\n` +
        `2. Click the green **Submit Verification Code** button below.\n` +
        `3. Enter the 5 characters to unlock access.`
      )
      .setFooter({ text: "Verification code expires in 3 minutes." })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prohori_solve_captcha_btn")
        .setLabel("⌨️ Submit Verification Code")
        .setStyle(ButtonStyle.Success)
    );

    return interaction.reply({
      embeds: [challengeEmbed],
      components: [row],
      ephemeral: true
    });
  }

  // 2. "Submit Verification Code" button -> open modal
  if (interaction.isButton() && interaction.customId === "prohori_solve_captcha_btn") {
    const cached = activeCaptchas.get(interaction.user.id);
    if (!cached || Date.now() > cached.expires) {
      return interaction.reply({
        content: "⏳ Your verification session has expired. Please click **Verify Yourself** again.",
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("prohori_captcha_modal")
      .setTitle("Enter Verification Code");

    const input = new TextInputBuilder()
      .setCustomId("prohori_captcha_input")
      .setLabel("Type the 5 characters you saw")
      .setStyle(TextInputStyle.Short)
      .setMinLength(3)
      .setMaxLength(8)
      .setRequired(true)
      .setPlaceholder("e.g. 7K9PQ");

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // 3. Modal submit
  if (interaction.isModalSubmit() && interaction.customId === "prohori_captcha_modal") {
    const userInput = interaction.fields.getTextInputValue("prohori_captcha_input").trim().toUpperCase();
    const cached = activeCaptchas.get(interaction.user.id);

    if (!cached || Date.now() > cached.expires) {
      activeCaptchas.delete(interaction.user.id);
      return interaction.reply({
        content: "⏳ Your verification session expired. Please click **Verify Yourself** to try again.",
        ephemeral: true
      });
    }

    if (userInput !== cached.code.toUpperCase()) {
      activeCaptchas.delete(interaction.user.id);
      return interaction.reply({
        content: "❌ **Verification Failed:** The code you entered did not match. Please click **Verify Yourself** to try again with a new code.",
        ephemeral: true
      });
    }

    // Success! Find verified role
    const settings = db.getGuildSettings(guild.id);
    let verifiedRole = null;
    if (settings && settings.verified_role_id) {
      verifiedRole = guild.roles.cache.get(settings.verified_role_id);
    }
    if (!verifiedRole) {
      verifiedRole = guild.roles.cache.find(r => ["verified", "member", "members"].includes(r.name.toLowerCase()));
    }

    if (!verifiedRole) {
      return interaction.reply({
        content: "⚠️ **Code Solved**, but no Verified role is configured in this server. Please inform an administrator to run `/setup_verification`.",
        ephemeral: true
      });
    }

    const botMember = guild.members.me;
    if (botMember.roles.highest.position <= verifiedRole.position) {
      return interaction.reply({
        content: "❌ **Permission Error:** The bot lacks permission to assign the Verified role. Ensure the bot's role is higher than the Verified role.",
        ephemeral: true
      });
    }

    try {
      await interaction.member.roles.add(verifiedRole, "Completed Human CAPTCHA Verification");
    } catch (e) {
      return interaction.reply({
        content: `❌ Failed to assign verified role: ${e.message}`,
        ephemeral: true
      });
    }

    activeCaptchas.delete(interaction.user.id);

    const successEmbed = new EmbedBuilder()
      .setColor(config.COLOR_SUCCESS)
      .setTitle("✅ Verification Completed!")
      .setDescription(`Welcome ${interaction.user}! You have been granted the **${verifiedRole.name}** role and standard server access has been unlocked.`)
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });

    // Mod-logs
    const logEmbed = new EmbedBuilder()
      .setColor(config.COLOR_SUCCESS)
      .setTitle("🛡️ Verification: User Verified")
      .setDescription(`${interaction.user} (\`${interaction.user.id}\`) successfully passed the security challenge.`)
      .setTimestamp();

    await sendModLog(guild, logEmbed);
  }
}

module.exports = {
  setupVerificationCommand,
  handleVerificationInteractions
};

