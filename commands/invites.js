const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getUserInvites, getTopInviters } = require("../inviteTracker");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("invites")
    .setDescription("📊 View invite statistics or server invite leaderboard")
    .addSubcommand(sub =>
      sub
        .setName("user")
        .setDescription("Check invite stats of a user")
        .addUserOption(opt =>
          opt
            .setName("target")
            .setDescription("Select a user (leave blank to check your own)")
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("leaderboard")
        .setDescription("View top inviters in Hypershot Arena")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "user") {
      const targetUser = interaction.options.getUser("target") || interaction.user;
      const stats = getUserInvites(targetUser.id);

      const embed = new EmbedBuilder()
        .setColor("#00ffcc")
        .setTitle(`📨 **Invite Stats: ${targetUser.username}**`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(`📊 Here are the detailed invite stats for **<@${targetUser.id}>**:`)
        .addFields(
          { name: "🏆 **Total Valid Invites**", value: `\`${stats.total || 0}\``, inline: true },
          { name: "✅ **Regular**", value: `\`${stats.regular || 0}\``, inline: true },
          { name: "🚪 **Left**", value: `\`${stats.left || 0}\``, inline: true },
          { name: "⚠️ **Fake / Alt**", value: `\`${stats.fake || 0}\``, inline: true }
        )
        .setFooter({
          text: "Hypershot Arena • Invite Tracker",
          iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "leaderboard") {
      const top = getTopInviters(10);

      if (!top.length) {
        return interaction.reply({
          content: "ℹ️ No invite records found yet in this server.",
          ephemeral: true
        });
      }

      const medals = ["🥇", "🥈", "🥉"];
      const desc = top.map((entry, index) => {
        const medal = medals[index] || `**#${index + 1}**`;
        return `${medal} <@${entry.id}> — **${entry.total || 0}** invites *(+${entry.regular || 0} / -${entry.left || 0} left)*`;
      }).join("\n");

      const embed = new EmbedBuilder()
        .setColor("#ffd700")
        .setTitle("🏆 **HYPERSHOT ARENA — INVITE LEADERBOARD**")
        .setDescription(desc)
        .setFooter({
          text: "Hypershot Arena • Top Inviters",
          iconURL: interaction.client.user.displayAvatarURL()
        })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};
