const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
    hasAdminPermission,
    parseDuration,
    getBanRoleId,
    getWhitelistRoleId,
    getPlayerIdentifiersFromTxAdmin,
    loadNxBans,
    saveNxBans,
    generateNxBanId,
    getBDTimeString,
    syncBanWithFiveM,
    sendBanUnbanLogEmbed,
    getBanAnnounceChannelId,
    getSuspendedAnnounceChannelId
} = require('../fivemTicketSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banplayers')
        .setDescription('Ban or suspend a player and assign the blacklist role')
        .addUserOption(opt => opt.setName('user').setDescription('The user to ban').setRequired(true))
        .addStringOption(opt =>
            opt.setName('duration')
                .setDescription('Ban duration')
                .setRequired(false)
                .addChoices(
                    { name: '⛔ Permanent Ban', value: 'permanent' },
                    { name: '⏳ 7 Days (Suspension)', value: '7d' },
                    { name: '⏳ 15 Days (Suspension)', value: '15d' },
                    { name: '⏳ 30 Days (Suspension)', value: '30d' }
                ))
        .addStringOption(opt => opt.setName('reason').setDescription('Violation reason').setRequired(false)),

    async execute(interaction, client) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({ content: '❌ You do not have permission to execute this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });

        const targetUser = interaction.options.getUser('user');
        const durationInput = interaction.options.getString('duration') || 'permanent';
        const reason = interaction.options.getString('reason') || 'Violation of server rules';
        const durationInfo = parseDuration(durationInput);
        const isPermanent = durationInfo.isPermanent;
        const author = interaction.user;

        try {
            const banRoleId = getBanRoleId();
            const wlRoleId = getWhitelistRoleId();

            if (interaction.guild) {
                const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (member) {
                    if (banRoleId) await member.roles.add(banRoleId, `Banned by ${author.tag}: ${reason}`).catch(() => { });
                    if (wlRoleId && member.roles.cache.has(wlRoleId)) {
                        await member.roles.remove(wlRoleId, `Banned by ${author.tag}: ${reason}`).catch(() => { });
                    }
                }
            }

            const txProfile = await getPlayerIdentifiersFromTxAdmin(targetUser.id);
            const bans = loadNxBans();

            bans.forEach(b => {
                if (b.discordId === targetUser.id && b.status === 'ACTIVE') b.status = 'OVERWRITTEN';
            });

            const newBanId = generateNxBanId(bans);
            const currentTime = getBDTimeString();

            const newRecord = {
                banId: newBanId,
                discordId: targetUser.id,
                discordName: txProfile.name || targetUser.tag,
                reason: reason,
                duration: durationInfo.label,
                isPermanent: isPermanent,
                expireEpoch: durationInfo.expireEpoch,
                expireAt: durationInfo.expireAt,
                bannedById: author.id,
                bannedByName: author.tag,
                status: 'ACTIVE',
                identifiers: txProfile.identifiers,
                timestamp: currentTime
            };

            bans.unshift(newRecord);
            saveNxBans(bans);
            await syncBanWithFiveM(targetUser.id, txProfile.name, reason, author.tag, durationInfo.label, txProfile.identifiers);

            // Channel announcement
            const announceChanId = isPermanent ? getBanAnnounceChannelId() : getSuspendedAnnounceChannelId();
            try {
                const announceChan = interaction.guild?.channels.cache.get(announceChanId) || await client.channels.fetch(announceChanId).catch(() => null);
                if (announceChan && announceChan.isTextBased()) {
                    const idList = txProfile.identifiers && txProfile.identifiers.length > 0
                        ? txProfile.identifiers.join('\n')
                        : `discord:${targetUser.id}`;
                    const wlMention = `<@&${wlRoleId}>`;

                    if (isPermanent) {
                        await announceChan.send(`<@${targetUser.id}> You have been permanently banned from Hypershot Arena for ${reason}.\n\n\`\`\`\n${idList}\n\`\`\`\n${wlMention}`);
                    } else {
                        await announceChan.send(`<@${targetUser.id}> This user has been suspended ${durationInfo.label} for ${reason}.\n\n\`\`\`\n${idList}\n\`\`\`\n${wlMention}`);
                    }
                }
            } catch (chanErr) { }

            const logEmbed = new EmbedBuilder()
                .setColor(isPermanent ? 0xE74C3C : 0xF39C12)
                .setTitle(isPermanent ? '⛔ Player Permanently Banned' : '⏳ Player Suspended')
                .setDescription(`User **${txProfile.name}** (<@${targetUser.id}>) has been ${isPermanent ? 'permanently banned' : `suspended for **${durationInfo.label}**`}.`)
                .addFields(
                    { name: '🏷️ Ban ID', value: `\`${newRecord.banId}\``, inline: true },
                    { name: '👤 Player', value: `<@${targetUser.id}>`, inline: true },
                    { name: '⏳ Duration', value: durationInfo.label, inline: true },
                    { name: '🆔 Discord ID', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: false },
                    { name: '⚠️ Reason', value: reason, inline: false },
                    { name: '🛡️ Banned By', value: `<@${author.id}>`, inline: true },
                    { name: '📅 Expires At', value: durationInfo.expireAt || 'Never (Permanent)', inline: true }
                )
                .setFooter({ text: `Hypershot Arena Security • ${currentTime} (BST)` });
            sendBanUnbanLogEmbed(client, logEmbed);

            const replyEmbed = new EmbedBuilder()
                .setTitle(isPermanent ? `⛔ Player Banned Successfully` : `⏳ Player Suspended Successfully`)
                .setColor(isPermanent ? 0xEF4444 : 0xF59E0B)
                .setDescription(`User **${txProfile.name}** (<@${targetUser.id}>) has been ${isPermanent ? 'banned permanently' : `suspended for **${durationInfo.label}**`} and assigned Blacklist Role.`)
                .addFields(
                    { name: '🏷️ Ban ID', value: `\`${newRecord.banId}\``, inline: true },
                    { name: '👤 Player Name', value: `${txProfile.name}`, inline: true },
                    { name: '⏳ Duration', value: `${durationInfo.label}`, inline: true },
                    { name: '🆔 Discord ID', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: false },
                    { name: '🛡️ Banned By', value: `<@${author.id}>`, inline: true },
                    { name: '📅 Expires At', value: `${durationInfo.expireAt || 'Never (Permanent)'}`, inline: true },
                    { name: '⚠️ Reason', value: `${reason}`, inline: false }
                )
                .setFooter({ text: "Hypershot Arena Security" })
                .setTimestamp();

            await interaction.editReply({ embeds: [replyEmbed] });
        } catch (err) {
            console.error("Error in /banplayers:", err);
            await interaction.editReply({ content: `❌ Error processing ban: ${err.message}` });
        }
    }
};
