const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasAdminPermission, loadNxBans } = require('../fivemTicketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('baninfo')
        .setDescription('Lookup ban details and identifiers')
        .addStringOption(opt => opt.setName('target').setDescription('Ban ID (e.g. #HS-B3549) or Discord User ID').setRequired(true)),

    async execute(interaction, client) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({ content: '❌ You do not have permission to execute this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });
        const targetInput = interaction.options.getString('target').trim();
        const cleanTarget = targetInput.replace(/[<@!>#]/g, '').toUpperCase();
        const bans = loadNxBans();

        const record = bans.find(b => {
            const cleanBanId = b.banId ? b.banId.replace('#', '').toUpperCase() : '';
            return cleanBanId === cleanTarget || b.discordId === targetInput.replace(/[<@!>]/g, '');
        });

        if (!record) {
            return interaction.editReply({ content: `❌ No ban record found for \`${targetInput}\`.` });
        }

        let idList = '';
        const regularIds = record.identifiers ? record.identifiers.filter(id => !id.match(/^[0-9]:/)) : [];
        const hwIds = (record.hwids && record.hwids.length > 0) 
            ? record.hwids 
            : (record.identifiers ? record.identifiers.filter(id => id.match(/^[0-9]:/)) : []);

        if (regularIds.length > 0) {
            idList += 'Player Identifiers:\n' + regularIds.slice(0, 8).join('\n');
        }
        if (hwIds.length > 0) {
            idList += (idList ? '\n\n' : '') + 'Hardware IDs:\n' + hwIds.slice(0, 8).join('\n');
        }
        if (!idList) {
            idList = 'None captured';
        }

        const embed = new EmbedBuilder()
            .setTitle(`🔍 Ban Record: ${record.banId || 'N/A'}`)
            .setColor(record.status === 'ACTIVE' ? 0xEF4444 : 0x10B981)
            .addFields(
                { name: '👤 Player', value: `<@${record.discordId}> (\`${record.discordName || record.discordId}\`)`, inline: true },
                { name: '📊 Status', value: `**${record.status || 'UNKNOWN'}**`, inline: true },
                { name: '⏳ Duration', value: `${record.duration || 'Permanent'}`, inline: true },
                { name: '⚠️ Reason', value: `${record.reason || 'N/A'}`, inline: false },
                { name: '🛡️ Banned By', value: `<@${record.bannedById}> (\`${record.bannedByName || record.bannedById}\`)`, inline: true },
                { name: '📅 Date', value: `${record.timestamp || 'N/A'}`, inline: true },
                { name: '🪪 Identifiers', value: `\`\`\`\n${idList}\n\`\`\``, inline: false }
            )
            .setFooter({ text: "Hypershot Arena Security" });

        await interaction.editReply({ embeds: [embed] });
    }
};
