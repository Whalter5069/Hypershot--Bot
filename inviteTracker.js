// inviteTracker.js
const fs = require("fs");
const path = require("path");
const { EmbedBuilder, Events, PermissionsBitField } = require("discord.js");

const DATA_FILE = path.join(__dirname, "data", "invites.json");

// Helper: load data safely
function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { inviters: {}, joined: {} };
        }
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch (err) {
        console.error("❌ Error loading invites.json:", err.message);
        return { inviters: {}, joined: {} };
    }
}

// Helper: save data safely
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("❌ Error saving invites.json:", err.message);
    }
}

// In-memory cache for invites
const guildInvitesCache = new Map(); // guildId -> Map(code -> uses)
const guildVanityCache = new Map();  // guildId -> vanityUses

// Cache all invites for a specific guild
async function cacheGuildInvites(guild) {
    try {
        if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            console.warn(`⚠️ Missing MANAGE_GUILD permission in "${guild.name}" to fetch invites.`);
        }

        const invites = await guild.invites.fetch().catch(() => null);
        const codeMap = new Map();

        if (invites) {
            for (const [code, invite] of invites) {
                codeMap.set(code, invite.uses || 0);
            }
        }
        guildInvitesCache.set(guild.id, codeMap);

        // Check Vanity URL if guild has the feature
        if (guild.features?.includes("VANITY_URL")) {
            const vanity = await guild.fetchVanityData().catch(() => null);
            if (vanity) {
                guildVanityCache.set(guild.id, vanity.uses || 0);
            }
        }
    } catch (err) {
        console.error(`❌ Failed to cache invites for guild ${guild.id}:`, err.message);
    }
}

// Initialize the invite tracker
function initInviteTracker(client) {
    console.log("⏳ Initializing Invite Tracker...");

    const INVITE_LOG_CHANNEL_ID = process.env.INVITE_LOG_CHANNEL_ID;

    // Cache invites for all guilds on ready
    for (const guild of client.guilds.cache.values()) {
        cacheGuildInvites(guild);
    }

    // Cache when joining a new guild
    client.on(Events.GuildCreate, async guild => {
        await cacheGuildInvites(guild);
    });

    // Track invite creations
    client.on(Events.InviteCreate, invite => {
        try {
            if (!invite.guild) return;
            const guildMap = guildInvitesCache.get(invite.guild.id) || new Map();
            guildMap.set(invite.code, invite.uses || 0);
            guildInvitesCache.set(invite.guild.id, guildMap);
        } catch (err) {
            console.error("❌ Error in InviteCreate handler:", err.message);
        }
    });

    // Track invite deletions
    client.on(Events.InviteDelete, invite => {
        try {
            if (!invite.guild) return;
            const guildMap = guildInvitesCache.get(invite.guild.id);
            if (guildMap) {
                guildMap.delete(invite.code);
            }
        } catch (err) {
            console.error("❌ Error in InviteDelete handler:", err.message);
        }
    });

    // ==========================================
    // MEMBER JOIN TRACKING
    // ==========================================
    client.on(Events.GuildMemberAdd, async member => {
        try {
            const guild = member.guild;
            if (!guild) return;

            const cachedInvites = guildInvitesCache.get(guild.id) || new Map();
            const currentInvites = await guild.invites.fetch().catch(() => null);

            let usedInvite = null;
            let inviter = null;
            let isVanity = false;

            if (currentInvites) {
                for (const [code, invite] of currentInvites) {
                    const cachedUses = cachedInvites.get(code) || 0;
                    if (invite.uses > cachedUses) {
                        usedInvite = invite;
                        inviter = invite.inviter;
                        break;
                    }
                }
            }

            // Check Vanity URL if no standard invite was matched
            if (!usedInvite && guild.features?.includes("VANITY_URL")) {
                const vanity = await guild.fetchVanityData().catch(() => null);
                if (vanity) {
                    const cachedVanityUses = guildVanityCache.get(guild.id) || 0;
                    if (vanity.uses > cachedVanityUses) {
                        isVanity = true;
                        guildVanityCache.set(guild.id, vanity.uses);
                    }
                }
            }

            // Update in-memory cache with current invites
            if (currentInvites) {
                const newCodeMap = new Map();
                for (const [code, invite] of currentInvites) {
                    newCodeMap.set(code, invite.uses || 0);
                }
                guildInvitesCache.set(guild.id, newCodeMap);
            }

            const data = loadData();
            if (!data.inviters) data.inviters = {};
            if (!data.joined) data.joined = {};

            // Account age check (< 3 days is considered fake/suspicious)
            const accountAgeMs = Date.now() - member.user.createdTimestamp;
            const isFake = accountAgeMs < (3 * 24 * 60 * 60 * 1000);

            let inviterStats = null;

            if (inviter && !inviter.bot) {
                if (!data.inviters[inviter.id]) {
                    data.inviters[inviter.id] = { regular: 0, left: 0, fake: 0, total: 0 };
                }

                if (isFake) {
                    data.inviters[inviter.id].fake = (data.inviters[inviter.id].fake || 0) + 1;
                } else {
                    data.inviters[inviter.id].regular = (data.inviters[inviter.id].regular || 0) + 1;
                }

                data.inviters[inviter.id].total = Math.max(
                    0,
                    (data.inviters[inviter.id].regular || 0) - (data.inviters[inviter.id].left || 0)
                );

                inviterStats = data.inviters[inviter.id];

                // Remember who invited this member
                data.joined[member.id] = {
                    inviterId: inviter.id,
                    code: usedInvite ? usedInvite.code : "unknown",
                    joinedAt: Date.now(),
                    isFake
                };

                saveData(data);
            } else if (isVanity) {
                data.joined[member.id] = {
                    inviterId: "vanity",
                    code: "vanity",
                    joinedAt: Date.now(),
                    isFake
                };
                saveData(data);
            } else {
                data.joined[member.id] = {
                    inviterId: "unknown",
                    code: "unknown",
                    joinedAt: Date.now(),
                    isFake
                };
                saveData(data);
            }

            // ==========================================
            // SEND LOG TO INVITE_LOG_CHANNEL_ID
            // ==========================================
            if (INVITE_LOG_CHANNEL_ID) {
                const logChannel = guild.channels.cache.get(INVITE_LOG_CHANNEL_ID)
                    || await guild.channels.fetch(INVITE_LOG_CHANNEL_ID).catch(() => null);

                if (logChannel) {
                    let embed;
                    if (inviter) {
                        embed = new EmbedBuilder()
                            .setColor("#00ff99")
                            .setTitle("📨 Member Joined via Invite")
                            .setDescription(`👋 <@${member.id}> (\`${member.user.tag}\`) joined the server!`)
                            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                            .addFields(
                                { name: "👤 **Member**", value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
                                { name: "🎯 **Invited By**", value: `<@${inviter.id}> (\`${inviter.tag}\`)`, inline: true },
                                { name: "🔗 **Invite Code**", value: usedInvite ? `\`${usedInvite.code}\` (${usedInvite.uses} uses)` : "`Unknown`", inline: true },
                                {
                                    name: "📊 **Inviter Stats**",
                                    value: `**${inviterStats.total}** total (${inviterStats.regular} regular, ${inviterStats.left} left, ${inviterStats.fake} fake)`,
                                    inline: false
                                },
                                {
                                    name: "📅 **Account Created**",
                                    value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R> ${isFake ? "⚠️ *(New Account)*" : "✅"}`,
                                    inline: true
                                },
                                {
                                    name: "👥 **Server Member Count**",
                                    value: `**#${guild.memberCount}**`,
                                    inline: true
                                }
                            )
                            .setFooter({
                                text: "Hypershot Arena • Invite Tracker",
                                iconURL: client.user.displayAvatarURL()
                            })
                            .setTimestamp();
                    } else if (isVanity) {
                        embed = new EmbedBuilder()
                            .setColor("#3498db")
                            .setTitle("🔗 Member Joined via Vanity URL")
                            .setDescription(`👋 <@${member.id}> joined using the server's **Custom Vanity URL**!`)
                            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                            .addFields(
                                { name: "👤 **Member**", value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
                                { name: "🔗 **Source**", value: "🌟 **Server Vanity URL**", inline: true },
                                { name: "👥 **Server Member Count**", value: `**#${guild.memberCount}**`, inline: true }
                            )
                            .setFooter({ text: "Hypershot Arena • Invite Tracker", iconURL: client.user.displayAvatarURL() })
                            .setTimestamp();
                    } else {
                        embed = new EmbedBuilder()
                            .setColor("#f39c12")
                            .setTitle("❓ Member Joined (Unknown / Direct Invite)")
                            .setDescription(`👋 <@${member.id}> joined using a direct invite, widget, or discovery.`)
                            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                            .addFields(
                                { name: "👤 **Member**", value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
                                { name: "🔗 **Source**", value: "`Direct / Unknown Invite`", inline: true },
                                { name: "👥 **Server Member Count**", value: `**#${guild.memberCount}**`, inline: true }
                            )
                            .setFooter({ text: "Hypershot Arena • Invite Tracker", iconURL: client.user.displayAvatarURL() })
                            .setTimestamp();
                    }

                    await logChannel.send({ embeds: [embed] }).catch(err => {
                        console.error("❌ Failed to send invite log:", err.message);
                    });
                }
            }
        } catch (err) {
            console.error("❌ Error in GuildMemberAdd invite tracking:", err);
        }
    });

    // ==========================================
    // MEMBER LEAVE TRACKING (DECREMENT INVITES)
    // ==========================================
    client.on(Events.GuildMemberRemove, async member => {
        try {
            const guild = member.guild;
            if (!guild) return;

            const data = loadData();
            const joinInfo = data.joined ? data.joined[member.id] : null;

            if (joinInfo && joinInfo.inviterId && joinInfo.inviterId !== "vanity" && joinInfo.inviterId !== "unknown") {
                const inviterId = joinInfo.inviterId;

                if (data.inviters && data.inviters[inviterId]) {
                    data.inviters[inviterId].left = (data.inviters[inviterId].left || 0) + 1;
                    data.inviters[inviterId].total = Math.max(
                        0,
                        (data.inviters[inviterId].regular || 0) - (data.inviters[inviterId].left || 0)
                    );
                    saveData(data);

                    const inviterStats = data.inviters[inviterId];

                    if (INVITE_LOG_CHANNEL_ID) {
                        const logChannel = guild.channels.cache.get(INVITE_LOG_CHANNEL_ID)
                            || await guild.channels.fetch(INVITE_LOG_CHANNEL_ID).catch(() => null);

                        if (logChannel) {
                            const leaveEmbed = new EmbedBuilder()
                                .setColor("#ff0055")
                                .setTitle("🚪 Member Left (Invite Count Updated)")
                                .setDescription(`📤 <@${member.id}> (\`${member.user?.tag || member.id}\`) left the server.`)
                                .setThumbnail(member.user ? member.user.displayAvatarURL({ dynamic: true }) : null)
                                .addFields(
                                    { name: "👤 **Member**", value: `<@${member.id}> (\`${member.id}\`)`, inline: true },
                                    { name: "🎯 **Originally Invited By**", value: `<@${inviterId}> (\`${inviterId}\`)`, inline: true },
                                    {
                                        name: "📊 **Inviter's Updated Stats**",
                                        value: `**${inviterStats.total}** total (${inviterStats.regular} regular, **${inviterStats.left} left**, ${inviterStats.fake} fake)`,
                                        inline: false
                                    }
                                )
                                .setFooter({ text: "Hypershot Arena • Invite Tracker", iconURL: client.user.displayAvatarURL() })
                                .setTimestamp();

                            await logChannel.send({ embeds: [leaveEmbed] }).catch(() => {});
                        }
                    }
                }
            }
        } catch (err) {
            console.error("❌ Error in GuildMemberRemove invite tracking:", err);
        }
    });

    console.log("✅ Invite Tracker initialized successfully.");
}

// Helper: Get user's invites
function getUserInvites(userId) {
    const data = loadData();
    return data.inviters[userId] || { regular: 0, left: 0, fake: 0, total: 0 };
}

// Helper: Get top inviters
function getTopInviters(limit = 10) {
    const data = loadData();
    const list = Object.entries(data.inviters || {}).map(([id, stats]) => ({
        id,
        ...stats
    }));

    list.sort((a, b) => (b.total || 0) - (a.total || 0));
    return list.slice(0, limit);
}

module.exports = {
    initInviteTracker,
    getUserInvites,
    getTopInviters
};
