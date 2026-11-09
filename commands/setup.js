const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { hasAdminPermission } = require('../fivemTicketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Send the Ticket Dropdown Panel (Support / Whitelist / POV)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({
                content: `⛔ **Permission Denied!** Administrator or Staff permissions required.`,
                ephemeral: true
            });
        }

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('main_menu')
                .setPlaceholder('Select One')
                .addOptions([
                    { label: 'SUPPORT', value: 'Support', emoji: '📩' },
                    { label: 'WHITELIST', value: 'Whitelist', emoji: '📝' },
                    { label: 'ASK FOR POV', value: 'Ticket', emoji: '📸' }
                ])
        );

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('Ticket')
            .setDescription('To create a ticket use the dropdown menu below')
            .setFooter({ text: 'Hypershot Arena Management' });

        await interaction.channel.send({ embeds: [embed], components: [menuRow] });
        await interaction.reply({ content: '✅ Ticket panel created successfully!', ephemeral: true });
    }
};
