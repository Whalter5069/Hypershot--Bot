const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fs = require("fs");
const path = require("path");

const LOA_FILE = path.join(__dirname, "../data/loas.json");
if (!fs.existsSync(LOA_FILE)) fs.writeFileSync(LOA_FILE, JSON.stringify({}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loa-request")
    .setDescription("📝 Submit a Leave of Absence request")
    .addIntegerOption(o =>
      o.setName("length").setDescription("Number (e.g. 5)").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("duration")
        .setDescription("Duration type")
        .setRequired(true)
        .addChoices(
          { name: "Minutes", value: "minutes" },
          { name: "Hours", value: "hours" },
          { name: "Days", value: "days" },
          { name: "Weeks", value: "weeks" },
          { name: "Months", value: "months" }
        )
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("Reason for leave").setRequired(true)
    ),

  async execute(interaction) {
    // ✅ Allowed roles from env
    if (!process.env.ALLOWED_LOA_ROLE) return interaction.reply({
      content: "⚠️ Server is not configured with allowed LOA roles.",
      ephemeral: true
    });

    const ALLOWED_LOA_ROLE = process.env.ALLOWED_LOA_ROLE.split(","); // Array of IDs

    // Check if member has any allowed roles
    if (!interaction.member.roles.cache.some(r => ALLOWED_LOA_ROLE.includes(r.id))) {
      return interaction.reply({
        content: "❌ You don't have permission to use this command.",
        ephemeral: true
      });
    }

    const length = interaction.options.getInteger("length");
    const durationType = interaction.options.getString("duration");
    const reason = interaction.options.getString("reason");

    // Calculate end date
    const endDate = new Date();
    if (durationType === "minutes") endDate.setMinutes(endDate.getMinutes() + length);
    if (durationType === "hours") endDate.setHours(endDate.getHours() + length);
    if (durationType === "days") endDate.setDate(endDate.getDate() + length);
    if (durationType === "weeks") endDate.setDate(endDate.getDate() + length * 7);
    if (durationType === "months") endDate.setMonth(endDate.getMonth() + length);

    const bdTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dhaka",
      dateStyle: "full",
      timeStyle: "short"
    }).format(endDate);

    await interaction.reply({ content: "⏳ Submitting your LOA request...", ephemeral: true });

    // ======================
    // EMBED
    // ======================
    const loaEmbed = new EmbedBuilder()
      .setColor("Gold")
      .setTitle("📝 LOA REQUEST RECEIVED")
      .setDescription(`✨ ${interaction.user} submitted a LOA request.`)
      .addFields(
        { name: "👤 Member", value: `${interaction.user}`, inline: false },
        { name: "⏳ Duration", value: `${length} ${durationType}`, inline: false },
        { name: "📅 End Time (BD)", value: bdTime, inline: false },
        { name: "📄 Reason", value: reason, inline: false }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setImage("https://media.discordapp.net/attachments/1328281349471342593/1461291979408412841/standard_4.gif")
      .setFooter({ text: "⚔️ Hypershot Arena •", iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`loa_approve_${interaction.user.id}`)
        .setLabel("✅ APPROVE")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`loa_cancel_${interaction.user.id}`)
        .setLabel("❌ REJECT")
        .setStyle(ButtonStyle.Danger)
    );

    // ======================
    // Send to LOA channel
    // ======================
    if (!process.env.FIXED_LOA_CHANNEL_ID) return interaction.editReply({
      content: "⚠️ LOA channel is not configured in the .env file.",
      ephemeral: true
    });

    const loaChannel = await interaction.guild.channels.fetch(process.env.FIXED_LOA_CHANNEL_ID).catch(() => null);
    if (loaChannel) {
      await loaChannel.send({ embeds: [loaEmbed], components: [row] });
    }

    // ======================
    // Send to log channel
    // ======================
    if (process.env.LOG_CHANNEL_ID) {
      const logChannel = await interaction.guild.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("Yellow")
              .setTitle("📋 LOA REQUEST LOGGED")
              .setDescription(`${interaction.user.tag} submitted LOA request.`)
              .addFields(
                { name: "Duration", value: `${length} ${durationType}`, inline: true },
                { name: "Ends (BD)", value: bdTime, inline: true },
                { name: "Reason", value: reason, inline: false }
              )
              .setTimestamp()
          ]
        });
      }
    }

    // ======================
    // SAVE TO FILE
    // ======================
    const loas = JSON.parse(fs.readFileSync(LOA_FILE));
    loas[interaction.user.id] = {
      userId: interaction.user.id,
      start: Date.now(),
      end: endDate.getTime(),
      reason,
      status: "pending",
      duration: `${length} ${durationType}`,
      endTime: bdTime
    };
    fs.writeFileSync(LOA_FILE, JSON.stringify(loas, null, 2));

    await interaction.editReply({ content: "✅ Your LOA request has been submitted successfully." });
  }
};
