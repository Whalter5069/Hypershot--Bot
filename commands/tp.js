const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { syncTeleportWithFiveM, hasAdminPermission } = require('../fivemTicketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tp')
        .setDescription('Teleport a player to the arena by their server ID (vec4: 4396.77, 2784.68, 551.38, 288.17)')
        .addIntegerOption(opt =>
            opt.setName('id')
                .setDescription('In-game player server ID (e.g. 1, 2, 5)')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({ content: "❌ You do not have permission to run this command.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });
        const playerId = interaction.options.getInteger('id');

        try {
            const result = await syncTeleportWithFiveM(playerId, interaction.user.tag, interaction.user.id);

            if (result && result.success) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF88)
                    .setTitle('🚀 Player Teleported to Arena')
                    .setDescription(`Successfully teleported **${result.playerName || `Player ${playerId}`}** to the designated arena location.`)
                    .addFields(
                        { name: '👤 Player', value: `\`${result.playerName || 'Unknown'}\` (ID: \`${playerId}\`)`, inline: true },
                        { name: '📍 Coordinates', value: `\`vec4(4396.77, 2784.68, 551.38, 288.17)\``, inline: true },
                        { name: '🛡️ Executed By', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true }
                    )
                    .setFooter({ text: "Hypershot Arena Teleport System" })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply({
                    content: `❌ ${result?.message || `Failed to teleport Player ID \`${playerId}\`. Player is not online in the server.`}`
                });
            }
        } catch (err) {
            await interaction.editReply({
                content: `⚠️ Error executing teleport: ${err.message}`
            });
        }
    }
};
