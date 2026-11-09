const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("strike-point")
    .setDescription("⚡ Assign strike points to a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
      o.setName("user")
        .setDescription("👤 Member to assign strike points")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("points")
        .setDescription("🔢 Number of strike points to assign")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("📄 Reason for the strike points")
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName("log")
        .setDescription("📢 Optional log channel")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const target = interaction.options.getUser("user");
      const points = interaction.options.getInteger("points");
      const reason = interaction.options.getString("reason");

      // ⏳ Confirm message
      await interaction.reply({ content: `⏳ Processing strike points for **${target.tag}**...`, ephemeral: true });

      // 🎨 Embed
      const embed = new EmbedBuilder()
        .setColor("DarkOrange")
        .setTitle("⚡ STRIKE POINT NOTICE ⚡")
        .setDescription(`**${points} strike point(s) have been assigned to ${target}.**`)
        .addFields(
          { name: "👤 **Member**", value: `${target}`, inline: false },
          { name: "🔢 **Points**", value: `${points}`, inline: false },
          { name: "📄 **Reason**", value: reason, inline: false },
          { name: "🛠️ **Issued By**", value: `${interaction.user}`, inline: false }
        )
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Hypershot Arena Moderation Logs" })
        .setTimestamp();

      // 📢 Send to log channel (custom or fallback)
      const logChannel =
        interaction.options.getChannel("log") ||
        (process.env.LOG_CHANNEL_ID
          ? await interaction.guild.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null)
          : null);

      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }

      // ✅ Confirm update
      await interaction.editReply({ content: `✅ Assigned **${points}** strike point(s) to **${target.tag}**.` });
    } catch (err) {
      console.error("❌ Strike-point command error:", err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "❌ Failed to assign strike points." });
      } else {
        await interaction.reply({ content: "❌ Failed to assign strike points.", ephemeral: true });
      }
    }
  }
};
