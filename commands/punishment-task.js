const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("punishment-task")
    .setDescription("⚖️ Assign a punishment task to a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o =>
      o.setName("user")
        .setDescription("👤 Member to assign punishment task")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("task")
        .setDescription("📝 The punishment task to assign")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("📄 Reason for the punishment task")
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
      const task = interaction.options.getString("task");
      const reason = interaction.options.getString("reason");

      // ⏳ Processing message
      await interaction.reply({ content: `⏳ Processing punishment task for **${target.tag}**...`, ephemeral: true });

      // 📑 Embed
      const embed = new EmbedBuilder()
        .setColor("DarkRed")
        .setTitle("⚖️ **Punishment Task Notice**")
        .setDescription(`🚨 **A punishment task has been assigned to ${target}.**`)
        .addFields(
          { name: "👤 **Member**", value: `${target.tag} (\`${target.id}\`)`, inline: false },
          { name: "📝 **Task**", value: task, inline: false },
          { name: "📄 **Reason**", value: reason, inline: false },
          { name: "🛠️ **Assigned By**", value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: false },
          { name: "📅 **Date**", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setImage("https://media.discordapp.net/attachments/1328281349471342593/1461291979408412841/standard_4.gif")
        .setFooter({ text: "⚔️ Hypershot Arena Punishment Logs", iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

      // 📢 Log channel
      const logChannel =
        interaction.options.getChannel("log") ||
        (process.env.LOG_CHANNEL_ID
          ? await interaction.guild.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null)
          : null);

      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }

      // ✅ Confirm message
      await interaction.editReply({ content: `✅ Punishment task successfully assigned to **${target.tag}**.` });

      // 📩 DM the punished member
      try {
        await target.send(
          `⚠️ You have been assigned a **punishment task** in **${interaction.guild.name}**.\n\n📝 **Task:** ${task}\n📄 **Reason:** ${reason}\n🛠️ **Assigned By:** ${interaction.user.tag}`
        );
      } catch {
        console.log("❌ Could not DM punishment task to user.");
      }

    } catch (err) {
      console.error("❌ Punishment-task command error:", err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "❌ Failed to assign punishment task." });
      } else {
        await interaction.reply({ content: "❌ Failed to assign punishment task.", ephemeral: true });
      }
    }
  }
};
