const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const MAIN_LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID; // 📑 Main log channel

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("🏓 Check bot latency"),

    async execute(interaction) {
        // ⏳ First reply
        const sent = await interaction.reply({ content: "🏓 Pong!", fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;

        // 📌 Common embed
        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle("🏓 **Ping Command Used**")
            .setDescription(`📡 **Ping command executed by:** <@${interaction.user.id}>`)
            .addFields(
                { name: "👤 **User**", value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: false },
                { name: "⚡ **Latency**", value: `\`${latency}ms\``, inline: false },
                { name: "📅 **Date**", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setFooter({
                text: "👑Hypershot Arena Management",
                iconURL: interaction.client.user.displayAvatarURL() // bot profile pic
            })

        // ✅ Send log to main log channel
        const logChannel = interaction.guild.channels.cache.get(MAIN_LOG_CHANNEL_ID);
        if (logChannel) {
            await logChannel.send({ embeds: [embed] });
        }
    },
};
