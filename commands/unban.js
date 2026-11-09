const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

const LOG_CHANNEL_ID = process.env.UNBAN_CHANNEL_ID; // ✅ Fixed log channel for unban

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("♻️ Unban a user by ID")
    .addStringOption(option =>
      option.setName("userid")
        .setDescription("🔑 The ID of the user to unban")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const userId = interaction.options.getString("userid");

    try {
      await interaction.guild.members.unban(userId);

      // ✅ Reply only to moderator
      await interaction.reply({ content: `✅ Successfully unbanned <@${userId}>`, ephemeral: true });

      // 📢 Log embed
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor("Green")
          .setTitle("♻️ **Member Unbanned**")
          .addFields(
            { name: "👤 **User ID**", value: userId, inline: false },
            { name: "🛠️ **Moderator**", value: `${interaction.user} (${interaction.user.tag})`, inline: false },
            { name: "📅 **Date**", value: new Date().toLocaleString(), inline: false }
          )
          .setFooter({ text: "Hypershot Arena Moderation Logs" })
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error("❌ Unban error:", err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "❌ Couldn’t unban that user." });
      } else {
        await interaction.reply({ content: "❌ Couldn’t unban that user.", ephemeral: true });
      }
    }
  },
};
