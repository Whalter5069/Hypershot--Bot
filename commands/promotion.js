const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require("discord.js");
const fs = require("fs");
const path = require("path");

/* ================= ROLE IDS ================= */
const roles = {
  gangAccess: process.env.GANG_ACCESS_ROLE_ID,
  khomota: process.env.KHOMOTA_ROLE_ID
};

/* ================= RANK ROLE ID ================= */
const roleToRankMap = {
  [process.env.RANK_RECRUIT_ROLE_ID]: "recruit",
  [process.env.RANK_FIRST_DIVISION_ROLE_ID]: "firstDivision",
  [process.env.RANK_SECOND_DIVISION_ROLE_ID]: "secondDivision",
  [process.env.RANK_THIRD_DIVISION_ROLE_ID]: "thirdDivision",
  [process.env.RANK_HIGH_COMMAND_ROLE_ID]: "highCommand",
  [process.env.RANK_CO_LEADER_ROLE_ID]: "coLeader",
  [process.env.RANK_MAFIA_ROLE_ID]: "Mafia"
};

/* ================= FILE PATH ================= */
const dataFolder = path.join(__dirname, "..", "data");
const jsonPath = path.join(dataFolder, "royalGang.json");

/* ================= JSON FUNCTIONS ================= */
function ensureJSON() {
  if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder);
  if (!fs.existsSync(jsonPath)) {
    fs.writeFileSync(
      jsonPath,
      JSON.stringify({
        recruit: [],
        firstDivision: [],
        secondDivision: [],
        thirdDivision: [],
        highCommand: [],
        coLeader: [],
        Mafia: []
      }, null, 2)
    );
  }
}

function loadGang() {
  ensureJSON();
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

function saveGang(data) {
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
}

function removeFromPreviousRank(userId, gang) {
  for (const r in gang) {
    gang[r] = gang[r].filter(id => id !== userId);
  }
}

function getTotalMembers(gang) {
  return Object.values(gang).reduce((total, arr) => total + arr.length, 0);
}


/* ================= EMOJI With Id ================= */
const emoji = {
  arrow: `<a:arrowred1:${process.env.EMOJI_ARROW_ID}>`,
  alert1: `<a:alert1:${process.env.EMOJI_ALERT_ID}>`,
  redcrownfire: `<a:redcrownfire:${process.env.EMOJI_REDCROWNFIRE_ID}>`,
  pinkquartz: `<a:pinkquartz:${process.env.EMOJI_PINKQUARTZ_ID}>`,
  diablo: `<a:diablo:${process.env.EMOJI_DIABLO_ID}>`,
  flashingskull: `<a:flashingskull:${process.env.EMOJI_FLASHINGSKULL_ID}>`,
  teammythril: `<a:teammythril:${process.env.EMOJI_TEAMMYTHRIL_ID}>`,
  worldcollector: `<a:worldcollector:${process.env.EMOJI_WORLDCOLLECTOR_ID}>`,
  recruitrank: `<a:recruitrank:${process.env.EMOJI_RECRUITRANK_ID}>`,
  divider2: `<a:divider2:${process.env.EMOJI_DIVIDER2_ID}>`,
  divider1: `<a:divider1:${process.env.EMOJI_DIVIDER1_ID}>`,
  bluesiren: `<a:bluesiren:${process.env.EMOJI_BLUESIREN_ID}>`,
  rankup: `<a:rankup:${process.env.EMOJI_RANKUP_ID}>`,
  rankdown: `<a:rankdown:${process.env.EMOJI_RANKDOWN_ID}>`,
  Rainbow: `<a:divider1:${process.env.EMOJI_RAINBOW_ID}>`
};


/* ================= PROMO MESSAGES ================= */
const promotionMessages = [
  `${emoji.alert1} Congratulations on your well-deserved promotion!`,
  `${emoji.diablo} The Hypershot Arena grows stronger with your promotion.`,
  `${emoji.redcrownfire} Another warrior rises higher on the battlefield.`,
  `${emoji.pinkquartz} Congratulations on your well-deserved promotion!`,
  `${emoji.teammythril} A new rank, a new responsibility — wear it with pride!`,
  `${emoji.flashingskull} Your hard work has finally paid off, salute to you!`,
  `${emoji.recruitrank} Respect the rank, lead with honor — congrats soldier!`,
  `${emoji.worldcollector} Your dedication has earned you this new title.`,
  `${emoji.bluesiren} Promoted and powered up — the city better be ready!`,
  `${emoji.alert1} With great rank comes greater responsibility — good luck!`,
  `${emoji.redcrownfire} Your promotion is a victory for the whole Syndicate.`
];

/* ================= DEMOTION MESSAGES ================= */
const demotionMessages = [
  `${emoji.alert1} Due to internal decision, rank has been adjusted.`,
  `${emoji.flashingskull} Discipline is the path to strength.`,
  `${emoji.bluesiren} Rank updated by High Command order.`,
  `${emoji.pinkquartz} A step down, but not the end of the journey.`,
  `${emoji.teammythril} With great power comes great responsibility — and lessons to learn.`,
  `${emoji.redcrownfire} The Syndicate expects growth from every setback.`,
  `${emoji.worldcollector} Demotions are tough, but they build stronger leaders.`,
  `${emoji.diablo} Loyalty and discipline are the true marks of a soldier.`,
  `${emoji.alert1} Sometimes you step back, only to rise stronger.`,
  `${emoji.recruitrank} Respect is earned, and roles must reflect actions.`,
  `${emoji.pinkquartz} Every fall is an opportunity to rise again.`,
  `${emoji.teammythril} Discipline is key in the Hypershot Arena.`,
  `${emoji.redcrownfire} This demotion is a reminder, not a defeat.`,
  `${emoji.alert1} Demoted after performance review.`
];



/* ================= MEMBER CHART ================= */
function formatGangEmbed(gang, client) {
  const totalMembers = getTotalMembers(gang);
  const format = arr =>
    arr.length
      ? arr.map(id => `${emoji.arrow} <@${id}>`).join("\n")
      : "_None_";

  return new EmbedBuilder()
    .setColor("White")
    .setTitle(`${emoji.alert1} THE OFFICIAL MEMBERS OF Hypershot Arena ${emoji.alert1}`)
    .setDescription(`
${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}${emoji.divider1}
${emoji.redcrownfire} **Mafia**
${format(gang.Mafia)}

${emoji.pinkquartz} **Co-Leader**
${format(gang.coLeader)}

${emoji.diablo} **High-Command**
${format(gang.highCommand)}

${emoji.flashingskull} **Third Devision**
${format(gang.thirdDivision)}

${emoji.teammythril} **Second Devision**
${format(gang.secondDivision)}

${emoji.worldcollector} **First Devision**
${format(gang.firstDivision)}

${emoji.recruitrank} **Recruit**
${format(gang.recruit)}

${emoji.bluesiren} **Total Members:** **${totalMembers}**
${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}${emoji.divider2}
<@&${roles.gangAccess}>   <@&${roles.khomota}>
`)
    .setImage("https://cdn.discordapp.com/attachments/1328281349471342593/1466672070573162567/IMG_3279.png?ex=697d984f&is=697c46cf&hm=171274c2228b51ef88c5d0713187b3dbadc8b821e45fe57f713adc64b260f1ad")
    .setFooter({
      text: "Hypershot Arena Management",
      iconURL: client.user.displayAvatarURL()
    });
}


/* ================= SLASH COMMAND ================= */
module.exports = {
  data: new SlashCommandBuilder()
    .setName("gangmembar")
    .setDescription("Hypershot Arena member system")
    .addStringOption(o =>
      o.setName("action")
        .setDescription("Action")
        .setRequired(true)
        .addChoices(
          { name: "Add Member", value: "add" },
          { name: "Remove Member", value: "remove" },
          { name: "Promotion", value: "promotion" },
          { name: "Demotion", value: "demotion" },
          { name: "Reset Member Chart", value: "reset" }
        )
    )
    .addUserOption(o =>
      o.setName("user").setDescription("Member").setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("newrole").setDescription("Rank")
    ),
  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles))
        return interaction.editReply("❌ Permission denied.");

      const user = interaction.options.getUser("user");
      const action = interaction.options.getString("action");
      const newRole = interaction.options.getRole("newrole");
      const member = await interaction.guild.members.fetch(user.id);

      const gang = loadGang();
      let reply = "";

      if (!newRole) return interaction.editReply("❌ Select a rank.");
      const rankKey = roleToRankMap[newRole.id];
      if (!rankKey) return interaction.editReply("❌ Rank not mapped.");

      if (action === "add") {
        if (!gang[rankKey].includes(user.id))
          gang[rankKey].push(user.id);
        await member.roles.add(newRole);
        reply = "✅ Member added.";
      }

      if (action === "remove") {
        gang[rankKey] = gang[rankKey].filter(id => id !== user.id);
        await member.roles.remove(newRole);
        reply = "❌ Member removed.";
      }

      /* ================= PROMOTION ================= */
      if (action === "promotion") {
        // remove old ranks
        removeFromPreviousRank(user.id, gang);
        Object.keys(roleToRankMap).forEach(id =>
          member.roles.cache.has(id) &&
          member.roles.remove(id).catch(() => { })
        );

        // add new rank
        gang[rankKey].push(user.id);
        await member.roles.add(newRole);

        // 🔥 RANDOM PROMOTION MESSAGE (OLD SYSTEM BACK)
        const finalMessage =
          promotionMessages[Math.floor(Math.random() * promotionMessages.length)];

        const promoEmbed = new EmbedBuilder()
          .setColor("Green")
          .setTitle("🏅 Promotion Announcement")
          .setDescription(
            `${emoji.redcrownfire} **${user}** has been promoted!\n\n` +
            `${emoji.rankup} **New Rank:** ${newRole}\n\n` +
            `${finalMessage}`
          )
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setImage("https://media.discordapp.net/attachments/1328281349471342593/1461291979408412841/standard_4.gif")
          .setFooter({ text: "Hypershot Arena Management", iconURL: interaction.client.user.displayAvatarURL() })

        const promoCh = await interaction.guild.channels
          .fetch(process.env.PROMOTION_CHANNEL_ID)
          .catch(() => null);

        if (promoCh) {
          await promoCh.send({
            content: `${user}`, // mention user
            embeds: [promoEmbed]
          });
        }

        reply = "🏅 Promotion successful.";
      }

      /* ================= DEMOTION ================= */
      if (action === "demotion") {
        // remove old ranks
        removeFromPreviousRank(user.id, gang);
        Object.keys(roleToRankMap).forEach(id =>
          member.roles.cache.has(id) &&
          member.roles.remove(id).catch(() => { })
        );

        // add new (lower) rank
        gang[rankKey].push(user.id);
        await member.roles.add(newRole);

        // 🔻 RANDOM DEMOTION MESSAGE
        const finalMessage =
          demotionMessages[Math.floor(Math.random() * demotionMessages.length)];

        const demoteEmbed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("⚠️ Demotion Notice")
          .setDescription(
            `${emoji.redcrownfire} **${user}** has been demoted.\n\n` +
            `${emoji.rankdown} **New Rank:** ${newRole}\n\n` +
            `${finalMessage}`
          )
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setImage("https://media.discordapp.net/attachments/1328281349471342593/1461291979408412841/standard_4.gif")
          .setFooter({ text: "Hypershot Arena Management", iconURL: interaction.client.user.displayAvatarURL() })

        const promoCh = await interaction.guild.channels
          .fetch(process.env.DEMOTION_CHANNEL_ID)
          .catch(() => null);

        if (promoCh) {
          await promoCh.send({
            content: `${user}`,
            embeds: [demoteEmbed]
          });
        }

        reply = "⚠️ Demotion successful.";
      }

      /* ================= RESET MEMBER CHART ================= */
      if (action === "reset") {
        // JSON reset
        const emptyGang = {
          recruit: [],
          firstDivision: [],
          secondDivision: [],
          thirdDivision: [],
          highCommand: [],
          coLeader: [],
          Mafia: []
        };

        saveGang(emptyGang);

        // chart channel
        const chartCh = await interaction.guild.channels
          .fetch(process.env.MEMBER_CHART_CHANNEL_ID)
          .catch(() => null);

        if (chartCh) {
          const msgs = await chartCh.messages.fetch({ limit: 10 });
          msgs
            .filter(m => m.author.id === interaction.client.user.id)
            .forEach(m => m.delete().catch(() => { }));

          await chartCh.send({
            embeds: [formatGangEmbed(emptyGang, interaction.client)],
            allowedMentions: { roles: [roles.gangAccess, roles.khomota] }
          });
        }

        return interaction.editReply("✅ Member chart has been reset successfully.");
      }


      saveGang(gang);

      const chartCh = await interaction.guild.channels
        .fetch(process.env.MEMBER_CHART_CHANNEL_ID);

      const msgs = await chartCh.messages.fetch({ limit: 10 });
      msgs.filter(m => m.author.id === interaction.client.user.id)
        .forEach(m => m.delete().catch(() => { }));

      await chartCh.send({
        embeds: [formatGangEmbed(gang, interaction.client)],
        allowedMentions: { roles: [roles.gangAccess, roles.khomota] }
      });


      interaction.editReply(reply);

    } catch (e) {
      console.error(e);
      interaction.editReply("❌ Error occurred.");
    }
  }



};
