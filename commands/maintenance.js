const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasAdminPermission } = require('../fivemTicketSystem');
const fs = require('fs');
const path = require('path');

function getMaintenanceState() {
    try {
        const stateFile = path.join(__dirname, '../state.json');
        if (fs.existsSync(stateFile)) {
            const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            return Boolean(data.maintenance);
        }
    } catch (e) { }
    return false;
}

function setMaintenanceState(val) {
    try {
        const stateFile = path.join(__dirname, '../state.json');
        let data = {};
        if (fs.existsSync(stateFile)) {
            try { data = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (e) { }
        }
        data.maintenance = Boolean(val);
        fs.writeFileSync(stateFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) { }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maintenance')
        .setDescription('Enable, disable or check server maintenance mode')
        .addStringOption(opt =>
            opt.setName('status')
                .setDescription('Select maintenance mode status')
                .setRequired(false)
                .addChoices(
                    { name: '🟢 On (Staff Only)', value: 'on' },
                    { name: '🔴 Off (Public)', value: 'off' },
                    { name: '🔍 Check Status', value: 'status' }
                )),

    async execute(interaction, client) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({ content: '❌ You do not have permission to execute this command.', ephemeral: true });
        }

        const choice = interaction.options.getString('status') || 'status';

        if (choice === 'on') {
            setMaintenanceState(true);
            const embed = new EmbedBuilder()
                .setTitle('🛠️ Server Maintenance Enabled')
                .setDescription('Maintenance mode is now **ENABLED**. Only staff members can join the server.')
                .setColor(0xF59E0B)
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        } else if (choice === 'off') {
            setMaintenanceState(false);
            const embed = new EmbedBuilder()
                .setTitle('🟢 Server Maintenance Disabled')
                .setDescription('Maintenance mode is now **DISABLED**. The server is open to all whitelisted players.')
                .setColor(0x10B981)
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        } else {
            const current = getMaintenanceState();
            const embed = new EmbedBuilder()
                .setTitle('🔍 Maintenance Mode Status')
                .setDescription(`Server maintenance mode is currently: **${current ? '🟢 ON (Staff Only)' : '🔴 OFF (Public)'}**`)
                .setColor(current ? 0xF59E0B : 0x10B981)
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }
    }
};
