const {
    EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder,
    TextInputStyle, ButtonBuilder, ButtonStyle, PermissionsBitField, MessageFlags, StringSelectMenuBuilder, OverwriteType
} = require('discord.js');
const transcript = require('discord-html-transcripts');
let config = require('./config.json');
let activeConfigPath = './config.json';
const fs = require('fs');

// Helpers
const steamLinksPath = './used_steam_links.json';
if (!fs.existsSync(steamLinksPath)) {
    fs.writeFileSync(steamLinksPath, JSON.stringify([]));
}

function normalizeSteamLink(link) {
    if (!link) return '';
    let normalized = link.trim().toLowerCase();
    while (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    const match = normalized.match(/steamcommunity\.com\/(.+)/);
    return match ? match[1] : normalized;
}

function isSteamLinkUsed(link, steamId64) {
    try {
        if (!fs.existsSync(steamLinksPath)) return false;
        const links = JSON.parse(fs.readFileSync(steamLinksPath, 'utf8'));
        const normalized = normalizeSteamLink(link);
        return links.some(entry => {
            if (typeof entry === 'string') return entry === normalized;
            if (entry.link && entry.link === normalized) return true;
            if (steamId64 && entry.steamId64 && entry.steamId64 === steamId64) return true;
            return false;
        });
    } catch { return false; }
}

function addSteamLink(userId, link, steamId64) {
    try {
        let links = [];
        if (fs.existsSync(steamLinksPath)) {
            links = JSON.parse(fs.readFileSync(steamLinksPath, 'utf8'));
        }
        const normalized = normalizeSteamLink(link);
        const exists = links.some(entry => {
            if (typeof entry === 'string') return entry === normalized;
            if (entry.link && entry.link === normalized) return true;
            if (steamId64 && entry.steamId64 && entry.steamId64 === steamId64) return true;
            return false;
        });
        if (!exists) {
            links.push({
                userId,
                link: normalized,
                steamId64: steamId64 || null,
                timestamp: new Date().toISOString()
            });
            fs.writeFileSync(steamLinksPath, JSON.stringify(links, null, 2));
        }
    } catch { }
}

async function verifySteamProfile(input) {
    if (!input || typeof input !== 'string') {
        return { valid: false, error: '❌ Please provide a valid Steam Profile link.' };
    }

    let url = input.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.startsWith('steamcommunity.com')) {
            url = 'https://' + url;
        } else if (/^\d{17}$/.test(url)) {
            url = `https://steamcommunity.com/profiles/${url}`;
        } else {
            url = `https://steamcommunity.com/id/${url}`;
        }
    } else if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
    }

    while (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    const profileMatch = url.match(/^https:\/\/(?:www\.)?steamcommunity\.com\/(profiles\/(\d{17})|id\/([a-zA-Z0-9_\-]+))$/i);
    if (!profileMatch) {
        return {
            valid: false,
            error: '❌ Invalid Steam Link format! Link must be like `https://steamcommunity.com/profiles/76561199847823814` or `https://steamcommunity.com/id/custom_name`.'
        };
    }

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
    };

    try {
        const response = await axios.get(url, { headers, timeout: 8000, validateStatus: () => true });

        if (response.status === 404) {
            return { valid: false, error: '❌ Steam Profile not found (404)! Please check your link.' };
        }

        const html = typeof response.data === 'string' ? response.data : '';
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : '';

        if (
            html.includes('The specified profile could not be found') ||
            title.includes('Steam Community :: Error') ||
            html.includes('error_ctn') ||
            html.includes('The specified profile could not be found.')
        ) {
            return {
                valid: false,
                error: '❌ This Steam Profile does not exist on Steam (Fake / Non-existent profile)! Please provide your genuine Steam profile link.'
            };
        }

        // Check if Steam profile is not set up / empty / unconfigured (like default question mark profiles)
        if (
            html.includes('This user has not yet set up their Steam Community profile') ||
            html.includes('has not yet set up their Steam Community profile') ||
            html.toLowerCase().includes('not yet set up their steam community profile')
        ) {
            return {
                valid: false,
                error: '❌ This Steam Profile has NOT been set up yet (Unconfigured/Fake Steam Account)! Please configure your Steam Community profile first and submit your real active profile.'
            };
        }

        let personaName = 'Unknown';
        const personaMatch = html.match(/<span class="actual_persona_name">([^<]+)<\/span>/i) ||
            html.match(/<span class="profile_header_size">([^<]+)<\/span>/i);
        if (personaMatch) {
            personaName = personaMatch[1].trim();
        } else if (title && title.includes('Steam Community ::')) {
            personaName = title.replace('Steam Community ::', '').trim();
        }

        let steamId64 = profileMatch[2] || null;
        if (!steamId64) {
            const idMatch = html.match(/"steamid":"(\d{17})"/i) || html.match(/steamid['"]\s*:\s*['"](\d{17})['"]/i);
            if (idMatch) {
                steamId64 = idMatch[1];
            }
        }

        let avatarUrl = null;
        const avatarMatch = html.match(/<div class="playerAvatar[^\"]*">\s*<img src="([^"]+)"/i) ||
            html.match(/<div class="playerAvatarAutoSizeInner">\s*<img src="([^"]+)"/i);
        if (avatarMatch) {
            avatarUrl = avatarMatch[1];
        }

        return {
            valid: true,
            url: url,
            steamId64: steamId64,
            personaName: personaName,
            avatarUrl: avatarUrl
        };
    } catch (err) {
        return {
            valid: false,
            error: `❌ Error verifying Steam profile with Steam servers: ${err.message}. Please try again.`
        };
    }
}

// Helpers
function getNextTicketNumber(client) {
    const activeCfg = (client && client.config) ? client.config : config;
    const savePath = (client && client.configPath) ? client.configPath : activeConfigPath;
    if (!activeCfg.tickets) activeCfg.tickets = {};
    if (typeof activeCfg.tickets.lastTicketTicketNumber !== 'number') {
        activeCfg.tickets.lastTicketTicketNumber = 0;
    }
    activeCfg.tickets.lastTicketTicketNumber++;
    try {
        fs.writeFileSync(savePath, JSON.stringify(activeCfg, null, 2));
    } catch (e) {
        if (!client?.isSilent) console.error("Error saving ticket number:", e.message);
    }
    return activeCfg.tickets.lastTicketTicketNumber.toString().padStart(4, '0');
}

function getMainMenuRow() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('main_menu').setPlaceholder('Select One')
            .addOptions([
                { label: 'SUPPORT', value: 'Support', emoji: '📩' },
                { label: 'WHITELIST', value: 'Whitelist', emoji: '📝' },
                { label: 'ASK FOR POV', value: 'Ticket', emoji: '📸' }
            ])
    );
}

module.exports = async (interaction, client) => {
    if (!interaction.guild) return;

    if (client && client.config) {
        config = client.config;
        if (client.configPath) activeConfigPath = client.configPath;
    }

    // Staff Roles helper
    const staffRoleIds = Array.isArray(config.tickets?.staffRoleId)
        ? config.tickets.staffRoleId
        : (config.tickets?.staffRoleId ? config.tickets.staffRoleId.split(',').map(id => id.trim()) : []);
    const staffMentions = staffRoleIds.map(id => `<@&${id}>`).join(' ');

    // --- 0. Slash Command Logic ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'resetstrem') {
        const targetUserId = interaction.options.getString('user_id');
        let isStaff = config.ownerId && interaction.user.id === config.ownerId;

        staffRoleIds.push('1487556733047013599'); // Include the specific role
        if (!isStaff && interaction.member) {
            isStaff = interaction.member.roles.cache.some(role => staffRoleIds.includes(role.id));
        }

        if (!isStaff && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: [MessageFlags.Ephemeral] });
        }

        try {
            if (fs.existsSync(steamLinksPath)) {
                let links = JSON.parse(fs.readFileSync(steamLinksPath, 'utf8'));
                const originalLength = links.length;
                links = links.filter(entry => {
                    if (typeof entry === 'object' && entry.userId === targetUserId) {
                        return false;
                    }
                    return true;
                });

                if (links.length < originalLength) {
                    fs.writeFileSync(steamLinksPath, JSON.stringify(links, null, 2));
                    return interaction.reply({ content: `✅ Successfully removed saved stream profile(s) for user <@${targetUserId}> (\`${targetUserId}\`).`, flags: [MessageFlags.Ephemeral] });
                } else {
                    return interaction.reply({ content: `⚠️ No saved stream profile found for user ID \`${targetUserId}\`.`, flags: [MessageFlags.Ephemeral] });
                }
            } else {
                return interaction.reply({ content: "⚠️ No stream profiles database found.", flags: [MessageFlags.Ephemeral] });
            }
        } catch (error) {
            return interaction.reply({ content: `❌ An error occurred: ${error.message}`, flags: [MessageFlags.Ephemeral] });
        }
    }

    // --- 1. Dropdown Menu Logic ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'main_menu') {
        const type = interaction.values[0];

        if (type === 'Whitelist') {
            const modal = new ModalBuilder().setCustomId('wl_modal').setTitle('Whitelist Application');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel("In City Name").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('gang').setLabel("Gang Name").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('steam').setLabel("Steam Profile Link").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            await interaction.showModal(modal);
        } else if (type === 'Support') {
            const modal = new ModalBuilder().setCustomId('support_modal').setTitle('Support Request');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('discord_name').setLabel("In City Name").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('issue').setLabel("Issue / Problem").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('steps').setLabel("Steps Tried (if any)").setStyle(TextInputStyle.Paragraph).setRequired(false)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('extra').setLabel("Additional Information").setStyle(TextInputStyle.Paragraph).setRequired(false))
            );
            await interaction.showModal(modal);
        } else if (type === 'Ticket' || type === 'POV') {
            const modal = new ModalBuilder().setCustomId('pov_modal').setTitle('Ask for POV');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('discord_name').setLabel("In City Name").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('char_name').setLabel("Character Name").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel("POV Reason").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('incity_id').setLabel("INCITY ID").setStyle(TextInputStyle.Short).setRequired(true))
            );
            await interaction.showModal(modal);
        }

        setTimeout(async () => {
            await interaction.message.edit({ components: [getMainMenuRow()] }).catch(() => { });
        }, 2000);
    }

    // --- 2. Channel Selection & Mode Selection Handling ---
    if (interaction.isChannelSelectMenu()) {
        const channelId = interaction.values[0];
        const type = interaction.customId === 'select_announce_channel' ? 'ann' : 'upd';

        const modeRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`select_mode_${type}_${channelId}`)
                .setPlaceholder('Select Message Style (Embed or Normal)')
                .addOptions([
                    { label: 'Embed Message', value: 'embed', emoji: '🖼️', description: 'With @everyone mention' },
                    { label: 'Normal Text', value: 'normal', emoji: '📝', description: 'No @everyone mention' }
                ])
        );

        await interaction.reply({ content: `✅ Channel selected: <#${channelId}>\nNow select the message style:`, components: [modeRow], flags: [MessageFlags.Ephemeral] });
        await interaction.message.delete().catch(() => { });
    }

    // --- Mode Selection Interaction ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_mode_')) {
        const [_, __, type, chanId] = interaction.customId.split('_');
        const mode = interaction.values[0];

        const modal = new ModalBuilder()
            .setCustomId(`final_${mode}_${type}_${chanId}`)
            .setTitle(type === 'ann' ? 'Create Announcement' : 'New Update Log');

        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel("Title (Optional)").setStyle(TextInputStyle.Short).setRequired(false)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel(type === 'ann' ? "Message" : "Changes/Fixes").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            // Image URL Field Added
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image').setLabel("Image URL (Optional)").setStyle(TextInputStyle.Short).setRequired(false))
        );

        await interaction.showModal(modal);
    }

    // --- 3. Modal Submit Logic ---
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'resetstrem_modal') {
            const targetUserId = interaction.fields.getTextInputValue('target_user_id');
            if (interaction.message) {
                await interaction.message.delete().catch(() => { });
            }
            try {
                if (fs.existsSync(steamLinksPath)) {
                    let links = JSON.parse(fs.readFileSync(steamLinksPath, 'utf8'));
                    const originalLength = links.length;
                    links = links.filter(entry => {
                        if (typeof entry === 'object' && entry.userId === targetUserId) {
                            return false;
                        }
                        return true;
                    });

                    if (links.length < originalLength) {
                        fs.writeFileSync(steamLinksPath, JSON.stringify(links, null, 2));
                        return interaction.reply({ content: `✅ Successfully removed saved stream profile(s) for user <@${targetUserId}> (\`${targetUserId}\`).`, flags: [MessageFlags.Ephemeral] });
                    } else {
                        return interaction.reply({ content: `⚠️ No saved stream profile found for user ID \`${targetUserId}\`.`, flags: [MessageFlags.Ephemeral] });
                    }
                } else {
                    return interaction.reply({ content: "⚠️ No stream profiles database found.", flags: [MessageFlags.Ephemeral] });
                }
            } catch (error) {
                return interaction.reply({ content: `❌ An error occurred: ${error.message}`, flags: [MessageFlags.Ephemeral] });
            }
        }

        // Announcement & Update Logic with Mode Handling
        if (interaction.customId.startsWith('final_')) {
            const [_, mode, type, chanId] = interaction.customId.split('_');
            const channel = interaction.guild.channels.cache.get(chanId);
            const titleInput = interaction.fields.getTextInputValue('title');
            const descInput = interaction.fields.getTextInputValue('desc');
            const imageInput = interaction.fields.getTextInputValue('image');

            if (mode === 'embed') {
                const embed = new EmbedBuilder()
                    .setDescription(type === 'upd' ? `\`\`\`diff\n${descInput}\n\`\`\`` : descInput)
                    .setColor(type === 'upd' ? 0x2ECC71 : 0x5865F2)
                    .setTimestamp();
                if (titleInput) embed.setTitle(titleInput);
                if (type === 'upd') embed.setFooter({ text: 'Server Update Log' });
                if (imageInput) embed.setImage(imageInput);

                // Embed mode hole @everyone mention jabe
                if (channel) await channel.send({ content: "@everyone", embeds: [embed] });
            } else {
                // Normal text hole @everyone jabe na (Sudhu title ar desc jabe)
                let content = "";
                if (titleInput) content += `**${titleInput}**\n\n`;
                content += type === 'upd' ? `\`\`\`diff\n${descInput}\n\`\`\`` : descInput;
                if (imageInput) content += `\n${imageInput}`;

                if (channel) await channel.send({ content: content });
            }
            await interaction.reply({ content: `✅ Message posted in <#${chanId}>`, flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId === 'wl_auto_modal') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const roleId = '1487556756560150798';
            const logChannelId = '1508426410312601731';
            const rawSteamLink = interaction.fields.getTextInputValue('steam');

            const steamVerification = await verifySteamProfile(rawSteamLink);
            if (!steamVerification.valid) {
                return interaction.editReply({ content: steamVerification.error });
            }

            if (isSteamLinkUsed(steamVerification.url, steamVerification.steamId64)) {
                return interaction.editReply({ content: '❌ This Steam Profile has already been used for whitelisting!' });
            }

            addSteamLink(interaction.user.id, steamVerification.url, steamVerification.steamId64);

            const wlLogChannel = interaction.guild.channels.cache.get(logChannelId);
            const embed = new EmbedBuilder()
                .setTitle('✅ Whitelist Verified').setColor(0x2ECC71).setTimestamp()
                .addFields(
                    { name: '👤 Discord User', value: `${interaction.user}`, inline: true },
                    { name: '🏙️ In City Name', value: interaction.fields.getTextInputValue('name'), inline: true },
                    { name: '🔫 Gang Name', value: interaction.fields.getTextInputValue('gang'), inline: true },
                    { name: '🎮 Steam Profile', value: `[${steamVerification.personaName}](${steamVerification.url})`, inline: true },
                    { name: '🆔 Steam ID64', value: `\`${steamVerification.steamId64 || 'N/A'}\``, inline: true },
                    { name: '🏷️ Steam Name', value: `\`${steamVerification.personaName}\``, inline: true }
                );

            if (steamVerification.avatarUrl) {
                embed.setThumbnail(steamVerification.avatarUrl);
            }

            const targetMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (targetMember) {
                await targetMember.roles.add(roleId).catch(console.error);
            }

            if (wlLogChannel) {
                await wlLogChannel.send({ embeds: [embed] });
            }

            await interaction.editReply({ content: '✅ You have been successfully whitelisted!' });
        }

        // Whitelist Application (Manual Staff Review)
        if (interaction.customId === 'wl_modal') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const rawSteamLink = interaction.fields.getTextInputValue('steam');

            const steamVerification = await verifySteamProfile(rawSteamLink);
            if (!steamVerification.valid) {
                return interaction.editReply({ content: steamVerification.error });
            }

            if (isSteamLinkUsed(steamVerification.url, steamVerification.steamId64)) {
                return interaction.editReply({ content: '❌ This Steam Profile has already been used for whitelisting!' });
            }

            addSteamLink(interaction.user.id, steamVerification.url, steamVerification.steamId64);

            const wlLogChannel = interaction.guild.channels.cache.get(config.tickets.whitelistLogChannelId);
            const embed = new EmbedBuilder()
                .setTitle('🔥 New Whitelist Application').setColor(0x5865F2).setTimestamp()
                .addFields(
                    { name: '👤 Discord User', value: `${interaction.user}`, inline: true },
                    { name: '🏙️ In City Name', value: interaction.fields.getTextInputValue('name'), inline: true },
                    { name: '🔫 Gang Name', value: interaction.fields.getTextInputValue('gang'), inline: true },
                    { name: '🎮 Steam Profile', value: `[${steamVerification.personaName}](${steamVerification.url})`, inline: true },
                    { name: '🆔 Steam ID64', value: `\`${steamVerification.steamId64 || 'N/A'}\``, inline: true },
                    { name: '🏷️ Steam Name', value: `\`${steamVerification.personaName}\``, inline: true }
                );

            if (steamVerification.avatarUrl) {
                embed.setThumbnail(steamVerification.avatarUrl);
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`approve_${interaction.user.id}`).setLabel('Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`reject_${interaction.user.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
            );

            if (wlLogChannel) await wlLogChannel.send({ content: staffMentions, embeds: [embed], components: [row] });
            await interaction.editReply({ content: '✅ Application submitted! Staff will review your application soon.' });
        }

        if (interaction.customId === 'support_modal' || interaction.customId === 'pov_modal') {
            const isPOV = interaction.customId === 'pov_modal';
            const ticketNum = getNextTicketNumber(client);
            const permissionOverwrites = [
                { id: interaction.guild.id, type: OverwriteType.Role, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, type: OverwriteType.Member, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
            ];

            for (const roleId of staffRoleIds) {
                permissionOverwrites.push({
                    id: roleId,
                    type: OverwriteType.Role,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
                });
            }

            const ticketChannel = await interaction.guild.channels.create({
                name: `Ticket-${ticketNum}`, parent: config.tickets.categoryId,
                permissionOverwrites: permissionOverwrites
            });

            const embed = new EmbedBuilder().setTitle(isPOV ? '📸 POV Request' : '🛠️ Support Request').setColor(isPOV ? 0x3498DB : 0x2ECC71);
            if (isPOV) {
                embed.addFields(
                    { name: 'User', value: `${interaction.user}`, inline: true },
                    { name: 'In City Name', value: interaction.fields.getTextInputValue('discord_name'), inline: true },
                    { name: 'Character Name', value: interaction.fields.getTextInputValue('char_name'), inline: true },
                    { name: 'INCITY ID', value: interaction.fields.getTextInputValue('incity_id'), inline: true },
                    { name: 'POV Reason', value: interaction.fields.getTextInputValue('reason') }
                );
            } else {
                embed.addFields(
                    { name: 'User', value: `${interaction.user}`, inline: true },
                    { name: 'In City Name', value: interaction.fields.getTextInputValue('discord_name'), inline: true },
                    { name: 'Issue', value: interaction.fields.getTextInputValue('issue') },
                    { name: 'Steps Tried', value: interaction.fields.getTextInputValue('steps') || 'None' },
                    { name: 'Additional Info', value: interaction.fields.getTextInputValue('extra') || 'None' }
                );
            }

            const closeBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('close_req').setLabel('Close').setStyle(ButtonStyle.Secondary).setEmoji('🔒'));
            await ticketChannel.send({ content: staffMentions, embeds: [embed], components: [closeBtn] });
            await interaction.reply({ content: `Ticket opened: ${ticketChannel}`, flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId.startsWith('reject_modal_')) {
            const userId = interaction.customId.split('_')[2];
            const reason = interaction.fields.getTextInputValue('reject_reason');
            const resultChan = interaction.guild.channels.cache.get(config.tickets.userResultChannelId);
            const rejectEmbed = new EmbedBuilder()
                .setTitle('Whitelist Application: Rejected ❌').setColor(0xED4245).setTimestamp()
                .setDescription(`Sorry <@${userId}>, your whitelist application has been **Rejected**.`)
                .addFields({ name: 'Reason', value: `\`\`\`${reason}\`\`\`` }, { name: 'Reviewer', value: `<@${interaction.user.id}>`, inline: true })
                .setFooter({ text: 'You can apply again later.' });

            if (resultChan) await resultChan.send({ content: `<@${userId}>`, embeds: [rejectEmbed] });
            if (interaction.message) await interaction.message.delete().catch(() => { });
            await interaction.reply({ content: 'Application rejected.', flags: [MessageFlags.Ephemeral] });
        }
    }

    // --- 4. Button Logic (Unaltered) ---
    if (interaction.isButton()) {
        if (interaction.customId === 'resetstrem_btn') {
            let isStaff = config.ownerId && interaction.user.id === config.ownerId;
            const checkRoles = [...staffRoleIds, '1487556733047013599'];
            if (!isStaff && interaction.member) {
                isStaff = interaction.member.roles.cache.some(role => checkRoles.includes(role.id));
            }
            if (!isStaff && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: [MessageFlags.Ephemeral] });
            }

            const modal = new ModalBuilder().setCustomId('resetstrem_modal').setTitle('Reset Steam Profile');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target_user_id').setLabel("Discord User ID").setStyle(TextInputStyle.Short).setRequired(true))
            );
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'verify_whitelist') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const roleId = (config.tickets?.whitelistRoleId && !config.tickets.whitelistRoleId.includes('YOUR_BOT'))
                ? config.tickets.whitelistRoleId
                : (config.whitelist?.roleId || '1487556756560150798');
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

            if (!member) {
                return interaction.editReply({ content: '❌ Could not find your member profile in this server.' });
            }

            if (member.roles.cache.has(roleId)) {
                return interaction.editReply({ content: '✅ You already have the **Whitelist** role! You can join the FiveM server.' });
            }

            try {
                await member.roles.add(roleId);
                const logChanId = config.tickets?.whitelistLogChannelId || config.tickets?.logChannelId;
                const logChan = interaction.guild.channels.cache.get(logChanId);

                if (logChan) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('✅ Whitelist Role Claimed (Button)')
                        .setColor(0x2ECC71)
                        .setTimestamp()
                        .addFields(
                            { name: '👤 User', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
                            { name: '🆔 User ID', value: `\`${interaction.user.id}\``, inline: true },
                            { name: '⚡ Method', value: '1-Click Whitelist Button', inline: true }
                        )
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
                    await logChan.send({ embeds: [logEmbed] }).catch(() => { });
                }

                return interaction.editReply({ content: '🎉 **Congratulations!** You have received the **Whitelist** role and can now join our Hypershot Arena server!' });
            } catch (err) {
                console.error("Whitelist Role Add Error:", err);
                return interaction.editReply({ content: `❌ Failed to give role. Please contact staff. Error: ${err.message}` });
            }
        }

        if (interaction.customId.startsWith('approve_')) {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const userId = interaction.customId.split('_')[1];
            const target = await interaction.guild.members.fetch(userId).catch(() => null);

            if (target) await target.roles.add(config.tickets.whitelistRoleId).catch(() => console.error("Role Error"));

            const resultChan = interaction.guild.channels.cache.get(config.tickets.userResultChannelId);
            const historyLogChan = interaction.guild.channels.cache.get("1441702089301430334");
            const oldEmbed = interaction.message.embeds[0];

            const approveEmbed = new EmbedBuilder()
                .setTitle('Whitelist Application: Approved ✅').setColor(0x2ECC71).setTimestamp()
                .setDescription(`Congratulations <@${userId}>! Your whitelist application has been **Approved**.`)
                .setThumbnail(target ? target.user.displayAvatarURL({ dynamic: true }) : null)
                .addFields({ name: 'Status', value: '🟢 Approved', inline: true }, { name: 'Reviewer', value: `<@${interaction.user.id}>`, inline: true });

            if (resultChan) await resultChan.send({ content: `<@${userId}>`, embeds: [approveEmbed] });

            if (historyLogChan && oldEmbed) {
                const finalLogEmbed = new EmbedBuilder()
                    .setTitle('✅ Whitelist Approved - Full Info').setColor(0x2ECC71).setTimestamp()
                    .addFields(oldEmbed.fields)
                    .addFields({ name: 'Approved By', value: `<@${interaction.user.id}>` })
                    .setThumbnail(target ? target.user.displayAvatarURL({ dynamic: true }) : null);
                await historyLogChan.send({ embeds: [finalLogEmbed] });
            }

            if (interaction.message) await interaction.message.delete().catch(() => { });
            await interaction.editReply({ content: 'Approved!' });
        }

        if (interaction.customId.startsWith('reject_')) {
            const userId = interaction.customId.split('_')[1];
            const modal = new ModalBuilder().setCustomId(`reject_modal_${userId}`).setTitle('Reject Reason');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reject_reason').setLabel("Reason").setStyle(TextInputStyle.Paragraph).setRequired(true)));
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'close_req') {
            const currentName = interaction.channel.name;
            if (currentName.toLowerCase().startsWith('closed-')) {
                return interaction.reply({ content: '⚠️ This ticket is already closed!', flags: [MessageFlags.Ephemeral] });
            }

            let ticketMemberId = null;
            for (const [id, overwrite] of interaction.channel.permissionOverwrites.cache) {
                if (overwrite.type === OverwriteType.Member && id !== client.user.id) {
                    ticketMemberId = id;
                    await interaction.channel.permissionOverwrites.edit(id, {
                        ViewChannel: false,
                        SendMessages: false
                    }).catch(() => { });
                }
            }

            const isCloserStaff = (config.ownerId && interaction.user.id === config.ownerId) ||
                (interaction.member && interaction.member.roles.cache.some(role => staffRoleIds.includes(role.id))) ||
                (interaction.member && interaction.member.permissions.has(PermissionsBitField.Flags.Administrator));

            const closedByMember = (ticketMemberId && interaction.user.id === ticketMemberId) || !isCloserStaff;

            let newName = currentName;
            if (currentName.toLowerCase().startsWith('ticket-')) {
                newName = currentName.replace(/^ticket-/i, 'closed-');
            } else {
                newName = `closed-${currentName}`;
            }

            await interaction.channel.setName(newName).catch(err => console.error('Failed to rename channel on close:', err));

            const redirectChannelId = config.tickets.RedirectCHANNELID || '1557098327328432279';
            const controls = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('reopen_ticket').setLabel('Reopen').setStyle(ButtonStyle.Success).setEmoji('🔓'),
                new ButtonBuilder().setCustomId('transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('📄'),
                new ButtonBuilder().setCustomId('delete').setLabel('Delete').setStyle(ButtonStyle.Danger).setEmoji('⛔')
            );

            const closedEmbed = new EmbedBuilder()
                .setTitle('🔒 Ticket Closed')
                .setColor(closedByMember ? 0xF1C40F : 0xED4245)
                .setDescription(
                    closedByMember
                        ? `⚠️ **Ticket was closed by the member (<@${interaction.user.id}>).**\n\nThe member has been removed from this ticket. Staff / Management can review the conversation, reopen the ticket, save a transcript, or delete the channel.`
                        : `🔒 **Ticket was closed by Staff (<@${interaction.user.id}>).**\n\nThe member has been removed from this ticket. Staff can reopen, save a transcript, or delete this channel.`
                )
                .addFields(
                    { name: '🎫 Ticket', value: `\`${newName}\``, inline: true },
                    { name: '👤 Ticket Creator', value: ticketMemberId ? `<@${ticketMemberId}>` : '`Unknown`', inline: true },
                    { name: '🔒 Closed By', value: `<@${interaction.user.id}> ${closedByMember ? '*(Member)*' : '*(Staff)*'}`, inline: true },
                    { name: '⏰ Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`, inline: false },
                    { name: '📌 Redirect Channel', value: `<#${redirectChannelId}>`, inline: false }
                )
                .setFooter({ text: 'Hypershot Arena Ticket System', iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined })
                .setTimestamp();

            await interaction.reply({
                embeds: [closedEmbed],
                components: [controls]
            });

            const logChannelId = config.tickets?.logChannelId;
            if (logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(logChannelId)
                    || await interaction.guild.channels.fetch(logChannelId).catch(() => null);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle(closedByMember ? '🔔 Member Closed Ticket' : '🔒 Ticket Closed by Staff')
                        .setColor(closedByMember ? 0xF39C12 : 0xE74C3C)
                        .setDescription(`Ticket channel **${newName}** (<#${interaction.channel.id}>) has been closed.`)
                        .addFields(
                            { name: '🎫 Ticket', value: `\`${newName}\` (<#${interaction.channel.id}>)`, inline: true },
                            { name: '👤 Creator', value: ticketMemberId ? `<@${ticketMemberId}>` : '`Unknown`', inline: true },
                            { name: '🔒 Closed By', value: `<@${interaction.user.id}> ${closedByMember ? '*(Member)*' : '*(Staff)*'}`, inline: true },
                            { name: '⏰ Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                        )
                        .setFooter({ text: 'Hypershot Arena Ticket System' })
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => { });
                }
            }
        }

        if (interaction.customId === 'reopen_ticket') {
            const isStaff = (config.ownerId && interaction.user.id === config.ownerId) ||
                (interaction.member && interaction.member.roles.cache.some(role => staffRoleIds.includes(role.id))) ||
                (interaction.member && interaction.member.permissions.has(PermissionsBitField.Flags.Administrator));

            if (!isStaff) {
                return interaction.reply({ content: '❌ Only Staff can reopen tickets!', flags: [MessageFlags.Ephemeral] });
            }

            const currentName = interaction.channel.name;
            if (!currentName.toLowerCase().startsWith('closed-')) {
                return interaction.reply({ content: '⚠️ This ticket is not closed!', flags: [MessageFlags.Ephemeral] });
            }

            let ticketMemberId = null;
            for (const [id, overwrite] of interaction.channel.permissionOverwrites.cache) {
                if (overwrite.type === OverwriteType.Member && id !== client.user.id) {
                    ticketMemberId = id;
                    await interaction.channel.permissionOverwrites.edit(id, {
                        ViewChannel: true,
                        SendMessages: true,
                        ReadMessageHistory: true
                    }).catch(() => { });
                }
            }

            let restoredName = currentName.replace(/^closed-/i, 'Ticket-');
            await interaction.channel.setName(restoredName).catch(err => console.error('Failed to rename channel on reopen:', err));

            const reopenEmbed = new EmbedBuilder()
                .setTitle('🔓 Ticket Reopened')
                .setColor(0x2ECC71)
                .setDescription(`This ticket has been reopened by <@${interaction.user.id}>.\n${ticketMemberId ? `<@${ticketMemberId}> has been restored and can now view and chat in this ticket again.` : ''}`)
                .addFields(
                    { name: '🎫 Ticket', value: `\`${restoredName}\``, inline: true },
                    { name: '👮 Reopened By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '👤 Ticket Creator', value: ticketMemberId ? `<@${ticketMemberId}>` : '`Unknown`', inline: true }
                )
                .setFooter({ text: 'Hypershot Arena Ticket System', iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined })
                .setTimestamp();

            const closeBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_req').setLabel('Close').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
            );

            await interaction.reply({
                content: ticketMemberId ? `<@${ticketMemberId}> your ticket has been reopened by Staff!` : undefined,
                embeds: [reopenEmbed],
                components: [closeBtn]
            });

            const logChannelId = config.tickets?.logChannelId;
            if (logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(logChannelId)
                    || await interaction.guild.channels.fetch(logChannelId).catch(() => null);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🔓 Ticket Reopened')
                        .setColor(0x2ECC71)
                        .addFields(
                            { name: '🎫 Ticket', value: `\`${restoredName}\` (<#${interaction.channel.id}>)`, inline: true },
                            { name: '👮 Reopened By', value: `<@${interaction.user.id}>`, inline: true },
                            { name: '👤 Creator', value: ticketMemberId ? `<@${ticketMemberId}>` : '`Unknown`', inline: true },
                            { name: '⏰ Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                        )
                        .setFooter({ text: 'Hypershot Arena Ticket System' })
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => { });
                }
            }
        }

        if (interaction.customId === 'transcript') {
            const hasStaffRole = (config.ownerId && interaction.user.id === config.ownerId) ||
                (interaction.member && interaction.member.roles.cache.some(role => staffRoleIds.includes(role.id))) ||
                (interaction.member && interaction.member.permissions.has(PermissionsBitField.Flags.Administrator));
            if (!hasStaffRole) {
                return interaction.reply({ content: '❌ Only Staff can generate transcripts!', flags: [MessageFlags.Ephemeral] });
            }

            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            try {
                const file = await transcript.createTranscript(interaction.channel, {
                    limit: -1,
                    fileName: `transcript-${interaction.channel.name}.html`,
                    poweredBy: false,
                    saveImages: true
                });

                const logChannelId = config.tickets.logChannelId;
                const logChannel = interaction.guild.channels.cache.get(logChannelId)
                    || await interaction.guild.channels.fetch(logChannelId).catch(() => null);

                if (!logChannel) {
                    return interaction.editReply(`❌ Log channel (<#${logChannelId}>) not found! Please check config.json.`);
                }

                const transcriptEmbed = new EmbedBuilder()
                    .setTitle(`📜 Ticket Transcript | #${interaction.channel.name}`)
                    .setColor(0x2ECC71)
                    .addFields(
                        { name: '🎫 Ticket', value: `\`${interaction.channel.name}\``, inline: true },
                        { name: '👮 Generated By', value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setDescription(
                        `**Status:** ✅ Transcript Saved\n` +
                        `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                        `💡 **How to View:**\n` +
                        `Click the button **"📄 Open / Download Transcript"** below or click the attached \`.html\` file to view the full interactive Discord chat history in your browser.`
                    )
                    .setFooter({ text: 'Hypershot Arena Ticket System', iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined })
                    .setTimestamp();

                const sentMsg = await logChannel.send({
                    embeds: [transcriptEmbed],
                    files: [file]
                });

                const attachment = sentMsg.attachments.first();
                const attachmentUrl = attachment ? attachment.url : null;

                if (attachmentUrl) {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('📄 Open / Download Transcript')
                            .setStyle(ButtonStyle.Link)
                            .setURL(attachmentUrl)
                    );
                    await sentMsg.edit({ components: [row] }).catch(() => { });

                    await interaction.editReply({
                        content: `✅ Transcript successfully saved to <#${logChannelId}>!`,
                        components: [row]
                    });
                } else {
                    await interaction.editReply({ content: `✅ Transcript saved to <#${logChannelId}>!` });
                }
            } catch (err) {
                console.error('Error generating transcript:', err);
                await interaction.editReply({ content: `❌ Failed to generate transcript: ${err.message}` });
            }
        }

        if (interaction.customId === 'delete') {
            const hasStaffRole = (config.ownerId && interaction.user.id === config.ownerId) ||
                (interaction.member && interaction.member.roles.cache.some(role => staffRoleIds.includes(role.id))) ||
                (interaction.member && interaction.member.permissions.has(PermissionsBitField.Flags.Administrator));
            if (!hasStaffRole) {
                return interaction.reply({ content: '❌ Only Staff can delete tickets!', flags: [MessageFlags.Ephemeral] });
            }

            await interaction.reply('⛔ Deleting ticket in 3 seconds...');
            setTimeout(() => interaction.channel.delete().catch(() => { }), 3000);
        }
    }
};