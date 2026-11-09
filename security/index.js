const { Collection, Events } = require("discord.js");
const { quarantineCommand, unquarantineCommand, handleStickyQuarantine } = require("./quarantine");
const { setupVerificationCommand, handleVerificationInteractions } = require("./verificationSystem");
const { whitelistAddCommand, whitelistRemoveCommand, whitelistListCommand } = require("./whitelistSystem");
const { setupSecurityCommand } = require("./setupSecurity");
const { registerSecurityListeners, securityStatusCommand, securityToggleCommand } = require("./securityEngine");
const {
  purgeCommand,
  lockdownCommand,
  unlockCommand,
  timeoutSecurityCommand,
  untimeoutSecurityCommand
} = require("./securityModeration");

const securityCommandsList = [
  quarantineCommand,
  unquarantineCommand,
  setupVerificationCommand,
  whitelistAddCommand,
  whitelistRemoveCommand,
  whitelistListCommand,
  setupSecurityCommand,
  securityStatusCommand,
  securityToggleCommand,
  purgeCommand,
  lockdownCommand,
  unlockCommand,
  timeoutSecurityCommand,
  untimeoutSecurityCommand
];

const securityCommandsCollection = new Collection();
for (const cmd of securityCommandsList) {
  if (cmd.data && cmd.execute) {
    securityCommandsCollection.set(cmd.data.name, cmd);
  }
}

function getSecurityCommandsData() {
  return securityCommandsList.map(cmd => cmd.data.toJSON());
}

function initSecuritySystem(client) {
  console.log("🛡️ Initializing Prohori Security Engine into Hypershot Master Bot...");

  client.securityCommands = securityCommandsCollection;
  client.securityInteractionHandler = handleVerificationInteractions;

  // Register all security event listeners (Anti-Nuke, Anti-Raid, Automod, Antispam, Anti-Webhook, Ghost Ping)
  registerSecurityListeners(client);

  // Sticky quarantine on member join
  client.on(Events.GuildMemberAdd, async member => {
    try {
      await handleStickyQuarantine(member);
    } catch (e) {
      console.error("Error in handleStickyQuarantine:", e);
    }
  });

  console.log(`✅ Prohori Security Engine active with ${securityCommandsCollection.size} security commands.`);
}

module.exports = {
  initSecuritySystem,
  getSecurityCommandsData,
  securityCommandsCollection
};

