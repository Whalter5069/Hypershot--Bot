const { SlashCommandBuilder } = require('discord.js');
const { buildWhitelistEmbed, trackWhitelistPanel, refreshWhitelistReactors, initOrUpdateWhitelistPanel, hasAdminPermission } = require('../fivemTicketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Send or update the Whitelist Verification Panel'),

    async execute(interaction, client) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({
                content: `⛔ **Permission Denied!** You must be an Administrator or Staff member to send the Whitelist panel.`,
                ephemeral: true
            });
        }
        await interaction.deferReply({ ephemeral: true });

        try {
            const dedicatedChanId = client?.config?.whitelist?.channelId || "1557102764734152894";
            if (interaction.channelId === dedicatedChanId) {
                await initOrUpdateWhitelistPanel(client);
                await interaction.editReply({ content: '✅ Whitelist panel verified and updated in this channel!' });
            } else {
                const embed = buildWhitelistEmbed(client);
                const sentMsg = await interaction.channel.send({ embeds: [embed] });
                await sentMsg.react('✅').catch(() => { });
                trackWhitelistPanel(sentMsg);
                refreshWhitelistReactors(client, sentMsg);
                await interaction.editReply({ content: '✅ Whitelist panel sent to this channel successfully!' });
            }
        } catch (err) {
            console.error('Error in /whitelist command:', err);
            await interaction.editReply({ content: `❌ Error sending whitelist panel: ${err.message}` });
        }
    }
};
