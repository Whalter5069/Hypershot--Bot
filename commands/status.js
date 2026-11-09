const { SlashCommandBuilder } = require('discord.js');
const { fetchServerStatus } = require('../fivemTicketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Show live FiveM server heartbeat, uptime and online players'),

    async execute(interaction, client) {
        await interaction.deferReply();
        try {
            const data = await fetchServerStatus(client);
            await interaction.editReply(data);
        } catch (err) {
            console.error('Error in /status command:', err);
            await interaction.editReply({ content: `❌ Error fetching server status: ${err.message}` });
        }
    }
};
