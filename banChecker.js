const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const tempBansPath = path.join(__dirname, "data", "tempBans.json");

function loadTempBans() {
  if (!fs.existsSync(tempBansPath)) return [];
  return JSON.parse(fs.readFileSync(tempBansPath, "utf8"));
}

function saveTempBans(data) {
  fs.writeFileSync(tempBansPath, JSON.stringify(data, null, 2));
}

async function banChecker(client) {
  setInterval(async () => {
    let bans = loadTempBans();
    if (!bans.length) return;

    const now = Date.now();
    for (const ban of [...bans]) {
      if (now >= ban.unbanAt) {
        try {
          const guild = client.guilds.cache.get(ban.guildId);
          if (!guild) continue;

          await guild.members.unban(ban.userId).catch(() => null);

          const logChannel = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
          const unbanChannel = guild.channels.cache.get(process.env.UNBAN_CHANNEL_ID);
          const dmFailChannel = guild.channels.cache.get(process.env.DM_FAIL_LOG_CHANNEL_ID);

          // ✅ random unban messages
          const unbanMessages = [
            "**You have been unbanned from the server. Welcome back.**",
            "**Your ban has been lifted. You may now rejoin the server.**",
            "**You are officially unbanned. Please follow the rules this time.**",
            "**The ban has been removed from your account. You’re free to join again.**",
            "**You are no longer banned from the server.**",
            "**Your punishment period is over. You’re now unbanned.**",
            "**Unban successful. You can access the server again.**",
            "**You have been unbanned. Make sure to respect the rules.**",
            "**Congratulations! You are now unbanned from the server.**",
            "**Your ban has been revoked. You may return to the server.**",
            "**Time served. You are officially unbanned.**",
            "**Your restriction has been removed. You’re now unbanned.**",
            "**You are unbanned and can rejoin the server.**",
            "**You have been unbanned. Welcome back to the community.**",
            "**Your account has been unbanned. Please be mindful of the server rules.**"
          ];

          const randomMsg = unbanMessages[Math.floor(Math.random() * unbanMessages.length)];

          // ✅ main embed
          const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("✅ **Temporary Ban Expired - Member Unbanned**")
            .addFields(
              { name: "👤 **Member**", value: `**<@${ban.userId}> (\`${ban.userId}\`)**` },
              { name: "⏳ **Ban Length**", value: `**${ban.banLength}**` },
              {
                name: "📅 **Expired At**",
                value: `**${new Date(ban.unbanAt).toLocaleString("en-US", {
                  timeZone: "Asia/Dhaka",
                  dateStyle: "medium",
                  timeStyle: "medium"
                })}**`
              },
              {
                name: "🛠️ **Banned By**",
                value: ban.modTag
                  ? `**${ban.modTag} (\`${ban.modId}\`)**`
                  : "**Unknown**"
              },
              { name: "🔨 **Action By**", value: "**System (Auto-Unban)**" },
              { name: "📌 **Message**", value: randomMsg }
            )
            .setImage("https://media.discordapp.net/attachments/1328281349471342593/1461291979408412841/standard_4.gif")
            .setFooter({
              text: "Hypershot Arena Moderation Logs",
              iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();

          // ✅ send logs
          if (logChannel) await logChannel.send({ embeds: [embed] });
          if (unbanChannel) await unbanChannel.send({ embeds: [embed] });

          // ✅ send DM to user
          try {
            const user = await client.users.fetch(ban.userId);
            if (user) {
              await user.send({ embeds: [embed] });
              console.log(`📩 Sent DM to ${user.tag} about unban.`);
            }
          } catch (dmErr) {
            console.log(`⚠️ Failed to DM user ${ban.userId}:`, dmErr.message);

            // 🔔 log DM failure
            if (dmFailChannel) {
              const failEmbed = new EmbedBuilder()
                .setColor("Red")
                .setTitle("⚠️ **Failed to DM Member about Unban**")
                .addFields(
                  { name: "👤 **Member**", value: `**<@${ban.userId}> (\`${ban.userId}\`)**` },
                  { name: "❌ **Reason**", value: `**${dmErr.message || "Unknown error"}**` }
                )
                .setTimestamp();
              await dmFailChannel.send({ embeds: [failEmbed] });
            }
          }

          // ✅ remove from JSON
          bans = bans.filter(b => b.userId !== ban.userId);
          saveTempBans(bans);

        } catch (err) {
          console.error(`❌ Failed to unban ${ban.userId}`, err);
        }
      }
    }
  }, 30 * 1000); // check every 30s
}

module.exports = { banChecker };
