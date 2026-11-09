const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("🖼️ Show a user's avatar")
        .addUserOption(option =>
            option.setName("user").setDescription("👤 Select a user").setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser("user") || interaction.user;

        // 📌 Main embed
        const embed = new EmbedBuilder()
            .setColor("#00ff99")
            .setTitle(`🖼️ ${user.username}'s Avatar`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setFooter({ text: `🙋 Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // 📝 Log to channel
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor("Blue")
                .setTitle("📜 Avatar Command Logged")
                .addFields(
                    { name: "👤 Requested By", value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: false },
                    { name: "🎯 Target User", value: `${user} (\`${user.id}\`)`, inline: false }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: "🖼️ Avatar Logger" })
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
        }
    },
};
