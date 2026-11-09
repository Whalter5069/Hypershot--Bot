const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const LOA_FILE = path.join(__dirname, "data/loas.json");

const messages = [
  "👋 Welcome back, we missed you!",
  "⚔️ Duty calls, and you're back stronger!",
  "👑 The Hypershot Arena grows stronger with your return.",
  "🌌 Another warrior has returned from the shadows.",
  "📜 Your LOA has ended, let's get back to business!",
  "🤝 The family feels complete again with your return.",
  "🦁 Legends never quit, they just take short breaks.",
  "🔥 Your comeback marks the rise of Hypershot Arena once more.",
  "🏙️ The city echoes louder when you're around.",
  "🛡️ Another soldier rejoins the battlefield.",
  "⚡ Stronger, sharper, and ready to rule again!",
  "👑 The Hypershot Arena welcomes its lion back to the den.",
  "⏳ The break is over — it's grind time again!",
  "⚔️ A true warrior always finds his way back home.",
  "✨ The throne shines brighter with your presence.",
  "💫 Your energy was missed, your return is celebrated.",
  "🚀 The squad just leveled up with your comeback.",
  "🔱 Back from LOA, back to domination!",
  "🏆 Your return signals new victories ahead.",
  "🩸 Royal blood never rests for long — welcome back!"
];

// Hardcoded channel IDs
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const FIXED_END_LOA_CHANNEL_ID = process.env.FIXED_END_LOA_CHANNEL_ID;

// Default endedBy (staff) for auto LOA end
const DEFAULT_ENDED_BY = "@[RS]-THE WALTER";

async function checkExpiredLOAs(client) {
  if (!fs.existsSync(LOA_FILE)) return;
  const loas = JSON.parse(fs.readFileSync(LOA_FILE));

  const now = Date.now();
  for (const [userId, loa] of Object.entries(loas)) {
    if (loa.status === "approved" && loa.end <= now) {
      loa.status = "ended";

      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      // Embed
      const endEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("✅ END OF LOA NOTICE")
        .setDescription(`⚔️ <@${userId}> is officially back from LOA!`)
        .addFields(
          { name: "👤 Member", value: `<@${userId}>`, inline: true },
          { name: "🛡️ Ended By", value: `<@${client.user.id}>`, inline: true }, // BOT mention
          { name: "💬 Message", value: randomMessage, inline: false }
        )
        .setImage("https://media.discordapp.net/attachments/1328281349471342593/1461291979408412841/standard_4.gif")
        .setFooter({ text: "⚔️ Hypershot Arena • Auto LOA System" })
        .setTimestamp();


      // Send to LOG_CHANNEL_ID
      try {
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) await logChannel.send({ embeds: [endEmbed] });
      } catch (e) {
        console.log("❌ Error sending to LOG_CHANNEL_ID:", e.message);
      }

      // Send to FIXED_END_LOA_CHANNEL_ID
      try {
        const fixedChannel = await client.channels.fetch(FIXED_END_LOA_CHANNEL_ID);
        if (fixedChannel) await fixedChannel.send({ embeds: [endEmbed] });
      } catch (e) {
        console.log("❌ Error sending to FIXED_END_LOA_CHANNEL_ID:", e.message);
      }

      // DM to user
      try {
        const member = await client.users.fetch(userId);
        await member.send({ embeds: [endEmbed] });
      } catch {
        console.log(`⚠️ Could not DM user ${userId}`);
      }
    }
  }

  fs.writeFileSync(LOA_FILE, JSON.stringify(loas, null, 2));
}

function loaChecker(client) {
  console.log("⏳ LOA auto-checker started...");
  setInterval(() => checkExpiredLOAs(client), 30 * 1000); // every 30 sec
}

module.exports = { loaChecker };
