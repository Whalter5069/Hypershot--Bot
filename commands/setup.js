const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { hasAdminPermission } = require('../fivemTicketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Send the Ticket Dropdown Panel (Support / Unban Appeal / POV)')
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
                .setPlaceholder('Select a ticket category')
                .addOptions([
                    { label: 'SUPPORT', value: 'Support', description: 'General server support & inquiries', emoji: '📩' },
                    { label: 'UNBAN APPEAL', value: 'Appeal', description: 'Submit an appeal for your ban', emoji: '⚖️' },
                    { label: 'ASK FOR POV', value: 'Ticket', description: 'Request in-game combat POV', emoji: '📸' }
                ])
        );

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('🎫 Hypershot Arena — Support & Ticket System')
            .setDescription('Need help, want to appeal a ban, or need to request a combat POV?\nSelect the appropriate category from the dropdown menu below:\n\n📩 **Support** — General server & game support\n⚖️ **Unban Appeal** — Submit a ban appeal\n📸 **Ask For POV** — Request combat POV clip')
            .setFooter({ text: 'Hypershot Arena Management' })
            .setTimestamp();

        await interaction.channel.send({ embeds: [embed], components: [menuRow] });
        await interaction.reply({ content: '✅ Ticket panel created successfully!', ephemeral: true });
    }
};
