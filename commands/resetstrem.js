const { SlashCommandBuilder } = require('discord.js');
const { hasAdminPermission } = require('../fivemTicketSystem');
const fs = require('fs');
const path = require('path');

const steamLinksPath = path.join(__dirname, '../used_steam_links.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetstrem')
        .setDescription('Reset saved Steam profile link for a user')
        .addUserOption(opt => opt.setName('user').setDescription('The user to reset Steam link for').setRequired(true)),

    async execute(interaction, client) {
        if (!hasAdminPermission(interaction.member)) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const targetUserId = targetUser.id;

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
                    return interaction.reply({
                        content: `✅ Successfully removed saved Steam profile(s) for user <@${targetUserId}> (\`${targetUserId}\`).`,
                        ephemeral: true
                    });
                } else {
                    return interaction.reply({
                        content: `⚠️ No saved Steam profile found for user <@${targetUserId}> (\`${targetUserId}\`).`,
                        ephemeral: true
                    });
                }
            } else {
                return interaction.reply({ content: "⚠️ No Steam profiles database found.", ephemeral: true });
            }
        } catch (error) {
            return interaction.reply({ content: `❌ An error occurred: ${error.message}`, ephemeral: true });
        }
    }
};
