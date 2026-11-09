// logger.js
const { EmbedBuilder, AuditLogEvent } = require("discord.js");

// 🔗 Main Log Channel ID
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

module.exports = (client) => {
    // ✅ Utility → send embed to log channel
    const sendLog = async (guild, embed) => {
        try {
            if (!guild || !LOG_CHANNEL_ID) return;
            const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID) 
                || await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
            if (logChannel) await logChannel.send({ embeds: [embed] });
        } catch (err) {
            console.error("❌ Log send failed:", err.message);
        }
    };

    // ✅ Utility → build embed
    const buildEmbed = (color, title, desc, targetUser, ids, executor) => {
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`**${title}**`)
            .setDescription(desc || "*(no description)*")
            .addFields({ name: "**🆔 IDs**", value: ids || "N/A" })
            .setTimestamp()
            .setFooter({
                text: client.user.username,
                iconURL: client.user.displayAvatarURL()
            });

        if (targetUser && typeof targetUser.displayAvatarURL === "function") {
            embed.setAuthor({
                name: targetUser.tag || targetUser.username || "Unknown",
                iconURL: targetUser.displayAvatarURL({ dynamic: true })
            });
        }

        if (executor && executor.id) {
            embed.addFields({
                name: "**👮 BY**",
                value: `<@${executor.id}> (\`${executor.id}\`)`
            });
        }

        return embed;
    };

    // ✅ Member Join
    client.on("guildMemberAdd", (member) => {
        try {
            if (!member || !member.guild) return;
            const desc = `👤 <@${member.id}> joined the server.`;
            const ids = `<@${member.id}> (\`${member.id}\`)`;
            const embed = buildEmbed("Green", "✅ Member Joined", desc, member.user, ids);
            sendLog(member.guild, embed);
        } catch (err) {
            console.error("❌ Member add log error:", err);
        }
    });

    // ❌ Member Leave / Kick
    client.on("guildMemberRemove", async (member) => {
        try {
            if (!member || !member.guild) return;
            let desc, title, executor;
            try {
                const fetchedLogs = await member.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberKick,
                }).catch(() => null);
                const kickLog = fetchedLogs?.entries?.first();
                if (kickLog && kickLog.target?.id === member.id && (Date.now() - kickLog.createdTimestamp < 5000)) {
                    title = "🔨 Member Kicked";
                    desc = `👤 <@${member.id}> was kicked by <@${kickLog.executor?.id}>.`;
                    executor = kickLog.executor;
                } else {
                    title = "❌ Member Left";
                    desc = `👤 <@${member.id}> left the server.`;
                }
            } catch {
                title = "❌ Member Left";
                desc = `👤 <@${member.id}> left the server.`;
            }
            const ids = `<@${member.id}> (\`${member.id}\`)`;
            const embed = buildEmbed("Red", title, desc, member.user, ids, executor);
            sendLog(member.guild, embed);
        } catch (err) {
            console.error("❌ Member remove log error:", err);
        }
    });

    // 💬 Message Create
    client.on("messageCreate", (message) => {
        try {
            if (!message || !message.guild || !message.author || message.author.bot) return;
            const channelId = message.channel?.id || message.channelId;
            const desc = `💬 Message sent in <#${channelId}>`;
            const ids = `👤 User: <@${message.author.id}> (\`${message.author.id}\`)\n#️⃣ Channel: <#${channelId}> (\`${channelId}\`)`;
            const content = message.content 
                ? (message.content.length > 1000 ? message.content.substring(0, 1000) + "..." : message.content)
                : "*(embed/attachment)*";
            const embed = buildEmbed("Green", "💬 Message Sent", desc, message.author, ids)
                .addFields({ name: "**📝 Content**", value: content });
            sendLog(message.guild, embed);
        } catch (err) {
            console.error("❌ Message create log error:", err);
        }
    });

    // 🗑️ Message Delete
    client.on("messageDelete", async (message) => {
        try {
            if (!message || !message.guild) return;
            if (message.author?.bot) return;
            let executor;
            try {
                const audit = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete }).catch(() => null);
                const entry = audit?.entries?.first();
                if (entry && message.author?.id && entry.target?.id === message.author.id && (Date.now() - entry.createdTimestamp < 5000)) {
                    executor = entry.executor;
                }
            } catch {}
            const channelId = message.channel?.id || message.channelId;
            const desc = `🗑️ Message deleted in <#${channelId}>`;
            const ids = `👤 User: ${message.author ? `<@${message.author.id}> (\`${message.author.id}\`)` : "Unknown"}\n#️⃣ Channel: <#${channelId}> (\`${channelId}\`)`;
            const content = message.content 
                ? (message.content.length > 1000 ? message.content.substring(0, 1000) + "..." : message.content)
                : "*(embed/attachment or uncached)*";
            const embed = buildEmbed("Orange", "🗑️ Message Deleted", desc, message.author, ids, executor)
                .addFields({ name: "**📝 Content**", value: content });
            sendLog(message.guild, embed);
        } catch (err) {
            console.error("❌ Message delete log error:", err);
        }
    });

    // ✏️ Message Edit
    client.on("messageUpdate", (oldMsg, newMsg) => {
        try {
            const guild = newMsg?.guild || oldMsg?.guild;
            if (!guild) return;

            const author = newMsg?.author || oldMsg?.author;
            if (!author || author.bot) return;

            // In Discord, embed updates / unfurling triggers messageUpdate with unchanged content
            // Also if uncached, oldMsg.content might be null
            if (!oldMsg?.content || !newMsg?.content || oldMsg.content === newMsg.content) return;

            const channelId = newMsg.channelId || oldMsg.channelId || newMsg.channel?.id || oldMsg.channel?.id;
            const desc = `✏️ Message edited in <#${channelId}>`;
            const ids = `👤 User: <@${author.id}> (\`${author.id}\`)\n#️⃣ Channel: <#${channelId}> (\`${channelId}\`)`;
            
            const beforeContent = oldMsg.content.length > 1000 ? oldMsg.content.substring(0, 1000) + "..." : oldMsg.content;
            const afterContent = newMsg.content.length > 1000 ? newMsg.content.substring(0, 1000) + "..." : newMsg.content;

            const embed = buildEmbed("Blue", "✏️ Message Edited", desc, author, ids)
                .addFields(
                    { name: "**Before**", value: beforeContent || "*(empty)*" },
                    { name: "**After**", value: afterContent || "*(empty)*" }
                );
            sendLog(guild, embed);
        } catch (err) {
            console.error("❌ Message edit log error:", err);
        }
    });

    // 🔒 Ban
    client.on("guildBanAdd", async (ban) => {
        try {
            if (!ban || !ban.guild || !ban.user) return;
            let executor;
            try {
                const audit = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
                const entry = audit?.entries?.first();
                if (entry && entry.target?.id === ban.user.id && (Date.now() - entry.createdTimestamp < 5000)) {
                    executor = entry.executor;
                }
            } catch {}
            const desc = `🔒 <@${ban.user.id}> was banned.`;
            const ids = `<@${ban.user.id}> (\`${ban.user.id}\`)`;
            const embed = buildEmbed("DarkRed", "🔒 Member Banned", desc, ban.user, ids, executor);
            sendLog(ban.guild, embed);
        } catch (err) {
            console.error("❌ Ban add log error:", err);
        }
    });

    // 🔓 Unban
    client.on("guildBanRemove", async (ban) => {
        try {
            if (!ban || !ban.guild || !ban.user) return;
            let executor;
            try {
                const audit = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanRemove }).catch(() => null);
                const entry = audit?.entries?.first();
                if (entry && entry.target?.id === ban.user.id && (Date.now() - entry.createdTimestamp < 5000)) {
                    executor = entry.executor;
                }
            } catch {}
            const desc = `🔓 <@${ban.user.id}> was unbanned.`;
            const ids = `<@${ban.user.id}> (\`${ban.user.id}\`)`;
            const embed = buildEmbed("Green", "🔓 Member Unbanned", desc, ban.user, ids, executor);
            sendLog(ban.guild, embed);
        } catch (err) {
            console.error("❌ Ban remove log error:", err);
        }
    });

    // 📛 Nickname Change
    client.on("guildMemberUpdate", async (oldMember, newMember) => {
        try {
            if (!newMember || !newMember.guild) return;
            if (oldMember?.partial) await oldMember.fetch().catch(() => null);
            if (newMember.partial) await newMember.fetch().catch(() => null);

            if (oldMember && oldMember.nickname !== newMember.nickname) {
                let executor;
                try {
                    const audit = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate }).catch(() => null);
                    const entry = audit?.entries?.first();
                    if (entry && entry.target?.id === newMember.id && (Date.now() - entry.createdTimestamp < 5000)) {
                        executor = entry.executor;
                    }
                } catch {}

                const desc = `📛 Nickname changed for <@${newMember.id}>`;
                const ids = `<@${newMember.id}> (\`${newMember.id}\`)`;
                const oldNick = oldMember.nickname || oldMember.user?.username || "None";
                const newNick = newMember.nickname || newMember.user?.username || "None";

                const embed = buildEmbed("Yellow", "📛 Nickname Changed", desc, newMember.user, ids, executor || newMember.user)
                    .addFields(
                        { name: "**Before**", value: oldNick, inline: true },
                        { name: "**After**", value: newNick, inline: true }
                    );
                sendLog(newMember.guild, embed);
            }
        } catch (err) {
            console.error("❌ Nickname log error:", err);
        }
    });

    // 🎭 Role Add/Remove
    client.on("guildMemberUpdate", async (oldMember, newMember) => {
        try {
            if (!newMember || !newMember.guild) return;
            if (!oldMember?.roles?.cache || !newMember.roles?.cache) return;

            const oldRoles = oldMember.roles.cache.map(r => r.id);
            const newRoles = newMember.roles.cache.map(r => r.id);
            const added = newRoles.filter(r => !oldRoles.includes(r));
            const removed = oldRoles.filter(r => !newRoles.includes(r));

            if (added.length || removed.length) {
                let executor;
                try {
                    const audit = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate }).catch(() => null);
                    const entry = audit?.entries?.first();
                    if (entry && entry.target?.id === newMember.id && (Date.now() - entry.createdTimestamp < 5000)) {
                        executor = entry.executor;
                    }
                } catch {}

                if (added.length) {
                    const desc = `➕ Roles Given\n${added.map(r => `<@&${r}>`).join(", ")}`;
                    const ids = `<@${newMember.id}> (\`${newMember.id}\`)`;
                    const embed = buildEmbed("Green", "🎭 Role Added", desc, newMember.user, ids, executor);
                    sendLog(newMember.guild, embed);
                }
                if (removed.length) {
                    const desc = `➖ Roles Removed\n${removed.map(r => `<@&${r}>`).join(", ")}`;
                    const ids = `<@${newMember.id}> (\`${newMember.id}\`)`;
                    const embed = buildEmbed("Red", "🎭 Role Removed", desc, newMember.user, ids, executor);
                    sendLog(newMember.guild, embed);
                }
            }
        } catch (err) {
            console.error("❌ Role log error:", err);
        }
    });

    // 📡 Channel Create/Delete/Update
    client.on("channelCreate", async (channel) => {
        try {
            if (!channel || !channel.guild) return;
            let executor;
            try {
                const audit = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate }).catch(() => null);
                const entry = audit?.entries?.first();
                if (entry && (Date.now() - entry.createdTimestamp < 5000)) {
                    executor = entry.executor;
                }
            } catch {}
            const desc = `📡 Channel created: ${channel}`;
            const ids = `${channel.name} (\`${channel.id}\`)`;
            const embed = buildEmbed("Green", "📡 Channel Created", desc, executor, ids, executor);
            sendLog(channel.guild, embed);
        } catch (err) {
            console.error("❌ Channel create log error:", err);
        }
    });

    client.on("channelDelete", async (channel) => {
        try {
            if (!channel || !channel.guild) return;
            let executor;
            try {
                const audit = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
                const entry = audit?.entries?.first();
                if (entry && (Date.now() - entry.createdTimestamp < 5000)) {
                    executor = entry.executor;
                }
            } catch {}
            const desc = `❌ Channel deleted: ${channel.name}`;
            const ids = `${channel.name} (\`${channel.id}\`)`;
            const embed = buildEmbed("Red", "❌ Channel Deleted", desc, executor, ids, executor);
            sendLog(channel.guild, embed);
        } catch (err) {
            console.error("❌ Channel delete log error:", err);
        }
    });

    client.on("channelUpdate", async (oldChannel, newChannel) => {
        try {
            if (!newChannel || !newChannel.guild) return;
            if (oldChannel.name !== newChannel.name) {
                let executor;
                try {
                    const audit = await newChannel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate }).catch(() => null);
                    const entry = audit?.entries?.first();
                    if (entry && (Date.now() - entry.createdTimestamp < 5000)) {
                        executor = entry.executor;
                    }
                } catch {}
                const desc = `✏️ Channel renamed: \`${oldChannel.name}\` ➝ \`${newChannel.name}\``;
                const ids = `${oldChannel.name} (\`${oldChannel.id}\`) ➝ ${newChannel.name} (\`${newChannel.id}\`)`;
                const embed = buildEmbed("Yellow", "✏️ Channel Renamed", desc, executor, ids, executor);
                sendLog(newChannel.guild, embed);
            }
        } catch (err) {
            console.error("❌ Channel update log error:", err);
        }
    });

    // 🎭 Role Create/Delete/Update
    client.on("roleCreate", async (role) => {
        try {
            if (!role || !role.guild) return;
            let executor;
            try {
                const audit = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate }).catch(() => null);
                const entry = audit?.entries?.first();
                if (entry && (Date.now() - entry.createdTimestamp < 5000)) {
                    executor = entry.executor;
                }
            } catch {}
            const desc = `🎭 Role created: ${role}`;
            const ids = `${role.name} (\`${role.id}\`)`;
            const embed = buildEmbed("Green", "🎭 Role Created", desc, executor, ids, executor);
            sendLog(role.guild, embed);
        } catch (err) {
            console.error("❌ Role create log error:", err);
        }
    });

    client.on("roleDelete", async (role) => {
        try {
            if (!role || !role.guild) return;
            let executor;
            try {
                const audit = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
                const entry = audit?.entries?.first();
                if (entry && (Date.now() - entry.createdTimestamp < 5000)) {
                    executor = entry.executor;
                }
            } catch {}
            const desc = `❌ Role deleted: ${role.name}`;
            const ids = `${role.name} (\`${role.id}\`)`;
            const embed = buildEmbed("Red", "❌ Role Deleted", desc, executor, ids, executor);
            sendLog(role.guild, embed);
        } catch (err) {
            console.error("❌ Role delete log error:", err);
        }
    });

    client.on("roleUpdate", async (oldRole, newRole) => {
        try {
            if (!newRole || !newRole.guild) return;
            if (oldRole.name !== newRole.name) {
                let executor;
                try {
                    const audit = await newRole.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleUpdate }).catch(() => null);
                    const entry = audit?.entries?.first();
                    if (entry && (Date.now() - entry.createdTimestamp < 5000)) {
                        executor = entry.executor;
                    }
                } catch {}
                const desc = `🎭 Role renamed: \`${oldRole.name}\` ➝ \`${newRole.name}\``;
                const ids = `${oldRole.name} (\`${oldRole.id}\`) ➝ ${newRole.name} (\`${newRole.id}\`)`;
                const embed = buildEmbed("Yellow", "🎭 Role Renamed", desc, executor, ids, executor);
                sendLog(newRole.guild, embed);
            }
        } catch (err) {
            console.error("❌ Role update log error:", err);
        }
    });

    // 🎙️ Voice State
    client.on("voiceStateUpdate", (oldState, newState) => {
        try {
            const guild = newState.guild || oldState.guild;
            if (!guild) return;

            const member = newState.member || oldState.member;
            const user = member?.user;
            const userId = newState.id || oldState.id;

            if (!oldState.channel && newState.channel) {
                const desc = `🎙️ <@${userId}> joined voice channel 🔊 ${newState.channel}`;
                const ids = `<@${userId}> (\`${userId}\`)\n${newState.channel.name} (\`${newState.channel.id}\`)`;
                const embed = buildEmbed("Green", "🎙️ Voice Join", desc, user, ids);
                sendLog(guild, embed);
            } else if (oldState.channel && !newState.channel) {
                const desc = `🎙️ <@${userId}> left voice channel 🔊 ${oldState.channel}`;
                const ids = `<@${userId}> (\`${userId}\`)\n${oldState.channel.name} (\`${oldState.channel.id}\`)`;
                const embed = buildEmbed("Red", "🎙️ Voice Leave", desc, user, ids);
                sendLog(guild, embed);
            } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
                const desc = `🎙️ <@${userId}> moved from 🔊 ${oldState.channel} ➝ ${newState.channel}`;
                const ids = `<@${userId}> (\`${userId}\`)\n${oldState.channel.name} (\`${oldState.channel.id}\`)\n${newState.channel.name} (\`${newState.channel.id}\`)`;
                const embed = buildEmbed("Yellow", "🎙️ Voice Move", desc, user, ids);
                sendLog(guild, embed);
            }
        } catch (err) {
            console.error("❌ Voice state log error:", err);
        }
    });
};
