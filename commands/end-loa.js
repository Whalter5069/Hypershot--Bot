const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Allowed roles for END LOA from .env
const ALLOWED_ROLES = process.env.ALLOWED_END_LOA_ROLE
  ? process.env.ALLOWED_END_LOA_ROLE.split(",")
  : [];

const messages = [
  "👋 **Welcome back, we missed you!**",
  "⚔️ **Duty calls, and you're back stronger!**",
  "👑 **The Hypershot Arena grows stronger with your return.**",
  "🌌 **Another warrior has returned from the shadows.**",
  "📜 **Your LOA has ended, let's get back to business!**",
  "🤝 **The family feels complete again with your return.**",
  "🦁 **Legends never quit, they just take short breaks.**",
  "🔥 **Your comeback marks the rise of Hypershot Arena once more.**",
  "🏙️ **The city echoes louder when you're around.**",
  "🛡️ **Another soldier rejoins the battlefield.**",
  "⚡ **Stronger, sharper, and ready to rule again!**",
  "👑 **The Hypershot Arena welcomes its lion back to the den.**",
  "⏳ **The break is over — it's grind time again!**",
  "⚔️ **A true warrior always finds his way back home.**",
  "✨ **The throne shines brighter with your presence.**",
  "💫 **Your energy was missed, your return is celebrated.**",
  "🚀 **The squad just leveled up with your comeback.**",
  "🔱 **Back from LOA, back to domination!**",
  "🏆 **Your return signals new victories ahead.**",
  "🩸 **Royal blood never rests for long — welcome back!**"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("end-loa")
    .setDescription("📜 **End a member's LOA**")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("👤 **Select the user whose LOA ended**")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      // ✅ Role check
      if (!interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id))) {
        return await interaction.reply({
          content: "❌ **You don't have permission to use this command.**",
          ephemeral: true
        });
      }

      const targetUser = interaction.options.getUser("user");
      const endedBy = interaction.user;

      await interaction.reply({ content: "⏳ **Ending LOA...**", ephemeral: true });

      // 🎲 Random message pick
      const funMessage = messages[Math.floor(Math.random() * messages.length)];

      const endLoaEmbed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("✅ **END OF LOA NOTICE**")
        .setDescription(`⚔️ **${targetUser} is officially back from LOA!**`)
        .addFields(
          { name: "👤 **Member**", value: `${targetUser}`, inline: false },
          { name: "🛡️ **Ended By**", value: `${endedBy}`, inline: false },
          { name: "💬 **Message**", value: funMessage, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setImage("https://media.discordapp.net/attachments/1328281349471342593/1461291979408412841/standard_4.gif")
        .setFooter({ text: "⚜️ Hypershot Arena ⚜️", iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

      // Auto mention = user you selected
      const messageContent = `${targetUser}`;

      // 📢 Send to END LOA channel
      if (process.env.FIXED_END_LOA_CHANNEL_ID) {
        const loaChannel = await interaction.guild.channels.fetch(process.env.FIXED_END_LOA_CHANNEL_ID).catch(() => null);
        if (loaChannel) await loaChannel.send({ content: messageContent, embeds: [endLoaEmbed] });
      }

      // 📝 Also log it in the main log channel
      if (process.env.LOG_CHANNEL_ID) {
        const logChannel = await interaction.guild.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) await logChannel.send({ content: messageContent, embeds: [endLoaEmbed] });
      }

      await interaction.editReply({ content: `✅ **LOA ended successfully for ${targetUser.tag}**` });
    } catch (err) {
      console.error("❌ Error in /end-loa:", err);
      await interaction.editReply({ content: "⚠️ **Failed to end LOA.**" });
    }
  }
};
