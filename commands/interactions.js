const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Replace with your log channel ID
const LOG_CHANNEL_ID = process.env.INTERACTION_LOG_CHANNEL_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("interactions")
    .setDescription("📒 Log an interaction with a member")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("👤 Member you interacted with")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("details")
        .setDescription("📝 Custom details text after the first bold line")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const target = interaction.options.getUser("user"); // Member you interacted with
      const details = interaction.options.getString("details");

      // ✅ Allowed role check from .env
      if (!process.env.ALLOWED_INTERACTION_ROLE) return interaction.reply({
        content: "⚠️ Server is not configured with allowed interaction roles.",
        ephemeral: true
      });

      const ALLOWED_ROLE = process.env.ALLOWED_INTERACTION_ROLE.split(",");
      if (!interaction.member.roles.cache.some(r => ALLOWED_ROLE.includes(r.id))) {
        return interaction.reply({
          content: "❌ You don't have permission to use this commands.",
          ephemeral: true
        });
      }


      await interaction.reply({
        content: `⏳ Logging interaction with **${target.tag}**...`,
        ephemeral: true
      });

      // Fetch your server member to get nickname
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

      // Embed with first line bold + multi-line details
      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("📒 INTERACTION LOG")
        .addFields(
          {
            name: "🧾",
            value: `Logged By\n${member ? `@${member.displayName}` : interaction.user.username}`,
            inline: false
          },
          {
            name: "📝",
            value: `Details\n**<@${target.id}>**\n${details}`,
            inline: false
          }
        )
        .setImage("https://media.discordapp.net/attachments/1328281349471342593/1461291979408412841/standard_4.gif")
        .setFooter({
          text: "👑 Hypershot Arena Management",
          iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();

      // Fetch the log channel
      const logChannel = await interaction.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (!logChannel) return interaction.editReply({ content: "⚠️ Log channel not found!" });

      // Send the embed (mention inside embed + multi-line)
      await logChannel.send({ embeds: [embed] });

      await interaction.editReply({
        content: `✅ Interaction with **${target.tag}** logged successfully in <#${LOG_CHANNEL_ID}>.`
      });

    } catch (err) {
      console.error("❌ Error in /interactions:", err);
      await interaction.editReply({ content: "⚠️ Failed to log interaction." });
    }
  }
};
