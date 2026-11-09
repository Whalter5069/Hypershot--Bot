const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasAdminPermission } = require('../fivemTicketSystem');
const fs = require('fs');
const path = require('path');

function getTestState() {
    try {
        const stateFile = path.join(__dirname, '../state.json');
        if (fs.existsSync(stateFile)) {
            const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            return Boolean(data.testMode);
        }
    } catch (e) { }
    return false;
}

function setTestState(val) {
    try {
        const stateFile = path.join(__dirname, '../state.json');
        let data = {};
        if (fs.existsSync(stateFile)) {
            try { data = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (e) { }
        }
        data.testMode = Boolean(val);
        fs.writeFileSync(stateFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) { }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testmode')
        .setDescription('Enable, disable or check server test mode (whitelist bypass)')
        .addStringOption(opt =>
            opt.setName('status')
                .setDescription('Select test mode status')
                .setRequired(false)
                .addChoices(
                    { name: '🟢 On (Allow All)', value: 'on' },
                    { name: '🔴 Off (Enforce Whitelist)', value: 'off' },
                    { name: '🔍 Check Status', value: 'status' }
                )),

    async execute(interaction, client) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({ content: '❌ You do not have permission to execute this command.', ephemeral: true });
        }

        const choice = interaction.options.getString('status') || 'status';

        if (choice === 'on') {
            setTestState(true);
            const embed = new EmbedBuilder()
                .setTitle('🧪 Server Test Mode Enabled')
                .setDescription('Test mode is now **ENABLED**. Whitelist enforcement is bypassed.')
                .setColor(0xF59E0B)
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        } else if (choice === 'off') {
            setTestState(false);
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Server Test Mode Disabled')
                .setDescription('Test mode is now **DISABLED**. Whitelist is strictly enforced.')
                .setColor(0x10B981)
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        } else {
            const current = getTestState();
            const embed = new EmbedBuilder()
                .setTitle('🔍 Test Mode Status')
                .setDescription(`Server test mode is currently: **${current ? '🟢 ON (Allow All)' : '🔴 OFF (Enforce Whitelist)'}**`)
                .setColor(current ? 0xF59E0B : 0x10B981)
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }
    }
};
