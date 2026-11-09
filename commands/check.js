const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { hasAdminPermission, syncBansFromFiveM, getBanRoleId, getWhitelistRoleId } = require('../fivemTicketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('check')
        .setDescription('Check whitelist and staff status of a user')
        .addUserOption(opt => opt.setName('user').setDescription('The user to check').setRequired(true)),

    async execute(interaction, client) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({ content: '❌ You do not have permission to execute this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });
        const targetUser = interaction.options.getUser('user');
        await syncBansFromFiveM(client).catch(() => { });

        const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
        const banRoleId = getBanRoleId();
        const wlRoleId = getWhitelistRoleId();

        const hasBan = banRoleId && member && member.roles.cache.has(banRoleId);
        const hasWl = wlRoleId && member && member.roles.cache.has(wlRoleId);

        const embed = new EmbedBuilder()
            .setColor(hasBan ? 0xE74C3C : hasWl ? 0x2ECC71 : 0xF39C12)
            .setTitle(`🔍 User Check: ${targetUser.username}`)
            .addFields(
                { name: '👤 User', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: true },
                { name: '🛡️ Whitelist', value: hasWl ? '✅ **Whitelisted**' : '❌ **Not Whitelisted**', inline: true },
                { name: '⛔ Blacklist', value: hasBan ? '⛔ **BANNED**' : '✅ **Clean**', inline: true }
            )
            .setFooter({ text: "Hypershot Arena Security" });

        await interaction.editReply({ embeds: [embed] });
    }
};
