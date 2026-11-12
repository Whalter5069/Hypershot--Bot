// =============================================================================
// Hypershot Arena - FiveM Server Status, Whitelist, Security & Ticket System
// Consolidated module containing all functionality from my-ticket-bot
// =============================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    ChannelSelectMenuBuilder,
    ChannelType
} = require('discord.js');

let axios;
try {
    axios = require('axios');
} catch (err) {
    axios = {
        get: (rawUrl, options = {}) => {
            return new Promise((resolve, reject) => {
                try {
                    const parsedUrl = new URL(rawUrl);
                    const isHttps = parsedUrl.protocol === 'https:';
                    const lib = isHttps ? https : http;

                    const reqOptions = {
                        method: 'GET',
                        hostname: parsedUrl.hostname,
                        port: parsedUrl.port || (isHttps ? 443 : 80),
                        path: parsedUrl.pathname + parsedUrl.search,
                        headers: options.headers || {},
                        timeout: options.timeout || 5000
                    };

                    const req = lib.request(reqOptions, (res) => {
                        let rawData = '';
                        res.on('data', chunk => rawData += chunk);
                        res.on('end', () => {
                            let data = rawData;
                            try { data = JSON.parse(rawData); } catch (e) { }
                            const result = { status: res.statusCode, data: data, headers: res.headers };
                            if (options.validateStatus ? options.validateStatus(res.statusCode) : (res.statusCode >= 200 && res.statusCode < 300)) {
                                resolve(result);
                            } else {
                                const error = new Error(`Request failed with status code ${res.statusCode}`);
                                error.response = result;
                                reject(error);
                            }
                        });
                    });

                    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
                    req.on('error', reject);
                    req.end();
                } catch (e) { reject(e); }
            });
        },
        post: (rawUrl, postData = {}, options = {}) => {
            return new Promise((resolve, reject) => {
                try {
                    const parsedUrl = new URL(rawUrl);
                    const isHttps = parsedUrl.protocol === 'https:';
                    const lib = isHttps ? https : http;
                    const bodyStr = typeof postData === 'string' ? postData : JSON.stringify(postData);

                    const reqOptions = {
                        method: 'POST',
                        hostname: parsedUrl.hostname,
                        port: parsedUrl.port || (isHttps ? 443 : 80),
                        path: parsedUrl.pathname + parsedUrl.search,
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(bodyStr),
                            ...(options.headers || {})
                        },
                        timeout: options.timeout || 5000
                    };

                    const req = lib.request(reqOptions, (res) => {
                        let rawData = '';
                        res.on('data', chunk => rawData += chunk);
                        res.on('end', () => {
                            let data = rawData;
                            try { data = JSON.parse(rawData); } catch (e) { }
                            const result = { status: res.statusCode, data: data, headers: res.headers };
                            if (options.validateStatus ? options.validateStatus(res.statusCode) : (res.statusCode >= 200 && res.statusCode < 300)) {
                                resolve(result);
                            } else {
                                const error = new Error(`Request failed with status code ${res.statusCode}`);
                                error.response = result;
                                reject(error);
                            }
                        });
                    });

                    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
                    req.on('error', reject);
                    req.write(bodyStr);
                    req.end();
                } catch (e) { reject(e); }
            });
        }
    };
}

// -----------------------------------------------------------------------------
// Configuration & Paths
// -----------------------------------------------------------------------------
const configPath = path.join(__dirname, 'config.json');
let config = {};
try {
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (e) {
    console.error('❌ Error loading config.json:', e.message);
}

const restartScheduleFile = path.join(__dirname, 'restart_schedule.json');
const statusStateFile = path.join(__dirname, 'status_state.json');
const whitelistCountFile = path.join(__dirname, 'whitelist_count.json');
const whitelistPanelsFile = path.join(__dirname, 'whitelist_panels.json');
const localWindowsBansPath = 'D:/Hypershot Arena/resources/[standalone]/hs-whitelist/bans.json';
const localWindowsTxPath = 'D:/Hypershot Arena/txData/default/data/playersDB.json';
const localWindowsConfigPath = 'D:/Hypershot Arena/resources/[standalone]/hs-whitelist/config.lua';

let serverStartTime = null;
let lastStatusMessage = null;
let updateInterval = null;
let isStatusInitializing = false;
let statusServiceStarted = false;
let isSyncingBans = false;
const whitelistRefreshTimers = new Map();

// -----------------------------------------------------------------------------
// Restart Schedule Persistence
// -----------------------------------------------------------------------------
function loadRestartSchedule() {
    try {
        if (fs.existsSync(restartScheduleFile)) {
            return JSON.parse(fs.readFileSync(restartScheduleFile, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading restart_schedule.json:', e.message);
    }
    return null;
}

function saveRestartSchedule(data) {
    try {
        if (!data) {
            if (fs.existsSync(restartScheduleFile)) {
                fs.unlinkSync(restartScheduleFile);
            }
        } else {
            fs.writeFileSync(restartScheduleFile, JSON.stringify(data, null, 2), 'utf8');
        }
    } catch (e) {
        console.error('Error saving restart_schedule.json:', e.message);
    }
}

let restartSchedule = loadRestartSchedule();

function getRestartDisplay() {
    if (!restartSchedule) return "nothing scheduled";

    const now = new Date();
    const nowMs = now.getTime();

    // 1. Static Text
    if (restartSchedule.type === 'text') {
        return restartSchedule.text || "nothing scheduled";
    }

    // 2. Daily recurring times (e.g. ["18:00"] or ["06:00", "18:00"])
    if (restartSchedule.type === 'daily' && Array.isArray(restartSchedule.times) && restartSchedule.times.length > 0) {
        let upcomingList = [];

        for (const timeStr of restartSchedule.times) {
            const [hStr, mStr] = timeStr.split(':');
            const h = parseInt(hStr, 10);
            const m = parseInt(mStr, 10);

            let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
            let diffMs = targetDate.getTime() - nowMs;

            if (diffMs <= 0 && diffMs >= -5 * 60 * 1000) {
                return "Restarting soon...";
            }

            if (diffMs < -5 * 60 * 1000) {
                targetDate.setDate(targetDate.getDate() + 1);
                diffMs = targetDate.getTime() - nowMs;
            }

            upcomingList.push({ diffMs, timeStr });
        }

        upcomingList.sort((a, b) => a.diffMs - b.diffMs);
        const next = upcomingList[0];
        if (!next) return "nothing scheduled";

        let totalSeconds = Math.floor(next.diffMs / 1000);
        let hours = Math.floor(totalSeconds / 3600);
        let mins = Math.floor((totalSeconds % 3600) / 60);

        if (hours > 0) {
            return `in ${hours} hrs, ${mins} mins`;
        } else if (mins > 0) {
            return `in ${mins} mins`;
        } else {
            return `in less than a min`;
        }
    }

    // 3. Interval recurring
    if (restartSchedule.type === 'interval' && restartSchedule.hours) {
        const intervalMs = restartSchedule.hours * 3600 * 1000;
        const base = restartSchedule.baseTime || nowMs;
        let elapsed = (nowMs - base) % intervalMs;
        if (elapsed < 0) elapsed += intervalMs;
        let timeRemainingMs = intervalMs - elapsed;

        if (elapsed <= 5 * 60 * 1000 && nowMs > base) {
            return "Restarting soon...";
        }

        let totalSeconds = Math.floor(timeRemainingMs / 1000);
        let hours = Math.floor(totalSeconds / 3600);
        let mins = Math.floor((totalSeconds % 3600) / 60);

        if (hours > 0) {
            return `in ${hours} hrs, ${mins} mins`;
        } else if (mins > 0) {
            return `in ${mins} mins`;
        } else {
            return `in less than a min`;
        }
    }

    // 4. One-time Countdown
    if (restartSchedule.type === 'countdown' && restartSchedule.targetTimestamp) {
        let diffMs = restartSchedule.targetTimestamp - nowMs;
        if (diffMs <= 0 && diffMs >= -10 * 60 * 1000) {
            return "Restarting soon...";
        } else if (diffMs < -10 * 60 * 1000) {
            return "Restarting soon...";
        } else {
            let totalSeconds = Math.floor(diffMs / 1000);
            let hours = Math.floor(totalSeconds / 3600);
            let mins = Math.floor((totalSeconds % 3600) / 60);
            if (hours > 0) {
                return `in ${hours} hrs, ${mins} mins`;
            } else {
                return `in ${mins} mins`;
            }
        }
    }

    return "nothing scheduled";
}

function getSafeJoinUrl(raw) {
    if (!raw || typeof raw !== 'string') return 'https://cfx.re/join/lapbjv';
    const trimmed = raw.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('cfx.re/join/')) return `https://${trimmed}`;
    return `https://cfx.re/join/${trimmed}`;
}

// -----------------------------------------------------------------------------
// Live Server Status Fetcher & Embed
// -----------------------------------------------------------------------------
async function fetchServerStatus(client) {
    let status = "❌ Offline";
    let uptimeText = "Offline";
    let embedColor = "#ff0000";
    let playerCount = 0;
    let maxPlayers = config.serverStatus?.maxPlayers || "48";
    let playersText = "No players online";
    let txStatus = "❌ Offline";
    let restartTime = "nothing scheduled";

    try {
        const serverIP = config.serverStatus?.serverIP || "203.18.158.131";
        const serverPort = config.serverStatus?.serverPort || "30121";
        const txAdminPort = config.serverStatus?.txAdminPort || "40120";

        const headers = { 'Accept': 'application/json', 'User-Agent': 'HypershotBot/2.0' };

        const hostCandidates = [
            { ip: serverIP, port: serverPort, txPort: txAdminPort },
            { ip: '127.0.0.1', port: serverPort, txPort: txAdminPort },
            { ip: 'localhost', port: serverPort, txPort: txAdminPort }
        ];

        let arenaRes = null;
        let playersRes = null;
        let txStats = null;

        const probe = async (cand) => {
            const a = await axios.get(`http://${cand.ip}:${cand.port}/arena-status/status`, { headers, timeout: 3000 }).catch(() => null);
            if (a && a.data && a.data.success) return { arenaRes: a };
            const p = await axios.get(`http://${cand.ip}:${cand.port}/players.json`, { timeout: 3000 }).catch(() => null);
            if (p && Array.isArray(p.data)) {
                const t = await axios.get(`http://${cand.ip}:${cand.txPort}/stats.json`, { timeout: 3000 }).catch(() => null);
                return { playersRes: p, txStats: t };
            }
            const t = await axios.get(`http://${cand.ip}:${cand.txPort}/stats.json`, { timeout: 3000 }).catch(() => null);
            if (t && t.data && typeof t.data === 'object' && t.data.status) return { txStats: t };
            return null;
        };

        const results = await Promise.all(hostCandidates.map(c => probe(c).catch(() => null)));
        const hit = results.find(r => r && r.arenaRes) || results.find(r => r && r.playersRes) || results.find(r => r && r.txStats);
        if (hit) {
            arenaRes = hit.arenaRes || null;
            playersRes = hit.playersRes || null;
            txStats = hit.txStats || null;
        }

        if (arenaRes && arenaRes.data && arenaRes.data.success) {
            const data = arenaRes.data;
            status = "✅ Online";
            txStatus = "✅ Online";
            embedColor = "#1eff00";
            playerCount = data.players.current || 0;
            maxPlayers = data.players.max || maxPlayers;
            uptimeText = data.network.uptimeFormatted || "Online";

            const playerList = data.players.list || [];
            if (playerList.length > 0) {
                playersText = playerList.slice(0, 15).map(p => `• ${p.name} - \`${p.ping}ms\``).join("\n");
            } else {
                playersText = "No players online";
            }
        } else if (txStats && txStats.data && txStats.data.status) {
            const txStatusObj = txStats.data.status;

            if (txStatusObj === "starting" || txStatusObj === "restarting" || txStatusObj === "stopping") {
                status = "🟡 Partial / Restarting";
                embedColor = "#ffaa00";
                uptimeText = "Restarting...";
                serverStartTime = null;
                txStatus = `🟡 ${txStatusObj.charAt(0).toUpperCase() + txStatusObj.slice(1)}`;
            } else if (playersRes && Array.isArray(playersRes.data)) {
                status = "✅ Online";
                embedColor = "#1eff00";
                txStatus = "✅ Online";
                playerCount = playersRes.data.length;
                if (playerCount > 0) {
                    playersText = playersRes.data.slice(0, 15).map(p => `• ${p.name} - \`${p.ping}ms\``).join("\n");
                }

                if (txStats.data.serverUptime && txStats.data.serverUptime > 0) {
                    let totalSeconds = Math.floor(txStats.data.serverUptime / 1000);
                    let hrs = Math.floor(totalSeconds / 3600);
                    let mins = Math.floor((totalSeconds % 3600) / 60);
                    uptimeText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                } else {
                    if (!serverStartTime) serverStartTime = Date.now();
                    let diff = Date.now() - serverStartTime;
                    let h = Math.floor(diff / 3600000);
                    let m = Math.floor((diff % 3600000) / 60000);
                    uptimeText = `${h}h ${m}m`;
                }
            } else {
                status = "✅ Online (No Player Data)";
                embedColor = "#1eff00";
                txStatus = "✅ Online";
                playersText = "Unable to fetch player list.";
                if (!serverStartTime) serverStartTime = Date.now();
                let diff = Date.now() - serverStartTime;
                let h = Math.floor(diff / 3600000);
                let m = Math.floor((diff % 3600000) / 60000);
                uptimeText = h > 0 ? `${h}h ${m}m` : `${m}m`;
            }
        } else if (playersRes && Array.isArray(playersRes.data)) {
            status = "✅ Online";
            embedColor = "#1eff00";
            txStatus = "✅ Online";
            playerCount = playersRes.data.length;
            if (playerCount > 0) {
                playersText = playersRes.data.slice(0, 15).map(p => `• ${p.name} - \`${p.ping}ms\``).join("\n");
            }
            if (!serverStartTime) serverStartTime = Date.now();
            let diff = Date.now() - serverStartTime;
            let h = Math.floor(diff / 3600000);
            let m = Math.floor((diff % 3600000) / 60000);
            uptimeText = h > 0 ? `${h}h ${m}m` : `${m}m`;
        } else {
            status = "❌ Offline";
            embedColor = "#ff0000";
            txStatus = "❌ Offline";
            uptimeText = "Offline";
            serverStartTime = null;
        }
    } catch (err) {
        status = "❌ Offline";
        uptimeText = "Offline";
        embedColor = "#ff0000";
        txStatus = "❌ Offline";
        serverStartTime = null;
    }

    try {
        restartTime = getRestartDisplay();
    } catch (err) {
        restartTime = "nothing scheduled";
    }

    const validJoinUrl = getSafeJoinUrl(config.serverStatus?.joinLink);
    const displayConnect = validJoinUrl.replace(/^https?:\/\//i, '');

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(`**Online Players:**\n${playersText}`)
        .addFields(
            { name: "Server IP", value: `\`\`\`connect ${displayConnect}\`\`\`` },
            { name: "Server Heartbeat", value: `\`\`\`${status}\`\`\``, inline: true },
            { name: "Uptime", value: `\`\`\`${uptimeText}\`\`\``, inline: true },
            { name: "Online Players", value: `\`\`\`${playerCount}/${maxPlayers}\`\`\``, inline: true },
            { name: "Next Restart", value: `\`\`\`${restartTime}\`\`\``, inline: false }
        )
        .setImage("https://media.discordapp.net/attachments/1328002952236892180/1560750415945932901/hypershot_arena_animated.gif")
        .setFooter({ text: "Hypershot Arena 🟢", iconURL: client?.user ? client.user.displayAvatarURL() : undefined })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setEmoji("1560338514959274206").setLabel("Connect").setStyle(ButtonStyle.Link).setURL(validJoinUrl),
        new ButtonBuilder().setEmoji("1213171596810780672").setLabel("Hypershot Arena").setStyle(ButtonStyle.Link).setURL("https://discord.gg/kSSc5raM2a")
    );

    return { embeds: [embed], components: [row] };
}

function loadStatusState() {
    try {
        if (fs.existsSync(statusStateFile)) {
            return JSON.parse(fs.readFileSync(statusStateFile, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading status_state.json:', e.message);
    }
    return {};
}

function saveStatusState(state) {
    try {
        fs.writeFileSync(statusStateFile, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving status_state.json:', e.message);
    }
}

async function initOrUpdateServerStatus(client) {
    if (isStatusInitializing) return;
    isStatusInitializing = true;

    try {
        const targetChannelId = config.serverStatus?.channelId || "1557098327328432279";
        if (!targetChannelId) return;

        let channel = client.channels.cache.get(targetChannelId);
        if (!channel) {
            try {
                channel = await client.channels.fetch(targetChannelId);
            } catch (err) {
                console.warn(`⚠️ [Status] Could not fetch channel ${targetChannelId}:`, err.message);
                return;
            }
        }

        if (!channel || !channel.isTextBased()) {
            console.warn(`⚠️ [Status] Channel ${targetChannelId} is not a valid text channel.`);
            return;
        }

        const state = loadStatusState();
        let msg = null;

        if (state.messageId && state.channelId === targetChannelId) {
            try {
                msg = await channel.messages.fetch(state.messageId);
            } catch (e) {
                msg = null;
            }
        }

        if (!msg) {
            try {
                const recentMessages = await channel.messages.fetch({ limit: 25 });
                msg = recentMessages.find(m =>
                    m.author.id === client.user.id &&
                    m.embeds.length > 0 &&
                    (
                        m.embeds[0].footer?.text?.includes("Hypershot Arena") ||
                        m.embeds[0].fields?.some(f => f.name === "Server Heartbeat" || f.name === "Server IP")
                    )
                ) || null;
            } catch (e) { }
        }

        const data = await fetchServerStatus(client);

        if (msg) {
            await msg.edit(data).catch(() => null);
            lastStatusMessage = msg;
            saveStatusState({ channelId: targetChannelId, messageId: msg.id });
            console.log(`✅ [Status] Re-connected to existing live status board (${msg.id}) in #${channel.name}`);
        } else {
            const newMsg = await channel.send(data);
            lastStatusMessage = newMsg;
            saveStatusState({ channelId: targetChannelId, messageId: newMsg.id });
            console.log(`✅ [Status] Sent fresh live status board (${newMsg.id}) in #${channel.name}`);
        }
    } catch (err) {
        console.error('❌ [Status] Error in initOrUpdateServerStatus:', err);
    } finally {
        isStatusInitializing = false;
    }
}

function startLiveUpdate(client) {
    if (updateInterval) clearInterval(updateInterval);
    const intervalTime = config.serverStatus?.updateTime || 30000;

    updateInterval = setInterval(async () => {
        try {
            if (lastStatusMessage) {
                const data = await fetchServerStatus(client);
                await lastStatusMessage.edit(data).catch(async (err) => {
                    if (err.code === 10008 || err.code === 10003) {
                        console.warn('⚠️ [Status] Live status message was deleted/lost. Auto-recovering...');
                        lastStatusMessage = null;
                        await initOrUpdateServerStatus(client);
                    }
                });
            } else {
                await initOrUpdateServerStatus(client);
            }
        } catch (err) {
            console.error('⚠️ [Status] Error during live update interval:', err.message);
        }
    }, intervalTime);
}

async function startStatusService(client) {
    if (statusServiceStarted) return;
    statusServiceStarted = true;
    console.log('🔄 [Status] Auto-starting live server status service on bot boot...');
    await initOrUpdateServerStatus(client);
    startLiveUpdate(client);
}

// -----------------------------------------------------------------------------
// Whitelist Reaction Panel Tracking
// -----------------------------------------------------------------------------
function loadWhitelistPanels() {
    try {
        if (fs.existsSync(whitelistPanelsFile)) {
            const raw = fs.readFileSync(whitelistPanelsFile, 'utf8');
            const data = JSON.parse(raw);
            if (Array.isArray(data)) return data;
        }
    } catch (e) { }
    return [];
}

function trackWhitelistPanel(message) {
    if (!message || !message.channelId || !message.id) return;
    try {
        const panels = loadWhitelistPanels();
        if (!panels.some(p => p.channelId === message.channelId && p.messageId === message.id)) {
            panels.unshift({ channelId: message.channelId, messageId: message.id });
            fs.writeFileSync(whitelistPanelsFile, JSON.stringify(panels.slice(0, 50), null, 2), 'utf8');
        }
    } catch (e) { }
}

function readLocalWhitelistCount() {
    try {
        if (fs.existsSync(whitelistCountFile)) {
            const raw = fs.readFileSync(whitelistCountFile, 'utf8');
            const data = JSON.parse(raw);
            if (data && typeof data.count === 'number') return data.count;
        }
    } catch (e) { }
    return 0;
}

function buildWhitelistEmbed(client, localCount = 0) {
    const embed = new EmbedBuilder()
        .setTitle("🛡️ Hypershot Arena | Whitelist Access")
        .setDescription(
            "**Welcome to Hypershot Arena!** ⚔️\n\n" +
            "To gain access to the server and start playing, you need to be whitelisted.\n\n" +
            "📌 **How to get whitelisted?**\n" +
            "React with **✅** below to instantly receive your whitelist role and server access!\n\n" +
            "⚠️ **Need Help?**\n" +
            "If you face any issues while getting whitelisted, please create a ticket or reach out to our staff!\n\n" +
            "*Thank you for joining us, see you in the Arena!*"
        )
        .setColor("#2ECC71")
        .setImage("https://media.discordapp.net/attachments/1328002952236892180/1560750415945932901/hypershot_arena_animated.gif")
        .setThumbnail(client?.user ? client.user.displayAvatarURL({ dynamic: true }) : null)
        .setFooter({
            text: "Hypershot Arena • React ✅ for Whitelist",
            iconURL: client?.user ? client.user.displayAvatarURL() : undefined
        });

    return embed;
}

let isWhitelistInitializing = false;

async function initOrUpdateWhitelistPanel(client) {
    if (!client || !client.isReady()) return;
    if (isWhitelistInitializing) return;
    isWhitelistInitializing = true;

    try {
        const targetChannelId = config.whitelist?.channelId || "1557102764734152894";
        if (!targetChannelId) return;

        let channel = client.channels.cache.get(targetChannelId);
        if (!channel) {
            try {
                channel = await client.channels.fetch(targetChannelId);
            } catch (err) {
                console.warn(`⚠️ [Whitelist] Could not fetch channel ${targetChannelId}:`, err.message);
                return;
            }
        }

        if (!channel || !channel.isTextBased()) {
            console.warn(`⚠️ [Whitelist] Channel ${targetChannelId} is not a valid text channel.`);
            return;
        }

        // Fetch recent messages in the whitelist channel
        const recentMessages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
        let existingMsg = null;
        let oldForeignMsg = null;

        if (recentMessages) {
            // Find message authored by THIS current bot
            existingMsg = recentMessages.find(m =>
                m.author.id === client.user.id &&
                m.embeds.length > 0 &&
                m.embeds.some(e => e.title && e.title.toLowerCase().includes('whitelist'))
            ) || null;

            // Find any old whitelist message authored by another bot/user
            oldForeignMsg = recentMessages.find(m =>
                m.author.id !== client.user.id &&
                m.embeds.length > 0 &&
                m.embeds.some(e => e.title && e.title.toLowerCase().includes('whitelist'))
            ) || null;
        }

        const embed = buildWhitelistEmbed(client);

        if (existingMsg) {
            // Update existing message
            await existingMsg.edit({ embeds: [embed] }).catch(() => null);
            const hasCheck = existingMsg.reactions.cache.some(r => r.emoji.name === '✅' && r.me);
            if (!hasCheck) {
                await existingMsg.react('✅').catch(() => null);
            }
            trackWhitelistPanel(existingMsg);
            if (config.whitelist) {
                config.whitelist.messageId = existingMsg.id;
            }
            console.log(`✅ [Whitelist] Updated existing whitelist panel (${existingMsg.id}) in #${channel.name}`);
        } else {
            // No editable message from this bot exists
            // Delete old foreign whitelist message if present
            if (oldForeignMsg) {
                try {
                    await oldForeignMsg.delete().catch(() => null);
                    console.log(`🗑️ [Whitelist] Deleted outdated whitelist panel (${oldForeignMsg.id}) from previous bot.`);
                } catch (e) { }
            }

            // Instantly send fresh embed
            const newMsg = await channel.send({ embeds: [embed] });
            await newMsg.react('✅').catch(() => null);
            trackWhitelistPanel(newMsg);
            if (config.whitelist) {
                config.whitelist.messageId = newMsg.id;
                try {
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
                } catch (e) { }
            }
            console.log(`✅ [Whitelist] Sent fresh whitelist panel (${newMsg.id}) in #${channel.name}`);
        }
    } catch (err) {
        console.error('❌ [Whitelist] Error in initOrUpdateWhitelistPanel:', err);
    } finally {
        isWhitelistInitializing = false;
    }
}

async function refreshWhitelistReactors(client, message) {
    try {
        if (!message) return;
        if (message.partial) await message.fetch().catch(() => null);
        if (!message.guild) return;

        const base = message.embeds && message.embeds[0];
        if (!base || !base.title || !base.title.toLowerCase().includes('whitelist')) return;

        const reaction = message.reactions.cache.find(r => r.emoji.name === '✅');
        const count = reaction ? Math.max(0, reaction.count - (reaction.me ? 1 : 0)) : 0;

        try {
            fs.writeFileSync(whitelistCountFile, JSON.stringify({
                count,
                guildId: message.guild.id,
                guildName: message.guild.name,
                updatedAt: new Date().toISOString()
            }, null, 2), 'utf8');
        } catch (e) { }

        if (message.author && message.author.id === client.user.id) {
            const embed = EmbedBuilder.from(base);
            embed.setFields([]);
            embed.setFooter({
                text: "Hypershot Arena • React ✅ for Whitelist",
                iconURL: client.user.displayAvatarURL()
            });
            await message.edit({ embeds: [embed] }).catch(() => null);
        }
    } catch (e) {
        console.error('refreshWhitelistReactors error:', e.message);
    }
}

async function refreshAllTrackedPanels(client) {
    if (!client.isReady()) return;
    try {
        const panels = loadWhitelistPanels();
        for (const p of panels) {
            try {
                const ch = client.channels.cache.get(p.channelId) || await client.channels.fetch(p.channelId).catch(() => null);
                if (!ch) continue;
                const msg = ch.messages.cache.get(p.messageId) || await ch.messages.fetch(p.messageId).catch(() => null);
                if (msg) {
                    await refreshWhitelistReactors(client, msg);
                }
            } catch (err) { }
        }
    } catch (e) { }
}

async function autoDiscoverWhitelistPanels(client) {
    await initOrUpdateWhitelistPanel(client).catch(() => null);
}

// -----------------------------------------------------------------------------
// Security, FiveM Bans, Identifier DB & Teleport
// -----------------------------------------------------------------------------
function getBanAnnounceChannelId() {
    return config.security?.banAnnounceChannelId || "1557125473874747503";
}

function getSuspendedAnnounceChannelId() {
    return config.security?.suspendedAnnounceChannelId || "1557126743494627448";
}

function getBanRoleId() {
    return config.security?.banRoleId || "1557090669338693666";
}

function getWhitelistRoleId() {
    return config.whitelist?.roleId || config.tickets?.whitelistRoleId || "1557090669338693669";
}

function findNxWhitelistResourcePath() {
    const candidates = [
        'D:/Hypershot Arena/resources/[standalone]/hs-whitelist',
        'D:\\Hypershot Arena\\resources\\[standalone]\\hs-whitelist',
        'D:/hs-whitelist',
        'D:/BOT/hs-whitelist',
        'D:/BOT/host pvp/hs-whitelist',
        'D:/BOT/host pvp/HS-whitelist',
        path.join(__dirname, '../nx-whitelist'),
        path.join(__dirname, '..')
    ];
    for (const c of candidates) {
        try {
            if (fs.existsSync(c)) return c;
        } catch (e) { }
    }
    return null;
}

function getSafeFilePath(primaryPath, fallbackName) {
    try {
        if (primaryPath && fs.existsSync(primaryPath)) return primaryPath;
    } catch (e) { }
    const resDir = findNxWhitelistResourcePath();
    if (resDir) return path.join(resDir, fallbackName);
    return path.join(__dirname, fallbackName);
}

function getFiveMEndpoints(apiPath = '') {
    const serverIP = config.serverStatus?.serverIP || "203.18.158.131";
    const serverPort = config.serverStatus?.serverPort || "30121";

    let subPath = apiPath;
    const prefixMatch = subPath.match(/^\/(?:HS-whitelist|hs-whitelist|nx-whitelist)(.*)$/i);
    if (prefixMatch) subPath = prefixMatch[1] || '';
    if (!subPath.startsWith('/')) subPath = '/' + subPath;

    const resourceVariants = ['HS-whitelist', 'hs-whitelist', 'nx-whitelist'];
    const baseHosts = [
        `http://${serverIP}:${serverPort}`,
        `http://203.18.158.131:30121`,
        `http://127.0.0.1:${serverPort}`,
        `http://127.0.0.1:30121`,
        `http://localhost:30121`
    ];

    const endpoints = [];
    for (const r of resourceVariants) {
        for (const base of baseHosts) {
            endpoints.push(`${base}/${r}${subPath}`);
        }
    }
    return Array.from(new Set(endpoints));
}

function findTxDataPlayersDBPath() {
    const candidates = [
        'D:/Hypershot Arena/txData/default/data/playersDB.json',
        'D:\\Hypershot Arena\\txData\\default\\data\\playersDB.json',
        localWindowsTxPath,
        '/home/container/txData/default/data/playersDB.json'
    ];
    for (const c of candidates) {
        try {
            if (fs.existsSync(c)) return c;
        } catch (e) { }
    }
    return null;
}

function loadNxBans() {
    try {
        const p = getSafeFilePath(localWindowsBansPath, 'bans.json');
        if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf8');
            return JSON.parse(raw) || [];
        }
    } catch (e) { }
    return [];
}

function saveNxBans(bans) {
    const resDir = findNxWhitelistResourcePath();
    const targetPaths = [
        localWindowsBansPath,
        resDir ? path.join(resDir, 'bans.json') : null,
        path.join(__dirname, 'bans.json')
    ].filter(Boolean);

    for (const p of targetPaths) {
        try {
            const dir = path.dirname(p);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(p, JSON.stringify(bans, null, 4), 'utf8');
        } catch (e) { }
    }
}

function generateNxBanId(bans) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const banId = `#hs-B${rand}`;
    if (bans.some(b => b.banId && b.banId.toLowerCase() === banId.toLowerCase())) {
        return generateNxBanId(bans);
    }
    return banId;
}

function getBDTimeString(dateObj = new Date()) {
    return dateObj.toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

function parseDuration(input) {
    if (!input || input === '' || input === 'permanent' || input === 'perm' || input === '0' || input === 'perma') {
        return { label: 'Permanent', expireEpoch: null, expireAt: null, isPermanent: true };
    }
    const str = input.toLowerCase().trim();
    let seconds = 0;
    let label = 'Custom Duration';

    if (str === '7d' || str === '7' || str === '7 days' || str === '7days') {
        seconds = 7 * 86400;
        label = '7 days';
    } else if (str === '15d' || str === '15' || str === '15 days' || str === '15days') {
        seconds = 15 * 86400;
        label = '15 days';
    } else if (str === '30d' || str === '30' || str === '30 days' || str === '30days' || str === '1m' || str === '1 month') {
        seconds = 30 * 86400;
        label = '30 days';
    } else {
        const match = str.match(/^(\d+)\s*([a-zA-Z]*)$/);
        if (match) {
            const num = parseInt(match[1]);
            const unit = match[2];
            if (unit === 'h' || unit === 'hour' || unit === 'hours') {
                seconds = num * 3600;
                label = `${num} hours`;
            } else if (unit === 'm' || unit === 'min' || unit === 'minutes') {
                seconds = num * 60;
                label = `${num} minutes`;
            } else if (unit === 'w' || unit === 'week' || unit === 'weeks') {
                seconds = num * 7 * 86400;
                label = `${num} weeks`;
            } else {
                seconds = num * 86400;
                label = `${num} days`;
            }
        } else {
            return { label: 'Permanent', expireEpoch: null, expireAt: null, isPermanent: true };
        }
    }

    if (seconds <= 0) {
        return { label: 'Permanent', expireEpoch: null, expireAt: null, isPermanent: true };
    }

    const nowEpoch = Math.floor(Date.now() / 1000);
    const expireEpoch = nowEpoch + seconds;
    const expireAt = getBDTimeString(new Date(expireEpoch * 1000));

    return { label, expireEpoch, expireAt, isPermanent: false };
}

async function sendBanUnbanLogEmbed(client, embed) {
    try {
        const chanId = config.security?.banUnbanLogsChannelId || config.tickets?.logChannelId;
        if (!chanId) return;
        const channel = client.channels.cache.get(chanId) || await client.channels.fetch(chanId).catch(() => null);
        if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] }).catch(() => { });
        }
    } catch (e) { }
}

async function syncBanWithFiveM(discordId, name, reason, bannedBy, duration, identifiers, hwids) {
    const endpoints = getFiveMEndpoints('/HS-whitelist/api/ban');
    try {
        const result = await Promise.any(
            endpoints.map(ep =>
                axios.post(ep, {
                    discordId, name, reason, bannedBy, duration, identifiers, hwids,
                    skipAnnounce: true
                }, { timeout: 4000, validateStatus: s => s < 500 }).then(res => {
                    if (res && res.data && res.data.success) {
                        console.log(`✅ Synced ban for ${discordId} via (${ep})`);
                        return res.data;
                    }
                    throw new Error('not success');
                })
            )
        );
        return result;
    } catch (e) { return null; }
}

async function syncUnbanWithFiveM(banId, discordId, unbannedBy) {
    const endpoints = getFiveMEndpoints('/HS-whitelist/api/unban');
    try {
        const result = await Promise.any(
            endpoints.map(ep =>
                axios.post(ep, { banId, discordId, unbannedBy }, { timeout: 4000, validateStatus: s => s < 500 }).then(res => {
                    if (res && res.data && res.data.success) {
                        console.log(`✅ Synced unban for ${banId} via (${ep})`);
                        return res.data;
                    }
                    throw new Error('not success');
                })
            )
        );
        return result;
    } catch (e) { return null; }
}

async function syncTeleportWithFiveM(playerId, adminName, adminId, coords) {
    const endpoints = getFiveMEndpoints('/HS-whitelist/api/teleport');
    const targetCoords = coords || {
        x: 4396.77,
        y: 2784.68,
        z: 551.38,
        heading: 288.17
    };

    let lastResult = null;
    for (const ep of endpoints) {
        try {
            const res = await axios.post(ep, {
                playerId: parseInt(playerId),
                adminName: adminName || "Discord Staff",
                adminId: adminId || "",
                coords: targetCoords
            }, { timeout: 2500, validateStatus: status => status < 500 });

            if (res && res.data && res.data.success) {
                return res.data;
            }
            if (res && res.data) lastResult = res.data;
        } catch (e) { }
    }
    return lastResult || { success: false, message: "Teleport service offline or player not found in server." };
}

async function getPlayerIdentifiersFromTxAdmin(targetDiscordId) {
    let foundIds = [];
    let foundHwids = [];
    let foundName = null;

    const cleanDiscordId = String(targetDiscordId).replace(/[<@!>]/g, '').trim();

    // 1. Try querying FiveM HTTP API endpoint
    try {
        const endpoints = getFiveMEndpoints(`/HS-whitelist/api/player-profile?discordId=${cleanDiscordId}`);
        const result = await Promise.any(
            endpoints.map(ep =>
                axios.get(ep, { timeout: 3500, validateStatus: s => s < 500 }).then(res => {
                    if (res && res.data && res.data.success) {
                        return res.data;
                    }
                    throw new Error('no result');
                })
            )
        );
        if (result) {
            if (Array.isArray(result.identifiers) && result.identifiers.length > 0) {
                foundIds = result.identifiers;
            }
            if (Array.isArray(result.hwids) && result.hwids.length > 0) {
                foundHwids = result.hwids;
            }
            if (result.name && !result.name.includes('Discord User (')) {
                foundName = result.name;
            }
        }
    } catch (e) { }

    // 2. Query txAdmin playersDB.json directly (covers all online and offline players who ever joined)
    if (foundIds.length === 0 || foundHwids.length === 0) {
        try {
            const txPath = findTxDataPlayersDBPath();
            if (txPath && fs.existsSync(txPath)) {
                const raw = fs.readFileSync(txPath, 'utf8');
                const data = JSON.parse(raw);
                if (data.players && Array.isArray(data.players)) {
                    for (const player of data.players) {
                        if (player.ids && Array.isArray(player.ids) && player.ids.some(id => id.includes(cleanDiscordId))) {
                            if (foundIds.length === 0) foundIds = [...player.ids];
                            if (foundHwids.length === 0 && Array.isArray(player.hwids)) foundHwids = [...player.hwids];
                            if (!foundName && player.displayName) foundName = player.displayName;
                            break;
                        }
                    }
                }
            }
        } catch (e) { }
    }

    // 3. Fallback: Check players_history.json in hs-whitelist
    if (foundIds.length === 0 || foundHwids.length === 0) {
        try {
            const histPaths = [
                'D:/Hypershot Arena/resources/[standalone]/hs-whitelist/players_history.json',
                path.join(findNxWhitelistResourcePath() || '', 'players_history.json')
            ];
            for (const hp of histPaths) {
                if (hp && fs.existsSync(hp)) {
                    const histData = JSON.parse(fs.readFileSync(hp, 'utf8'));
                    if (histData && histData[cleanDiscordId]) {
                        const rec = histData[cleanDiscordId];
                        if (foundIds.length === 0 && rec.identifiers && Array.isArray(rec.identifiers)) foundIds = [...rec.identifiers];
                        if (foundHwids.length === 0 && rec.hwids && Array.isArray(rec.hwids)) foundHwids = [...rec.hwids];
                        if (!foundName && rec.name) foundName = rec.name;
                        break;
                    }
                }
            }
        } catch (e) { }
    }

    // Guarantee discord:<id> is in identifiers
    const discordTag = `discord:${cleanDiscordId}`;
    if (!foundIds.some(id => id === discordTag || id.includes(cleanDiscordId))) {
        foundIds.unshift(discordTag);
    }

    return {
        identifiers: foundIds,
        hwids: foundHwids,
        name: foundName || `Player (${cleanDiscordId})`
    };
}

async function syncBansFromFiveM(client) {
    if (isSyncingBans) return loadNxBans();
    isSyncingBans = true;

    try {
        const endpoints = getFiveMEndpoints('/HS-whitelist/api/bans');
        let remoteBans = null;

        try {
            remoteBans = await Promise.any(
                endpoints.map(ep =>
                    axios.get(ep, { timeout: 3500, validateStatus: s => s < 500 }).then(res => {
                        if (res && res.data && Array.isArray(res.data)) return res.data;
                        if (res && res.data && Array.isArray(res.data.bans)) return res.data.bans;
                        throw new Error('no bans data');
                    })
                )
            );
        } catch (e) { }

        if (remoteBans && Array.isArray(remoteBans)) {
            const localBans = loadNxBans();
            let modified = false;
            const banRoleId = getBanRoleId();

            for (const rBan of remoteBans) {
                const rClean = rBan.banId ? String(rBan.banId).replace(/[#\s]/g, '').toUpperCase() : '';
                if (!rClean) continue;

                const lMatch = localBans.find(b => {
                    const lClean = b.banId ? String(b.banId).replace(/[#\s]/g, '').toUpperCase() : '';
                    return lClean === rClean;
                });

                if (lMatch) {
                    if (lMatch.status === 'ACTIVE' && rBan.status === 'UNBANNED') {
                        lMatch.status = 'UNBANNED';
                        lMatch.unbannedAt = rBan.unbannedAt || getBDTimeString();
                        lMatch.unbannedBy = rBan.unbannedBy || 'Web Dashboard / FiveM';
                        modified = true;

                        if (banRoleId && lMatch.discordId && client) {
                            for (const [, g] of client.guilds.cache) {
                                try {
                                    const m = await g.members.fetch(lMatch.discordId).catch(() => null);
                                    if (m && m.roles.cache.has(banRoleId)) {
                                        await m.roles.remove(banRoleId, 'Unbanned via Web/FiveM Sync').catch(() => { });
                                    }
                                } catch (e) { }
                            }
                        }

                        if (client) {
                            const logEmbed = new EmbedBuilder()
                                .setColor(0x2ECC71)
                                .setTitle('✅ Player Unbanned (Web Dashboard / FiveM)')
                                .setDescription(`User <@${lMatch.discordId}> unbanned via **Web Dashboard / FiveM**.\nBlacklist role removed.`)
                                .addFields(
                                    { name: '🏷️ Ban ID', value: `\`${lMatch.banId || rBan.banId}\``, inline: true },
                                    { name: '👤 Player', value: `<@${lMatch.discordId}>`, inline: true },
                                    { name: '🛡️ Unbanned By', value: `${rBan.unbannedBy || 'Web Dashboard'}`, inline: true }
                                )
                                .setTimestamp();
                            sendBanUnbanLogEmbed(client, logEmbed);
                        }
                    } else if (lMatch.status !== rBan.status) {
                        lMatch.status = rBan.status;
                        modified = true;
                    }
                } else {
                    localBans.unshift(rBan);
                    modified = true;
                }
            }

            if (modified) {
                saveNxBans(localBans);
            }
            return localBans;
        }
    } catch (err) { } finally {
        isSyncingBans = false;
    }
    return loadNxBans();
}

function hasAdminPermission(member) {
    if (!member) return false;
    if (config.ownerId && member.id === config.ownerId) return true;
    if (member.permissions && member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
    const adminRoles = config.security?.adminRoles || [];
    if (member.roles && member.roles.cache) {
        return member.roles.cache.some(r => adminRoles.includes(r.id));
    }
    return false;
}

// Check rejoin member for active ban & restore blacklist role
async function checkRejoinBan(member) {
    try {
        await syncBansFromFiveM(member.client).catch(() => { });
        const bans = loadNxBans();
        const nowEpoch = Math.floor(Date.now() / 1000);

        const activeBan = bans.find(b =>
            b.discordId === member.id &&
            b.status === 'ACTIVE' &&
            (b.isPermanent || !b.expireEpoch || b.expireEpoch > nowEpoch)
        );

        if (activeBan) {
            const banRoleId = getBanRoleId();
            const wlRoleId = getWhitelistRoleId();

            if (banRoleId) {
                await member.roles.add(banRoleId, `Auto-Restore: Active Ban (${activeBan.banId})`).catch(() => { });
            }
            if (member.roles.cache.has(wlRoleId)) {
                await member.roles.remove(wlRoleId, 'Banned player — whitelist removed on rejoin').catch(() => { });
            }
            console.log(`🔒 [AutoBan] Restored ban role for ${member.user?.tag || member.id} on rejoin. Ban: ${activeBan.banId}`);
            return true;
        }
    } catch (e) {
        console.error('Error in checkRejoinBan:', e.message);
    }
    return false;
}

// -----------------------------------------------------------------------------
// HTTP Keep-Alive & bKash Server
// -----------------------------------------------------------------------------
function startHttpServers(client) {
    // 1. bKash TrxID HTTP Server (Port 3011)
    try {
        const apiServer = http.createServer((req, res) => {
            if (req.method === 'POST' && req.url === '/coin-request') {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body);
                        const channelId = config.coinLogChannelId || "1557154854990905425";
                        const channel = client.channels.cache.get(channelId);

                        if (channel) {
                            const embed = new EmbedBuilder()
                                .setTitle("💰 New XP Purchase Request")
                                .setColor("#ffcc00")
                                .addFields(
                                    { name: "Player", value: `${data.playerName} (ID: ${data.playerId})`, inline: true },
                                    { name: "Package", value: `${data.amount} XP (৳${data.price})`, inline: true },
                                    { name: "Sender", value: `***${data.senderNumber || "N/A"}`, inline: true },
                                    { name: "TrxID", value: `\`${data.trxId}\``, inline: false }
                                )
                                .setTimestamp();

                            const row = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId(`coin_approve_${data.playerId}_${data.amount}_${data.trxId}`).setLabel("Approve").setStyle(ButtonStyle.Success),
                                new ButtonBuilder().setCustomId(`coin_reject_${data.playerId}_${data.trxId}`).setLabel("Reject").setStyle(ButtonStyle.Danger)
                            );

                            await channel.send({ content: "<@&1487556719377776721>", embeds: [embed], components: [row] });
                        }
                        res.writeHead(200);
                        res.end("OK");
                    } catch (e) {
                        res.writeHead(500);
                        res.end("ERROR");
                    }
                });
            } else if (req.method === 'POST' && (req.url === '/api/unban' || req.url === '/unban-notify' || req.url === '/unban-sync')) {
                let body = '';
                req.on('data', chunk => { body += chunk.toString(); });
                req.on('end', async () => {
                    try {
                        const data = JSON.parse(body);
                        const target = (data.discordId || data.target || data.banId || '').replace(/[<@!>]/g, '').trim();
                        if (target) {
                            await syncBansFromFiveM(client);
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    } catch (e) {
                        res.writeHead(500);
                        res.end("ERROR");
                    }
                });
            } else {
                res.writeHead(404);
                res.end("Not Found");
            }
        });

        apiServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.warn('⚠️ [HTTP Server] Port 3011 is already in use. Continuing without crashing...');
            } else {
                console.error('❌ [HTTP Server Error]:', err.message);
            }
        });

        apiServer.listen(3011, () => {
            console.log("💰 bKash TrxID API listening on port 3011");
        });
    } catch (e) { }

    // 2. Keep-Alive Server (Port 7777 or PORT)
    try {
        const port = process.env.PORT || 7777;
        const keepAliveServer = http.createServer((req, res) => {
            if (req.url && req.url.startsWith('/whitelist-count')) {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                let countData = { count: readLocalWhitelistCount(), updatedAt: new Date().toISOString() };
                try {
                    if (fs.existsSync(whitelistCountFile)) countData = JSON.parse(fs.readFileSync(whitelistCountFile, 'utf8'));
                } catch (e) { }
                return res.end(JSON.stringify(countData));
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hypershot Arena Discord Bot is running online! 🟢\n');
        });

        keepAliveServer.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.warn(`⚠️ [Keep-Alive] Port ${port} is already in use. Continuing without crashing...`);
            } else {
                console.error('❌ [Keep-Alive Error]:', err.message);
            }
        });

        keepAliveServer.listen(port, () => {
            console.log(`🌐 Keep-alive HTTP server running on port ${port}`);
        });
    } catch (e) { }
}

// -----------------------------------------------------------------------------
// Message Reaction Handlers (Whitelist Panel Reaction Role)
// -----------------------------------------------------------------------------
function setupReactionHandlers(client) {
    function scheduleWhitelistRefresh(reaction) {
        const message = reaction && reaction.message;
        if (!message || !message.id) return;
        clearTimeout(whitelistRefreshTimers.get(message.id));
        whitelistRefreshTimers.set(message.id, setTimeout(async () => {
            whitelistRefreshTimers.delete(message.id);
            await refreshWhitelistReactors(client, message).catch(() => { });
        }, 1000));
    }

    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => null);
        if (reaction.emoji.name === '✅') {
            scheduleWhitelistRefresh(reaction);
        }
    });

    client.on('messageReactionRemove', async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) await reaction.fetch().catch(() => null);
        if (reaction.emoji.name === '✅') {
            scheduleWhitelistRefresh(reaction);
        }
    });

    client.on('messageReactionAdd', async (reaction, user) => {
        if (user.bot) return;
        try {
            if (reaction.partial) await reaction.fetch().catch(() => null);
            if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

            const message = reaction.message;
            if (!message || !message.guild) return;

            const isWhitelistMsg = message.embeds.some(e => e.title && e.title.toLowerCase().includes('whitelist')) ||
                message.components.some(row => row.components && row.components.some(c => c.customId === 'verify_whitelist'));
            const emojiName = reaction.emoji.name;

            if (isWhitelistMsg && (emojiName === '✅' || emojiName === '🛡️' || emojiName === '⚔️')) {
                const roleId = getWhitelistRoleId();
                const member = await message.guild.members.fetch(user.id).catch(() => null);
                if (!member) return;

                await syncBansFromFiveM(client).catch(() => { });
                const bans = loadNxBans();
                const nowEpoch = Math.floor(Date.now() / 1000);
                const activeBan = bans.find(b =>
                    b.discordId === user.id &&
                    b.status === 'ACTIVE' &&
                    (b.isPermanent || !b.expireEpoch || b.expireEpoch > nowEpoch)
                );

                if (activeBan) {
                    await reaction.users.remove(user.id).catch(() => { });
                    const banRoleId = getBanRoleId();
                    if (banRoleId && !member.roles.cache.has(banRoleId)) {
                        await member.roles.add(banRoleId, `Auto-Blacklist: Tried to claim whitelist while banned (${activeBan.banId})`).catch(() => { });
                    }
                    if (member.roles.cache.has(roleId)) {
                        await member.roles.remove(roleId, 'Banned player cannot hold Whitelist role').catch(() => { });
                    }

                    try {
                        await user.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xE74C3C)
                                    .setTitle('⛔ Access Denied — You are Blacklisted')
                                    .setDescription(
                                        `You cannot claim the **Whitelist** role because you have an active ban on **Hypershot Arena**.\n\n` +
                                        `🏷️ **Ban ID:** \`${activeBan.banId}\`\n` +
                                        `⚠️ **Reason:** ${activeBan.reason || 'Rule violation'}\n` +
                                        `⏳ **Duration:** ${activeBan.duration || 'Permanent'}`
                                    )
                                    .setFooter({ text: "Hypershot Arena Security" })
                                    .setTimestamp()
                            ]
                        }).catch(() => { });
                    } catch (e) { }
                    return;
                }

                if (!member.roles.cache.has(roleId)) {
                    await member.roles.add(roleId).catch(console.error);

                    try {
                        const tempMsg = await message.channel.send({
                            content: `<@${user.id}> 🎉 **Congratulations!** You have received the **Whitelist** role and can now join Hypershot Arena!`
                        }).catch(() => null);
                        if (tempMsg) setTimeout(() => tempMsg.delete().catch(() => { }), 6000);
                    } catch (e) { }

                    const logChanId = config.tickets?.whitelistLogChannelId || config.tickets?.logChannelId;
                    const logChan = message.guild.channels.cache.get(logChanId);
                    if (logChan) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('✅ Whitelist Role Granted (Reaction)')
                            .setColor(0x2ECC71)
                            .setTimestamp()
                            .addFields(
                                { name: '👤 User', value: `<@${user.id}> (${user.tag})`, inline: true },
                                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
                                { name: '⚡ Method', value: `Reacted with ${emojiName}`, inline: true }
                            )
                            .setThumbnail(user.displayAvatarURL ? user.displayAvatarURL({ dynamic: true }) : null);
                        await logChan.send({ embeds: [logEmbed] }).catch(() => { });
                    }
                }
            }
        } catch (err) {
            console.error('Reaction Add Whitelist Error:', err);
        }
    });

    client.on('messageReactionRemove', async (reaction, user) => {
        if (user.bot) return;
        try {
            if (reaction.partial) await reaction.fetch().catch(() => null);
            if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

            const message = reaction.message;
            if (!message || !message.guild) return;

            const isWhitelistMsg = message.embeds.some(e => e.title && e.title.toLowerCase().includes('whitelist')) ||
                message.components.some(row => row.components && row.components.some(c => c.customId === 'verify_whitelist'));
            const emojiName = reaction.emoji.name;

            if (isWhitelistMsg && (emojiName === '✅' || emojiName === '🛡️' || emojiName === '⚔️')) {
                const roleId = getWhitelistRoleId();
                const member = await message.guild.members.fetch(user.id).catch(() => null);

                if (member && member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId).catch(console.error);

                    try {
                        const tempMsg = await message.channel.send({
                            content: `<@${user.id}> ❌ Your **Whitelist** role has been removed.`
                        }).catch(() => null);
                        if (tempMsg) setTimeout(() => tempMsg.delete().catch(() => { }), 5000);
                    } catch (e) { }

                    const logChanId = config.tickets?.whitelistLogChannelId || config.tickets?.logChannelId;
                    const logChan = message.guild.channels.cache.get(logChanId);
                    if (logChan) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('❌ Whitelist Role Removed (Reaction Removed)')
                            .setColor(0xED4245)
                            .setTimestamp()
                            .addFields(
                                { name: '👤 User', value: `<@${user.id}> (${user.tag})`, inline: true },
                                { name: '🆔 User ID', value: `\`${user.id}\``, inline: true }
                            )
                            .setThumbnail(user.displayAvatarURL ? user.displayAvatarURL({ dynamic: true }) : null);
                        await logChan.send({ embeds: [logEmbed] }).catch(() => { });
                    }
                }
            }
        } catch (err) {
            console.error('Reaction Remove Whitelist Error:', err);
        }
    });
}

// -----------------------------------------------------------------------------
// Prefix Command Handler (!)
// -----------------------------------------------------------------------------
function setupPrefixCommandHandler(client) {
    client.on('messageCreate', async (message) => {
        if (!message.content.startsWith('!') || message.author.bot) return;

        const args = message.content.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const cleanCommand = async () => {
            if (message.deletable) await message.delete().catch(() => null);
        };

        // 1. !status
        if (commandName === 'status') {
            await cleanCommand();
            if (lastStatusMessage) {
                try { await lastStatusMessage.delete(); } catch (err) { }
            }
            const data = await fetchServerStatus(client);
            lastStatusMessage = await message.channel.send(data);
            saveStatusState({ channelId: message.channel.id, messageId: lastStatusMessage.id });
            startLiveUpdate(client);
        }

        // 2. !setrestart
        else if (commandName === 'setrestart') {
            const isOwner = message.author.id === config.ownerId;
            const hasAdmin = message.member && message.member.permissions && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
            const hasStaffRole = message.member && message.member.roles && message.member.roles.cache.some(r => config.tickets && config.tickets.staffRoleId && config.tickets.staffRoleId.includes(r.id));

            if (!isOwner && !hasAdmin && !hasStaffRole) {
                return message.reply("❌ You do not have permission to use this command.");
            }

            const rawArgs = args.join(' ').trim();

            if (!rawArgs || rawArgs.toLowerCase() === 'help' || rawArgs.toLowerCase() === 'info') {
                const currentStatus = getRestartDisplay();
                let desc = `**Current Display:** \`${currentStatus}\`\n\n`;
                if (restartSchedule) {
                    if (restartSchedule.type === 'daily') {
                        desc += `📅 **Schedule Type:** Daily Recurring at \`${restartSchedule.times.join(', ')}\`\n`;
                    } else if (restartSchedule.type === 'interval') {
                        desc += `⏱️ **Schedule Type:** Every \`${restartSchedule.hours} hours\`\n`;
                    } else if (restartSchedule.type === 'text') {
                        desc += `📝 **Schedule Type:** Custom Text (\`${restartSchedule.text}\`)\n`;
                    } else if (restartSchedule.type === 'countdown') {
                        desc += `⏳ **Schedule Type:** One-time countdown\n`;
                    }
                } else {
                    desc += `ℹ️ **Status:** No schedule set (\`nothing scheduled\`)\n`;
                }

                desc += `\n**⚙️ How to set permanent restart schedule:**\n` +
                    `• \`!setrestart 18:00\` — Set daily restart at 18:00 (repeats every day automatically)\n` +
                    `• \`!setrestart 06:00, 18:00\` — Set multiple daily restarts (repeats every day)\n` +
                    `• \`!setrestart every 6h\` — Repeats every 6 hours permanently\n` +
                    `• \`!setrestart 15\` — One-time 15 minutes countdown\n` +
                    `• \`!setrestart text Daily at 06:00 AM\` — Display custom fixed text\n` +
                    `• \`!setrestart clear\` — Clear schedule back to 'nothing scheduled'\n\n` +
                    `*💾 Note: The schedule is saved permanently on disk and will NEVER reset until you run \`!setrestart clear\`.*`;

                const helpEmbed = new EmbedBuilder()
                    .setTitle("🔄 Hypershot Arena | Server Restart Schedule")
                    .setColor("#3498db")
                    .setDescription(desc)
                    .setFooter({ text: "Hypershot Arena • Restart Management", iconURL: client.user.displayAvatarURL() });

                return message.reply({ embeds: [helpEmbed] });
            }

            const lower = rawArgs.toLowerCase();

            if (lower === 'clear' || lower === 'remove' || lower === 'reset' || lower === 'off') {
                restartSchedule = null;
                saveRestartSchedule(null);
                message.reply("✅ Scheduled restart cleared. Embed will show **'nothing scheduled'**.");
                if (lastStatusMessage) {
                    const data = await fetchServerStatus(client);
                    lastStatusMessage.edit(data).catch(() => null);
                } else {
                    initOrUpdateServerStatus(client).catch(() => null);
                }
                return;
            }

            if (lower.startsWith('text ') || lower.startsWith('custom ')) {
                const customText = rawArgs.slice(rawArgs.indexOf(' ') + 1).trim();
                if (!customText) {
                    return message.reply("❌ Please provide the text to display. Example: `!setrestart text Daily at 06:00 AM & 06:00 PM`");
                }
                restartSchedule = { type: 'text', text: customText, updatedAt: new Date().toISOString() };
                saveRestartSchedule(restartSchedule);
                message.reply(`✅ Permanent restart display text set to: \`${customText}\`.\n💾 Saved permanently until changed or cleared!`);
                if (lastStatusMessage) {
                    const data = await fetchServerStatus(client);
                    lastStatusMessage.edit(data).catch(() => null);
                } else {
                    initOrUpdateServerStatus(client).catch(() => null);
                }
                return;
            }

            const intervalMatch = rawArgs.match(/^every\s+(\d+)\s*(?:h|hrs|hours?)?$/i) || rawArgs.match(/^interval\s+(\d+)/i);
            if (intervalMatch) {
                const hours = parseInt(intervalMatch[1], 10);
                if (isNaN(hours) || hours <= 0 || hours > 72) {
                    return message.reply("❌ Invalid interval hours. Example: `!setrestart every 6h`");
                }
                restartSchedule = { type: 'interval', hours, baseTime: Date.now(), updatedAt: new Date().toISOString() };
                saveRestartSchedule(restartSchedule);
                message.reply(`✅ Server restart scheduled to repeat **every ${hours} hours** permanently.`);
                if (lastStatusMessage) {
                    const data = await fetchServerStatus(client);
                    lastStatusMessage.edit(data).catch(() => null);
                } else {
                    initOrUpdateServerStatus(client).catch(() => null);
                }
                return;
            }

            function parseTimeToken(token) {
                const m = token.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
                if (!m) return null;
                let hours = parseInt(m[1], 10);
                let minutes = m[2] ? parseInt(m[2], 10) : 0;
                const ampm = m[3] ? m[3].toLowerCase() : null;

                if (ampm) {
                    if (ampm === 'pm' && hours < 12) hours += 12;
                    if (ampm === 'am' && hours === 12) hours = 0;
                }

                if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
                const pad = (n) => String(n).padStart(2, '0');
                return `${pad(hours)}:${pad(minutes)}`;
            }

            let timeCandidateStr = rawArgs.replace(/^daily\s+/i, '').trim();
            let rawTimeTokens = timeCandidateStr.split(/[,]+/).map(t => t.trim()).filter(Boolean);
            let parsedTimes = [];
            let allValidTimes = rawTimeTokens.length > 0;

            for (const tok of rawTimeTokens) {
                const parsed = parseTimeToken(tok);
                if (parsed) parsedTimes.push(parsed);
                else { allValidTimes = false; break; }
            }

            if (allValidTimes && parsedTimes.length > 0) {
                parsedTimes = [...new Set(parsedTimes)].sort();
                restartSchedule = { type: 'daily', times: parsedTimes, updatedAt: new Date().toISOString() };
                saveRestartSchedule(restartSchedule);

                message.reply(`✅ **Daily restart schedule set:** \`${parsedTimes.join(', ')}\`\n🔄 Count down repeats daily.`);
                if (lastStatusMessage) {
                    const data = await fetchServerStatus(client);
                    lastStatusMessage.edit(data).catch(() => null);
                } else {
                    initOrUpdateServerStatus(client).catch(() => null);
                }
                return;
            }

            const minMatch = rawArgs.match(/^\+?(\d+)\s*(?:m|min|mins|minutes)?$/i);
            if (minMatch) {
                const minutes = parseInt(minMatch[1], 10);
                if (minutes > 0) {
                    restartSchedule = {
                        type: 'countdown',
                        targetTimestamp: Date.now() + (minutes * 60 * 1000),
                        minutes,
                        updatedAt: new Date().toISOString()
                    };
                    saveRestartSchedule(restartSchedule);
                    message.reply(`✅ One-time restart countdown set for **${minutes} minutes** from now.`);
                    if (lastStatusMessage) {
                        const data = await fetchServerStatus(client);
                        lastStatusMessage.edit(data).catch(() => null);
                    } else {
                        initOrUpdateServerStatus(client).catch(() => null);
                    }
                    return;
                }
            }

            restartSchedule = { type: 'text', text: rawArgs, updatedAt: new Date().toISOString() };
            saveRestartSchedule(restartSchedule);
            message.reply(`✅ Restart schedule display set to: \`${rawArgs}\``);
            if (lastStatusMessage) {
                const data = await fetchServerStatus(client);
                lastStatusMessage.edit(data).catch(() => null);
            } else {
                initOrUpdateServerStatus(client).catch(() => null);
            }
        }

        // 3. !whitelist
        else if (commandName === 'whitelist') {
            await cleanCommand();
            const embed = buildWhitelistEmbed(client, readLocalWhitelistCount());
            const sentMsg = await message.channel.send({ embeds: [embed] });
            await sentMsg.react('✅').catch(() => { });
            trackWhitelistPanel(sentMsg);
            refreshWhitelistReactors(client, sentMsg);
        }

        // 4. !setup-ticket or !setup
        else if (commandName === 'setup-ticket' || commandName === 'setup') {
            if (!hasAdminPermission(message.member)) return message.reply("❌ You do not have permission to run this command.");
            await cleanCommand();

            const { StringSelectMenuBuilder } = require('discord.js');
            const menuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('main_menu').setPlaceholder('Select a ticket category')
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

            await message.channel.send({ embeds: [embed], components: [menuRow] });
        }

        // 5. !announce & !updatelog
        else if (commandName === 'announce' || commandName === 'updatelog') {
            if (!hasAdminPermission(message.member)) return message.reply("❌ You do not have permission to run this command.");
            await cleanCommand();
            const isAnn = commandName === 'announce';
            const selectMenu = new ChannelSelectMenuBuilder()
                .setCustomId(isAnn ? 'select_announce_channel' : 'select_update_channel')
                .setPlaceholder('Select the target channel')
                .addChannelTypes(ChannelType.GuildText);

            const tempMsg = await message.channel.send({
                content: `📢 <@${message.author.id}>, select the channel for **${commandName}**:`,
                components: [new ActionRowBuilder().addComponents(selectMenu)]
            });

            setTimeout(() => tempMsg.delete().catch(() => null), 30000);
        }

        // 6. !tp <playerId>
        else if (commandName === 'tp' || commandName === 'teleport') {
            if (!hasAdminPermission(message.member)) return message.reply("❌ You do not have permission to run this command.");
            const playerId = parseInt(args[0]);
            if (isNaN(playerId)) return message.reply("⚠️ Usage: `!tp <player_id>` (e.g. `!tp 1`)");

            const statusMsg = await message.reply(`🔄 Sending teleport request for Player ID \`${playerId}\`...`);
            const result = await syncTeleportWithFiveM(playerId, message.author.tag, message.author.id);

            if (result && result.success) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF88)
                    .setTitle('🚀 Player Teleported to Arena')
                    .setDescription(`Successfully teleported **${result.playerName || `Player ${playerId}`}** to the designated arena location.`)
                    .addFields(
                        { name: '👤 Player', value: `\`${result.playerName || 'Unknown'}\` (ID: \`${playerId}\`)`, inline: true },
                        { name: '📍 Destination', value: `\`vec4(4396.77, 2784.68, 551.38, 288.17)\``, inline: true },
                        { name: '🛡️ Executed By', value: `<@${message.author.id}> (\`${message.author.tag}\`)`, inline: true }
                    )
                    .setFooter({ text: "Hypershot Arena Teleport System" })
                    .setTimestamp();

                return statusMsg.edit({ content: null, embeds: [embed] });
            } else {
                return statusMsg.edit({ content: `❌ ${result?.message || `Failed to teleport Player ID ${playerId}. Player may not be online.`}` });
            }
        }

        // 7. !check
        else if (commandName === 'check' || commandName === 'wlcheck') {
            if (!hasAdminPermission(message.member)) return message.reply("❌ You do not have permission to run this command.");
            const targetId = (args[0] || '').replace(/[<@!>]/g, '');
            if (!targetId) return message.reply("⚠️ Usage: `!check <@User or Discord_ID>`");

            await syncBansFromFiveM(client).catch(() => { });
            const targetMember = await message.guild.members.fetch(targetId).catch(() => null);
            const targetUser = targetMember ? targetMember.user : await client.users.fetch(targetId).catch(() => null);
            if (!targetUser) return message.reply(`❌ Could not find user with ID: \`${targetId}\``);

            const banRoleId = getBanRoleId();
            const wlRoleId = getWhitelistRoleId();
            const hasBan = banRoleId && targetMember && targetMember.roles.cache.has(banRoleId);
            const hasWl = targetMember && targetMember.roles.cache.has(wlRoleId);

            const embed = new EmbedBuilder()
                .setColor(hasBan ? 0xE74C3C : hasWl ? 0x2ECC71 : 0xF39C12)
                .setTitle(`🔍 User Check: ${targetUser.username}`)
                .addFields(
                    { name: '👤 User', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: true },
                    { name: '🛡️ Whitelist', value: hasWl ? '✅ **Whitelisted**' : '❌ **Not Whitelisted**', inline: true },
                    { name: '⛔ Blacklist', value: hasBan ? '⛔ **BANNED**' : '✅ **Clean**', inline: true }
                )
                .setFooter({ text: "Hypershot Arena Security" });

            return message.reply({ embeds: [embed] });
        }

        // 8. !banplayers
        else if (commandName === 'banplayers' || commandName === 'banplayer') {
            if (!hasAdminPermission(message.member)) return message.reply("❌ You do not have permission to run this command.");
            const targetId = (args[0] || '').replace(/[<@!>]/g, '');
            if (!targetId) return message.reply("⚠️ Usage: `!banplayers <@User> [duration: 7d/15d/30d/permanent] [reason]`");

            let durationInput = 'permanent';
            let reasonStartIndex = 1;
            if (args[1]) {
                const possibleDur = args[1].toLowerCase();
                if (possibleDur.match(/^\d+[dhw]?$/) || possibleDur === 'permanent' || possibleDur === 'perm') {
                    durationInput = possibleDur;
                    reasonStartIndex = 2;
                }
            }

            const reason = args.slice(reasonStartIndex).join(' ') || 'Violation of server rules';
            const durationInfo = parseDuration(durationInput);
            const isPermanent = durationInfo.isPermanent;
            const banRoleId = getBanRoleId();
            const wlRoleId = getWhitelistRoleId();

            const member = await message.guild.members.fetch(targetId).catch(() => null);
            if (member) {
                if (banRoleId) await member.roles.add(banRoleId).catch(() => { });
                if (wlRoleId && member.roles.cache.has(wlRoleId)) {
                    await member.roles.remove(wlRoleId, `Banned by ${message.author.tag}: ${reason}`).catch(() => { });
                }
            }

            const txProfile = await getPlayerIdentifiersFromTxAdmin(targetId);
            const bans = loadNxBans();
            bans.forEach(b => {
                if (b.discordId === targetId && b.status === 'ACTIVE') b.status = 'OVERWRITTEN';
            });

            const newBanId = generateNxBanId(bans);
            const currentTime = getBDTimeString();

            const newRecord = {
                banId: newBanId,
                discordId: targetId,
                discordName: txProfile.name || `User (${targetId})`,
                reason: reason,
                duration: durationInfo.label,
                isPermanent: isPermanent,
                expireEpoch: durationInfo.expireEpoch,
                expireAt: durationInfo.expireAt,
                bannedById: message.author.id,
                bannedByName: message.author.tag,
                status: 'ACTIVE',
                identifiers: txProfile.identifiers,
                timestamp: currentTime
            };

            bans.unshift(newRecord);
            saveNxBans(bans);
            await syncBanWithFiveM(targetId, txProfile.name, reason, message.author.tag, durationInfo.label, txProfile.identifiers);

            const announceChanId = isPermanent ? getBanAnnounceChannelId() : getSuspendedAnnounceChannelId();
            try {
                const announceChan = message.guild.channels.cache.get(announceChanId) || await client.channels.fetch(announceChanId).catch(() => null);
                if (announceChan && announceChan.isTextBased()) {
                    const idList = txProfile.identifiers && txProfile.identifiers.length > 0
                        ? txProfile.identifiers.join('\n')
                        : `discord:${targetId}`;
                    const wlMention = `<@&${wlRoleId}>`;

                    if (isPermanent) {
                        await announceChan.send(`<@${targetId}> You have been permanently banned from Hypershot Arena for ${reason}.\n\n\`\`\`\n${idList}\n\`\`\`\n${wlMention}`);
                    } else {
                        await announceChan.send(`<@${targetId}> This user has been suspended ${durationInfo.label} for ${reason}.\n\n\`\`\`\n${idList}\n\`\`\`\n${wlMention}`);
                    }
                }
            } catch (e) { }

            const embed = new EmbedBuilder()
                .setColor(isPermanent ? 0xE74C3C : 0xF39C12)
                .setTitle(isPermanent ? '⛔ Player Permanently Banned' : '⏳ Player Suspended')
                .setDescription(`User <@${targetId}> has been ${isPermanent ? 'permanently banned' : `suspended for **${durationInfo.label}**`}.`)
                .addFields(
                    { name: '🏷️ Ban ID', value: `\`${newBanId}\``, inline: true },
                    { name: '👤 Player', value: `<@${targetId}>`, inline: true },
                    { name: '⏳ Duration', value: durationInfo.label, inline: true },
                    { name: '⚠️ Reason', value: reason, inline: false }
                )
                .setFooter({ text: "Hypershot Arena Security" });

            sendBanUnbanLogEmbed(client, embed);
            return message.reply({ embeds: [embed] });
        }

        // 9. !unbanplayers
        else if (commandName === 'unbanplayers' || commandName === 'unbanplayer') {
            if (!hasAdminPermission(message.member)) return message.reply("❌ You do not have permission to run this command.");
            const target = (args[0] || '').replace(/[<@!>#]/g, '').trim().toUpperCase();
            if (!target) return message.reply("⚠️ Usage: `!unbanplayers <@User or Ban_ID>`");

            const bans = loadNxBans();
            let found = null;
            for (const b of bans) {
                const cleanBanId = b.banId ? b.banId.replace('#', '').toUpperCase() : '';
                if ((cleanBanId === target || b.discordId === args[0].replace(/[<@!>]/g, '')) && b.status === 'ACTIVE') {
                    b.status = 'UNBANNED';
                    b.unbannedAt = getBDTimeString();
                    b.unbannedBy = message.author.tag;
                    found = b;
                    break;
                }
            }

            if (found) {
                saveNxBans(bans);
                await syncUnbanWithFiveM(found.banId, found.discordId, message.author.tag);
                const banRoleId = getBanRoleId();
                if (banRoleId) {
                    const member = await message.guild.members.fetch(found.discordId).catch(() => null);
                    if (member) await member.roles.remove(banRoleId).catch(() => { });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle('✅ Player Unbanned')
                    .setDescription(`User <@${found.discordId}> (\`${found.banId}\`) has been unbanned.`)
                    .setFooter({ text: "Hypershot Arena Security" });

                sendBanUnbanLogEmbed(client, embed);
                return message.reply({ embeds: [embed] });
            } else {
                return message.reply(`❌ No active ban record found for \`${args[0]}\`.`);
            }
        }

        // 10. !serverlist & !leaveserver (Bot Owner only)
        else if (commandName === 'serverlist') {
            if (!config.ownerId || message.author.id !== config.ownerId) return message.reply("❌ Only the Bot Owner can use this command.");
            let serverList = client.guilds.cache.map(g => `• **${g.name}** (ID: \`${g.id}\`)`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle("Bot Server List")
                .setDescription(serverList || "No servers found.")
                .setColor("#ffcc00");
            await message.channel.send({ embeds: [embed] });
        }
        else if (commandName === 'leaveserver') {
            if (!config.ownerId || message.author.id !== config.ownerId) return message.reply("❌ Only the Bot Owner can use this command.");
            const guildIdToLeave = args[0];
            if (!guildIdToLeave) return message.reply("❌ Please provide a Server ID. Usage: `!leaveserver <ServerID>`");

            const targetGuild = client.guilds.cache.get(guildIdToLeave);
            if (!targetGuild) return message.reply(`❌ I am not in any server with ID \`${guildIdToLeave}\`.`);

            try {
                await targetGuild.leave();
                message.reply(`✅ Successfully left the server: **${targetGuild.name}**`);
            } catch (error) {
                message.reply(`❌ Failed to leave the server. Error: ${error.message}`);
            }
        }

        // 11. !resetstrem
        else if (commandName === 'resetstrem' || commandName === 'resetsteam') {
            await cleanCommand();
            const embed = new EmbedBuilder()
                .setTitle("🔄 Reset Steam Profile")
                .setDescription("Click the button below to remove a user's saved Steam profile from the database.")
                .setColor("#ff5555");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('resetstrem_btn')
                    .setLabel('Reset Steam')
                    .setStyle(ButtonStyle.Danger)
            );

            await message.channel.send({ embeds: [embed], components: [row] });
        }

        // 12. !help
        else if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`🤖 Hypershot Arena Bot Help`)
                .setDescription(`Available **Staff Commands**:\n` +
                    `• \`!status\` - Send live server status board\n` +
                    `• \`!whitelist\` - Send reaction whitelist panel\n` +
                    `• \`!setup-ticket\` - Send dropdown ticket panel\n` +
                    `• \`!tp <player_id>\` - Teleport player to Arena coords\n` +
                    `• \`!check <@User>\` - Check user whitelist & ban status\n` +
                    `• \`!banplayers <@User> [duration] [reason]\` - Ban/suspend user\n` +
                    `• \`!unbanplayers <@User/Ban_ID>\` - Unban user\n` +
                    `• \`!setrestart <time>\` - Set permanent server restart countdown\n` +
                    `• \`!announce\` / \`!updatelog\` - Send announcement & update logs\n` +
                    `• \`/help\` - View full slash command catalog`
                )
                .setFooter({ text: "Hypershot Arena System" });
            return message.reply({ embeds: [embed] });
        }
    });
}

// -----------------------------------------------------------------------------
// Initialization Function
// -----------------------------------------------------------------------------
function initFivemTicketSystem(client) {
    client.config = config;
    client.configPath = configPath;

    // Start live status & whitelist sync
    startStatusService(client).catch(err => {
        console.error("Error starting status service:", err);
    });

    initOrUpdateWhitelistPanel(client).catch(err => {
        console.error("Error starting whitelist panel:", err);
    });

    setInterval(async () => {
        if (!client.isReady()) return;
        try {
            await initOrUpdateWhitelistPanel(client).catch(() => null);
            await refreshAllTrackedPanels(client).catch(() => null);
        } catch (e) { }
    }, 15000);

    // Setup HTTP servers
    startHttpServers(client);

    // Setup Reaction and Prefix Command Handlers
    setupReactionHandlers(client);
    setupPrefixCommandHandler(client);

    console.log("✅ [FiveM/Ticket] System initialized successfully.");
}

module.exports = {
    initFivemTicketSystem,
    initOrUpdateWhitelistPanel,
    autoDiscoverWhitelistPanels,
    fetchServerStatus,
    buildWhitelistEmbed,
    getRestartDisplay,
    loadRestartSchedule,
    saveRestartSchedule,
    trackWhitelistPanel,
    refreshWhitelistReactors,
    readLocalWhitelistCount,
    loadNxBans,
    saveNxBans,
    generateNxBanId,
    parseDuration,
    getBDTimeString,
    syncBanWithFiveM,
    syncUnbanWithFiveM,
    syncTeleportWithFiveM,
    syncBansFromFiveM,
    getPlayerIdentifiersFromTxAdmin,
    sendBanUnbanLogEmbed,
    hasAdminPermission,
    checkRejoinBan,
    getBanAnnounceChannelId,
    getSuspendedAnnounceChannelId,
    getBanRoleId,
    getWhitelistRoleId
};
