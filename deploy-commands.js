const { REST, Routes } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

// Path to commands folder
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

// Loop through commands folder and push each command's data
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if ("data" in command && "execute" in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`⚠️ Command at ./commands/${file} missing "data" or "execute"`);
    }
}

// Prohori Security Engine commands
try {
    const { getSecurityCommandsData } = require("./security/index");
    commands.push(...getSecurityCommandsData());
} catch (e) {
    console.error("Error loading security commands in deploy-commands:", e);
}

const token = process.env.TOKEN || (fs.existsSync('./config.json') ? require('./config.json').token : null);
const clientId = process.env.CLIENT_ID || (fs.existsSync('./config.json') ? require('./config.json').clientId : null);
const guildId = process.env.GUILD_ID || (fs.existsSync('./config.json') ? require('./config.json').guildId : null);

// Setup REST
const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`🔄 Registering ${commands.length} slash command(s)...`);

        // Guild-specific commands (instant)
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`✅ Commands registered successfully!`);
    } catch (error) {
        console.error("❌ Error registering commands:", error);
    }
})();
