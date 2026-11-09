const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

const UNMUTE_LOG_CHANNEL_ID = process.env.UNMUTE_LOG_CHANNEL_ID; // ✅ Unmute log channel
const MAIN_LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;   // ✅ Main moderation log channel

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("🔊 Remove timeout (unmute) a user")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("👤 User to unmute")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const user = interaction.options.getUser("user");

    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(null); // remove timeout

      // ✅ Ephemeral confirm
      await interaction.reply({ content: `✅ Successfully unmuted <@${user.id}>`, ephemeral: true });

      // 📢 Common embed
      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("🔊 **Member Unmuted**")
        .addFields(
          { name: "👤 **User**", value: `<@${user.id}> (${user.tag} • ${user.id})`, inline: false },
          { name: "🛠️ **Moderator**", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
          { name: "📅 **Date**", value: new Date().toLocaleString(), inline: false }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Hypershot Arena Moderation Logs" })
        .setTimestamp();

      // ✅ Dedicated unmute log channel
      const unmuteLogChannel = interaction.guild.channels.cache.get(UNMUTE_LOG_CHANNEL_ID);
      if (unmuteLogChannel) {
        await unmuteLogChannel.send({ embeds: [embed] });
      }

      // ✅ Main log channel
      const mainLogChannel = interaction.guild.channels.cache.get(MAIN_LOG_CHANNEL_ID);
      if (mainLogChannel) {
        await mainLogChannel.send({ embeds: [embed] });
      }

      // ✅ DM the unmuted user
      try {
        await user.send(`🔊 You have been **unmuted** in **${interaction.guild.name}**.`);
      } catch {
        console.log("❌ Could not send DM to user after unmute.");
      }
    } catch (err) {
      console.error("❌ Unmute Error:", err);
      await interaction.reply({ content: "❌ I couldn’t unmute that user.", ephemeral: true });
    }
  },
};
