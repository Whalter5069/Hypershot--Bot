const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

// 📌 Fixed Channel IDs
const SITUATION_CHANNEL_ID = process.env.SITUATION_LOG_CHANNEL_ID; // situation-log channel  
const MAIN_LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;   // main-log channel  

// 🎯 XP Table
const HEIST_XP = {
  paleto: 50,
  bobcat: 60,
  fleeca: 30,
  pacific: 80,
  casino: 100,
  store: 20,
  jewelry: 35
};

// 🏦 Full Heist Names
const HEIST_NAMES = {
  paleto: "🏦 Paleto Bank Heist",
  bobcat: "🔐 Bobcat Security Heist",
  fleeca: "🏛 Fleeca Bank Heist",
  pacific: "💰 Pacific Standard Heist",
  casino: "🎰 Casino Heist",
  store: "🛒 Store Robbery",
  jewelry: "💎 Jewelry Heist"
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("situation")
    .setDescription("📜 Log a heist situation with XP calculation")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt =>
      opt.setName("type")
        .setDescription("Type of situation")
        .setRequired(true)
        .addChoices(
          { name: "Paleto Bank Heist", value: "paleto" },
          { name: "Bobcat Security Heist", value: "bobcat" },
          { name: "Fleeca Bank Heist", value: "fleeca" },
          { name: "Pacific Standard Heist", value: "pacific" },
          { name: "Casino Heist", value: "casino" },
          { name: "Store Robbery", value: "store" },
          { name: "Jewelry Heist", value: "jewelry" }
        )
    )
    .addIntegerOption(opt =>
      opt.setName("attempts")
        .setDescription("Number of attempts completed")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("team")
        .setDescription("Mention team members (separate by space)")
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("mention")
        .setDescription("Role or user mention (optional)")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const type = interaction.options.getString("type");
      const attempts = interaction.options.getInteger("attempts");
      const teamInput = interaction.options.getString("team");
      const mention = interaction.options.getString("mention") || "";

      const xpPerAttempt = HEIST_XP[type] || 0;
      const totalXP = xpPerAttempt * attempts;
      const heistName = HEIST_NAMES[type] || type;

      // 🕒 Date/Time (Bangladesh Timezone)
      const dateNow = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Dhaka"
      });

      // 📑 Premium Styled Description
      const description =
        `📅 **Date:** \`${dateNow}\`\n` +
        `📌 **Situation Type:** ${heistName}\n` +
        `🔁 **Attempts:** \`${attempts}\`\n` +
        `⭐ **XP Per Attempt:** \`${xpPerAttempt}\`\n` +
        `🏆 **Total XP:** \`${totalXP}\`\n\n` +
        `👥 **Team Members:**\n${teamInput}`;

      // 🎨 Embed
      const embed = new EmbedBuilder()
        .setColor("Gold")
        .setTitle(`📜 Situation Report — ${heistName}`)
        .setDescription(description)
        .setImage("https://media.discordapp.net/attachments/1328281349471342593/1461291979408412841/standard_4.gif")
        .setFooter({
          text: "👑Hypershot Arena Management",
          iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();



      // 📢 Send to situation-log channel (with mention if provided)
      const situationChannel = await interaction.guild.channels.fetch(SITUATION_CHANNEL_ID).catch(() => null);
      if (situationChannel) {
        await situationChannel.send({ content: mention, embeds: [embed] });
      }

      // 📢 Send to main-log channel (no mention)
      const mainLogChannel = await interaction.guild.channels.fetch(MAIN_LOG_CHANNEL_ID).catch(() => null);
      if (mainLogChannel) {
        await mainLogChannel.send({ embeds: [embed] });
      }

      await interaction.editReply("✅ **Situation logged successfully!**");
    } catch (err) {
      console.error("❌ Error in /situation:", err);
      await interaction.editReply("❌ **Failed to log situation.**");
    }
  }
};
