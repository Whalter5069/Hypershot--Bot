const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

const MUTE_LOG_CHANNEL_ID = process.env.MUTE_LOG_CHANNEL_ID; // 🔇 Mute-log channel
const MAIN_LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID; // 📑 Main moderation log channel

module.exports = {
    data: new SlashCommandBuilder()
        .setName("mute")
        .setDescription("🔇 Mute (timeout) a user")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("👤 User to mute")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName("duration")
                .setDescription("⏳ Mute duration in minutes")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("📄 Reason for mute")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const user = interaction.options.getUser("user");
        const duration = interaction.options.getInteger("duration");
        const reason = interaction.options.getString("reason") || "⚠️ **No reason provided**";

        try {
            const member = await interaction.guild.members.fetch(user.id);

            // ⏳ Convert minutes → ms
            const muteMs = duration * 60 * 1000;
            await member.timeout(muteMs, reason);

            // ✅ Reply to moderator
            await interaction.reply({
                content: `✅ Successfully **muted** **${user.tag}** for **${duration} minutes** | 📄 Reason: **${reason}**`,
                ephemeral: true
            });

            // 📌 Common embed
            const embed = new EmbedBuilder()
                .setColor("Orange")
                .setTitle("🔇 **Member Muted**")
                .setDescription("🚫 **A member has been muted (timed out).**")
                .addFields(
                    { name: "👤 **User**", value: `${user.tag} (\`${user.id}\`)`, inline: false },
                    { name: "🛠️ **Moderator**", value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: false },
                    { name: "⏳ **Duration**", value: `${duration} minute(s)`, inline: false },
                    { name: "📄 **Reason**", value: reason, inline: false },
                    { name: "📅 **Date**", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: "⚔️ Hypershot Arena Moderation Logs", iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            // ✅ Send log to dedicated mute-log channel
            const muteLogChannel = interaction.guild.channels.cache.get(MUTE_LOG_CHANNEL_ID);
            if (muteLogChannel) await muteLogChannel.send({ embeds: [embed] });

            // ✅ Send log to main moderation log channel
            const mainLogChannel = interaction.guild.channels.cache.get(MAIN_LOG_CHANNEL_ID);
            if (mainLogChannel) await mainLogChannel.send({ embeds: [embed] });

            // ✅ DM to muted user
            try {
                await user.send(
                    `🔇 You have been **muted** in **${interaction.guild.name}** for **${duration} minutes**.\n📄 **Reason:** ${reason}\n🛠️ **Moderator:** ${interaction.user.tag}`
                );
            } catch {
                console.log("❌ Could not send DM to user after mute.");
            }

        } catch (err) {
            console.error("❌ Mute Error:", err);
            await interaction.reply({ content: "❌ I couldn’t mute that user. Maybe they have higher permissions?", ephemeral: true });
        }
    },
};
