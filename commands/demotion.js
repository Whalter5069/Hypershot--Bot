const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

// Predefined demotion messages
const demotionMessages = [
  "📉 **A step down, but not the end of the journey.**",
  "⚖️ **With great power comes great responsibility — and lessons to learn.**",
  "👑 **The Syndicate expects growth from every setback.**",
  "🛡️ **Demotions are tough, but they build stronger leaders.**",
  "🤝 **Loyalty and discipline are the true marks of a soldier.**",
  "🔄 **Sometimes you step back, only to rise stronger.**",
  "🎖️ **Respect is earned, and roles must reflect actions.**",
  "🌟 **Every fall is an opportunity to rise again.**",
  "📌 **Discipline is key in the Hypershot Arena.**",
  "🔥 **This demotion is a reminder, not a defeat.**"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("demotion")
    .setDescription("📉 **Demote a member to a lower role**")
    .addUserOption(option =>
      option.setName("user")
        .setDescription("👤 **The user to demote**")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName("oldrole")
        .setDescription("🛑 **The role to remove**")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName("newrole")
        .setDescription("⬇️ **The new lower role to assign**")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("reason")
        .setDescription("✍️ **Reason for demotion**")
        .setRequired(true)
    )
    .addStringOption(option => {
      option.setName("message")
        .setDescription("💬 **Select a demotion message (optional)**")
        .setRequired(false);

      // Add up to 25 choices
      demotionMessages.slice(0, 25).forEach(msg => {
        option.addChoices({ name: msg.slice(0, 100), value: msg });
      });

      return option;
    }),

  async execute(interaction) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return await interaction.reply({
          content: "❌ **You don’t have permission to use this command.**",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("user");
      const oldRole = interaction.options.getRole("oldrole");
      const newRole = interaction.options.getRole("newrole");
      const reason = interaction.options.getString("reason");
      const selectedMessage = interaction.options.getString("message");

      const member = await interaction.guild.members.fetch(user.id);

      // Remove old role, add new role
      await member.roles.remove(oldRole).catch(() => null);
      await member.roles.add(newRole);

      // Use selected message OR random
      const finalMessage =
        selectedMessage || demotionMessages[Math.floor(Math.random() * demotionMessages.length)];

      // 🎨 Embed
      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("📉 **Demotion Notice**")
        .setDescription(
          `👤 **Member:** ${user}\n` +
          `⚔️ **Demoted By:** ${interaction.user}\n` +
          `🔻 **From Role:** ${oldRole}\n` +
          `⬇️ **To Role:** ${newRole}\n\n` +
          `✍️ **Reason:** ${reason}\n\n` +
          `💬 **Message:** ${finalMessage}`
        )
        .setImage("https://media.discordapp.net/attachments/1328281349471342593/1461291979408412841/standard_4.gif")
        .setFooter({ text: "⚜️ Hypershot Arena ⚜️", iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

      // 📢 Send to demotion channel
      if (process.env.DEMOTION_CHANNEL_ID) {
        const demoChannel = await interaction.guild.channels.fetch(process.env.DEMOTION_CHANNEL_ID).catch(() => null);
        if (demoChannel) await demoChannel.send({ content: `${user}`, embeds: [embed] });
      }

      // 📝 Log channel
      if (process.env.LOG_CHANNEL_ID) {
        const logChannel = await interaction.guild.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) await logChannel.send({ embeds: [embed] });
      }

      await interaction.reply({
        content: `📉 **${user} has been demoted from ${oldRole} ➝ ${newRole}.**`,
        ephemeral: true
      });

    } catch (err) {
      console.error("❌ Error in /demotion:", err);
      await interaction.reply({
        content: "❌ **Failed to demote user.**",
        ephemeral: true
      });
    }
  }
};
