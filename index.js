// ===========================
// ERROR HANDLING (CRASH PREVENTION)
// ===========================
process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ [Unhandled Rejection]:", reason);
});

process.on("uncaughtException", (err, origin) => {
    console.error("❌ [Uncaught Exception]:", err);
});

// ===========================
// BOT STARTUP
// ===========================
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    REST,
    Routes,
    EmbedBuilder,
    Events
} = require("discord.js");

const cron = require("node-cron");

// ===========================
// CLIENT SETUP
// ===========================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildInvites
    ],
    partials: [
        Partials.User,
        Partials.GuildMember,
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

client.commands = new Collection();

// ===========================
// LOAD COMMANDS
// ===========================
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

for (const file of commandFiles) {
    try {
        const command = require(path.join(commandsPath, file));
        if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`⚠️ Invalid command file: ${file}`);
        }
    } catch (err) {
        console.error(`❌ Error loading command file ${file}:`, err);
    }
}

// ===========================
// LOAD PROHORI SECURITY COMMANDS
// ===========================
const { securityCommandsCollection, initSecuritySystem } = require("./security/index");
for (const [name, cmd] of securityCommandsCollection) {
    client.commands.set(name, cmd);
}

// ===========================
// REGISTER SLASH COMMANDS
// ===========================
const botToken = process.env.TOKEN || (fs.existsSync("./config.json") ? require("./config.json").token : null);
const botClientId = process.env.CLIENT_ID || (fs.existsSync("./config.json") ? require("./config.json").clientId : null);
const botGuildId = process.env.GUILD_ID || (fs.existsSync("./config.json") ? require("./config.json").guildId : null);

const rest = new REST({ version: "10" }).setToken(botToken);

(async () => {
    try {
        console.log("⏳ Registering slash commands...");
        const commands = client.commands.map(cmd => cmd.data.toJSON());

        await rest.put(
            Routes.applicationGuildCommands(
                botClientId,
                botGuildId
            ),
            { body: commands }
        );

        console.log(`✅ ${commands.length} slash commands registered successfully.`);
    } catch (err) {
        console.error("❌ Slash register error:", err);
    }
})();

// ===========================
// INTERACTION HANDLER
// ===========================
client.on(Events.InteractionCreate, async interaction => {
    try {
        // 1. Slash Commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (err) {
                console.error(`❌ Error executing ${interaction.commandName}:`, err);
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: "❌ Error executing command." }).catch(() => { });
                } else {
                    await interaction.reply({ content: "❌ Error executing command.", ephemeral: true }).catch(() => { });
                }
            }
            return;
        }

        // 2. Buttons
        if (interaction.isButton()) {
            // Prohori Verification Buttons
            if (interaction.customId === "prohori_verify_button" || interaction.customId === "prohori_solve_captcha_btn") {
                const { handleVerificationInteractions } = require("./security/verificationSystem");
                await handleVerificationInteractions(interaction, client).catch(err => {
                    console.error("❌ Error in security verification handler:", err);
                });
                return;
            }

            // LOA Buttons
            if (interaction.customId.startsWith("loa_")) {
                const handler = require("./events/interactionCreate");
                await handler(interaction, client).catch(err => {
                    console.error("❌ Error in LOA button handler:", err);
                });
                return;
            }

            // Coin Approval Buttons
            if (interaction.customId.startsWith("coin_approve_")) {
                const parts = interaction.customId.split('_');
                const playerId = parts[2];
                const amount = parts[3];

                try {
                    const axios = require('axios');
                    const response = await axios.post(`http://127.0.0.1:30120/fivem-npc-ui-1.0/approveCoin`, {
                        playerId: playerId,
                        amount: amount,
                        secret: "NEXUS_SECRET_123"
                    });

                    if (response.data && response.data.success) {
                        const embed = new EmbedBuilder(interaction.message.embeds[0].toJSON());
                        embed.setColor("#00ff00");
                        embed.setTitle("✅ Approved XP Purchase");
                        await interaction.update({ embeds: [embed], components: [] });
                        interaction.channel.send(`✅ XP added to Player ID ${playerId} by <@${interaction.user.id}>`);
                    } else {
                        interaction.reply({ content: `❌ Failed: ${response.data.error}`, ephemeral: true });
                    }
                } catch (e) {
                    interaction.reply({ content: `❌ FiveM server is offline or script is missing.`, ephemeral: true });
                }
                return;
            }

            if (interaction.customId.startsWith("coin_reject_")) {
                const embed = new EmbedBuilder(interaction.message.embeds[0].toJSON());
                embed.setColor("#ff0000");
                embed.setTitle("❌ Rejected XP Purchase");
                await interaction.update({ embeds: [embed], components: [] });
                interaction.channel.send(`❌ Purchase rejected by <@${interaction.user.id}>`);
                return;
            }

            // Ticket, Whitelist, Steam Buttons
            try {
                const interactionHandler = require("./interactionHandler");
                await interactionHandler(interaction, client);
            } catch (err) {
                if (err.code !== 10062) console.error("❌ Error in ticket button handler:", err);
            }
            return;
        }

        // 3. String & Channel Select Menus and Modals (Tickets, Announcements, Whitelist, Verification)
        if (interaction.isModalSubmit() && interaction.customId === "prohori_captcha_modal") {
            const { handleVerificationInteractions } = require("./security/verificationSystem");
            await handleVerificationInteractions(interaction, client).catch(err => {
                console.error("❌ Error in security verification modal handler:", err);
            });
            return;
        }

        if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isModalSubmit()) {
            try {
                const interactionHandler = require("./interactionHandler");
                await interactionHandler(interaction, client);
            } catch (err) {
                if (err.code !== 10062) console.error("❌ Error in modal/menu interaction:", err);
            }
            return;
        }
    } catch (err) {
        console.error("❌ Error in interactionCreate:", err);
    }
});

// ===========================
// CONFIG
// ===========================
const {
    WELCOME_CHANNEL_ID,
    LEAVE_CHANNEL_ID,
    AUTO_ROLE_ID,
    SERVER_RULES_CHANNEL_ID,
    ABOUT_US_CHANNEL_ID,
    DM_FAIL_LOG_CHANNEL_ID
} = process.env;

const { welcomeMessages, leaveMessages } = require("./messages");

// ===========================
// UTIL FUNCTIONS
// ===========================
function formatMessage(template, member) {
    return template
        .replaceAll("{id}", member.id)
        .replaceAll("{rules}", SERVER_RULES_CHANNEL_ID || "")
        .replaceAll("{about}", ABOUT_US_CHANNEL_ID || "");
}

function buildEmbed(title, desc, color, member) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(desc)
        .setThumbnail(member.user ? member.user.displayAvatarURL({ dynamic: true }) : null)
        .setFooter({
            text: "Hypershot Arena Family",
            iconURL: client.user.displayAvatarURL()
        })
        .setTimestamp();
}

// ===========================
// MEMBER JOIN WITH ANIMATED GIF
// ===========================
client.on(Events.GuildMemberAdd, async member => {
    try {
        // 🔒 FiveM Ban Auto-Restore on Rejoin
        try {
            const { checkRejoinBan } = require("./fivemTicketSystem");
            const isBanned = await checkRejoinBan(member);
            if (isBanned) return; // Do not grant normal auto-role or welcome if banned
        } catch (e) { }

        // Auto role
        if (AUTO_ROLE_ID && member.guild) {
            try {
                const role = await member.guild.roles.fetch(AUTO_ROLE_ID).catch(() => null);
                if (role) await member.roles.add(role);
                console.log(`🎭 Added role to ${member.user?.tag || member.id}`);
            } catch (e) {
                console.error("❌ Role add error:", e.message);
            }
        }

        // Random welcome message
        const msg = formatMessage(
            welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)],
            member
        );

        // Build embed
        const embed = new EmbedBuilder()
            .setColor("#00ff99")
            .setTitle("👑 Welcome to Hypershot Arena 👑")
            .setDescription(msg)
            .setThumbnail(member.user ? member.user.displayAvatarURL({ dynamic: true }) : null)
            .setFooter({ text: "Hypershot Arena Family", iconURL: client.user.displayAvatarURL() })
            .setTimestamp()
            // ✅ Animated GIF
            .setImage("https://media.discordapp.net/attachments/1328002952236892180/1560750415945932901/hypershot_arena_animated.gif?ex=6ad3d998&is=6ad28818&hm=e96d801e7bf30904f5a97a8cdfa4ead2d2c50486173f9bd8034b2bc46c737c87&=");

        // Send to Welcome Channel
        if (WELCOME_CHANNEL_ID && member.guild) {
            const ch = member.guild.channels.cache.get(WELCOME_CHANNEL_ID)
                || await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
            if (ch) {
                ch.send({ embeds: [embed] })
                    .then(() => console.log(`📩 Welcome embed sent in #${ch.name}`))
                    .catch(err => console.error("❌ Welcome send error:", err.message));
            }
        }

        // Optional DM
        try {
            await member.send({ embeds: [embed] });
            console.log(`📩 Sent welcome DM to ${member.user?.tag || member.id}`);
        } catch (err) {
            console.log(`⚠️ Could not send DM: ${err.message}`);
        }
    } catch (err) {
        console.error("❌ Error in guildMemberAdd:", err);
    }
});

// ===========================
// MEMBER LEAVE
// ===========================
client.on(Events.GuildMemberRemove, async member => {
    try {
        const msg = formatMessage(
            leaveMessages[Math.floor(Math.random() * leaveMessages.length)],
            member
        );

        const embed = new EmbedBuilder()
            .setColor("#ff0000")
            .setTitle("👋 Goodbye from Hypershot Arena")
            .setDescription(msg)
            .setThumbnail(member.user ? member.user.displayAvatarURL({ dynamic: true }) : null)
            // 🔥 Animated GIF graph / banner
            .setImage("https://media.discordapp.net/attachments/1328002952236892180/1560750415945932901/hypershot_arena_animated.gif?ex=6ad3d998&is=6ad28818&hm=e96d801e7bf30904f5a97a8cdfa4ead2d2c50486173f9bd8034b2bc46c737c87&=")
            .setFooter({
                text: "Hypershot Arena Family",
                iconURL: member.guild ? member.guild.iconURL({ dynamic: true }) : client.user.displayAvatarURL()
            })
            .setTimestamp();

        // 🔴 Try DM
        try {
            await member.send({ embeds: [embed] });
        } catch (err) {
            if (DM_FAIL_LOG_CHANNEL_ID && member.guild) {
                const log = member.guild.channels.cache.get(DM_FAIL_LOG_CHANNEL_ID)
                    || await member.guild.channels.fetch(DM_FAIL_LOG_CHANNEL_ID).catch(() => null);
                if (log) {
                    await log.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("DarkRed")
                                .setTitle("⚠️ DM Failed")
                                .setDescription(`DM failed to **${member.user?.tag || member.id}**`)
                                .addFields({ name: "Reason", value: err.message || "DM Closed" })
                                .setTimestamp()
                        ]
                    }).catch(() => { });
                }
            }
        }

        // 🔴 Send to Leave Channel
        if (LEAVE_CHANNEL_ID && member.guild) {
            const ch = member.guild.channels.cache.get(LEAVE_CHANNEL_ID)
                || await member.guild.channels.fetch(LEAVE_CHANNEL_ID).catch(() => null);
            if (ch) await ch.send({ embeds: [embed] }).catch(() => { });
        }
    } catch (err) {
        console.error("❌ Error in guildMemberRemove:", err);
    }
});

// ===========================
// READY EVENT
// ===========================
client.once(Events.ClientReady, () => {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    client.user.setActivity("Hypershot Arena", { type: 0 });

    // 🔥 AUTO FRIDAY GANG FUND
    try {
        const { startNewWeek } = require("./commands/gangfund");

        // Every Friday 12 PM BD (06:00 UTC)
        cron.schedule("0 6 * * 5", async () => {
            try {
                console.log("📊 GangFund auto week process...");
                await startNewWeek(client);
                console.log("✅ GangFund updated");
            } catch (err) {
                console.error("❌ GangFund cron error:", err);
            }
        });
    } catch (err) {
        console.error("❌ Error setting up gangfund cron:", err);
    }

    // Auto systems
    try {
        require("./banChecker").banChecker(client);
    } catch (err) {
        console.error("❌ Error starting banChecker:", err);
    }

    try {
        require("./loaChecker").loaChecker(client);
    } catch (err) {
        console.error("❌ Error starting loaChecker:", err);
    }

    try {
        require("./logger")(client);
    } catch (err) {
        console.error("❌ Error starting logger:", err);
    }

    try {
        require("./inviteTracker").initInviteTracker(client);
    } catch (err) {
        console.error("❌ Error starting inviteTracker:", err);
    }

    // FiveM & Ticket Auto System
    try {
        const { initFivemTicketSystem } = require("./fivemTicketSystem");
        initFivemTicketSystem(client);
    } catch (err) {
        console.error("❌ Error starting fivemTicketSystem:", err);
    }

    // Prohori Security Engine
    try {
        initSecuritySystem(client);
    } catch (err) {
        console.error("❌ Error starting securitySystem:", err);
    }
});

// ===========================
// LOGIN
// ===========================
const loginToken = process.env.TOKEN || (fs.existsSync("./config.json") ? require("./config.json").token : null);
client.login(loginToken);
