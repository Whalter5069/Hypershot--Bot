const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
    hasAdminPermission,
    getBanRoleId,
    loadNxBans,
    saveNxBans,
    getBDTimeString,
    syncUnbanWithFiveM,
    sendBanUnbanLogEmbed
} = require('../fivemTicketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unbanplayers')
        .setDescription('Unban a player and remove the blacklist role')
        .addStringOption(opt => opt.setName('target').setDescription('Ban ID (e.g. #HS-B3549) or Discord User ID').setRequired(true)),

    async execute(interaction, client) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({ content: '❌ You do not have permission to execute this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });
        const targetInput = interaction.options.getString('target').trim();
        const cleanTarget = targetInput.replace(/[<@!>#]/g, '').toUpperCase();
        const bans = loadNxBans();
        const author = interaction.user;
        const banRoleId = getBanRoleId();

        let foundRecord = null;
        for (const ban of bans) {
            const cleanBanId = ban.banId ? ban.banId.replace('#', '').toUpperCase() : '';
            if ((cleanBanId === cleanTarget || ban.discordId === targetInput.replace(/[<@!>]/g, '')) && ban.status === 'ACTIVE') {
                ban.status = 'UNBANNED';
                ban.unbannedAt = getBDTimeString();
                ban.unbannedBy = author.tag;
                foundRecord = ban;
                break;
            }
        }

        if (foundRecord) {
            saveNxBans(bans);
            await syncUnbanWithFiveM(foundRecord.banId, foundRecord.discordId, author.tag);

            if (banRoleId) {
                if (interaction.guild) {
                    try {
                        const m = await interaction.guild.members.fetch(foundRecord.discordId).catch(() => null);
                        if (m) await m.roles.remove(banRoleId, `Unbanned by ${author.tag}`).catch(() => { });
                    } catch (e) { }
                }

                for (const [, g] of client.guilds.cache) {
                    if (!interaction.guild || g.id !== interaction.guild.id) {
                        try {
                            const m = await g.members.fetch(foundRecord.discordId).catch(() => null);
                            if (m) await m.roles.remove(banRoleId, `Unbanned by ${author.tag}`).catch(() => { });
                        } catch (e) { }
                    }
                }
            }

            const unbanLogEmbed = new EmbedBuilder()
                .setColor(0x10B981)
                .setTitle('✅ Player Unbanned')
                .setDescription(`User <@${foundRecord.discordId}> (\`${foundRecord.banId}\`) has been unbanned. The Blacklist Role has been removed.`)
                .addFields(
                    { name: '🏷️ Ban ID', value: `\`${foundRecord.banId}\``, inline: true },
                    { name: '👤 Player', value: `<@${foundRecord.discordId}>`, inline: true },
                    { name: '🆔 Discord ID', value: `<@${foundRecord.discordId}> (\`${foundRecord.discordId}\`)`, inline: false },
                    { name: '🛡️ Unbanned By', value: `<@${author.id}>`, inline: true },
                    { name: '⏰ Unbanned At', value: foundRecord.unbannedAt || getBDTimeString(), inline: true }
                )
                .setFooter({ text: `Hypershot Arena Security • ${getBDTimeString()} (BST)` });
            sendBanUnbanLogEmbed(client, unbanLogEmbed);

            const embed = new EmbedBuilder()
                .setTitle(`✅ Player Unbanned Successfully`)
                .setColor(0x10B981)
                .setDescription(`The Blacklist Role has been removed for <@${foundRecord.discordId}> and the unban synced with FiveM.`)
                .addFields(
                    { name: '🏷️ Ban ID', value: `\`${foundRecord.banId}\``, inline: true },
                    { name: '👤 Player', value: `<@${foundRecord.discordId}>`, inline: true },
                    { name: '🛡️ Unbanned By', value: `<@${author.id}>`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({ content: `❌ No active ban record found for \`${targetInput}\`.` });
        }
    }
};
