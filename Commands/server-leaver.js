const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} = require('discord.js');

const SNOWFLAKE_REGEX = /^\d{17,20}$/;
const CONFIRM_TIMEOUT_MS = 30_000; // 30 segundos para confirmar
const OWNER_IDS = new Set([
  '1573052133031416022',
  '1535030930534568088',
]);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaveguild')
    .setDescription('Hace que el bot abandone un servidor específico (solo owners).')
    .addStringOption((option) =>
      option
        .setName('guild_id')
        .setDescription('ID del servidor del que saldrá el bot.')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!OWNER_IDS.has(interaction.user.id)) {
      await interaction.reply({
        content: 'No tienes permiso para usar este comando.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const targetGuildId = interaction.options.getString('guild_id', true).trim();

    if (!SNOWFLAKE_REGEX.test(targetGuildId)) {
      await interaction.reply({
        content: 'El `guild_id` ingresado no tiene un formato válido de ID de Discord.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild =
      interaction.client.guilds.cache.get(targetGuildId) ??
      (await interaction.client.guilds.fetch(targetGuildId).catch(() => null));

    if (!guild) {
      await interaction.editReply({
        content: `El bot no está actualmente en ningún servidor con el ID \`${targetGuildId}\`.`,
      });
      return;
    }

    const guildName = guild.name;
    const guildId = guild.id;
    const confirmCustomId = `leaveguild_confirm_${interaction.id}`;
    const cancelCustomId = `leaveguild_cancel_${interaction.id}`;

    const promptEmbed = new EmbedBuilder()
      .setColor('#ed4245')
      .setTitle('Confirmar salida de servidor')
      .setDescription(
        `¿Seguro que quieres que el bot salga de este servidor?\n\n` +
          `**Nombre:** ${guildName.replace(/([*_`~|>])/g, '\\$1')}\n` +
          `**ID:** \`${guildId}\``
      )
      .setFooter({ text: 'Tienes 30 segundos para confirmar.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(confirmCustomId)
        .setLabel('Salir del servidor')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(cancelCustomId)
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary)
    );

    const message = await interaction.editReply({
      embeds: [promptEmbed],
      components: [row],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: CONFIRM_TIMEOUT_MS,
      filter: (btnInteraction) => {
        if (!OWNER_IDS.has(btnInteraction.user.id)) {
          btnInteraction
            .reply({
              content: 'Solo un owner puede responder a esta confirmación.',
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
          return false;
        }
        if (btnInteraction.user.id !== interaction.user.id) {
          btnInteraction
            .reply({
              content: 'Solo quien ejecutó el comando puede confirmar esta acción.',
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
          return false;
        }
        return (
          btnInteraction.customId === confirmCustomId ||
          btnInteraction.customId === cancelCustomId
        );
      },
    });

    let resolved = false;

    collector.on('collect', async (btnInteraction) => {
      if (resolved) return;
      resolved = true;

      try {
        if (btnInteraction.customId === cancelCustomId) {
          collector.stop('cancelled');
          await btnInteraction.update({
            content: `Operación cancelada. El bot permanece en **${guildName}** (\`${guildId}\`).`,
            embeds: [],
            components: [],
          });
          return;
        }

        const activeGuild =
          interaction.client.guilds.cache.get(guildId) ??
          (await interaction.client.guilds.fetch(guildId).catch(() => null));

        if (!activeGuild) {
          collector.stop('not_found');
          await btnInteraction.update({
            content: `El bot ya no estaba en el servidor \`${guildId}\`.`,
            embeds: [],
            components: [],
          });
          return;
        }

        await activeGuild.leave();
        collector.stop('left');

        await btnInteraction.update({
          content: `El bot abandonó correctamente **${guildName}** (\`${guildId}\`).`,
          embeds: [],
          components: [],
        });
      } catch (err) {
        console.error(`Error al sacar el bot del servidor ${guildId}:`, err);
        await btnInteraction
          .update({
            content: `Hubo un error al intentar salir de **${guildName}** (\`${guildId}\`). Revisa los logs del bot.`,
            embeds: [],
            components: [],
          })
          .catch(() => {});
      }
    });

    collector.on('end', async (_collected, reason) => {
      if (resolved || reason === 'cancelled' || reason === 'left' || reason === 'not_found') {
        return;
      }

      try {
        await interaction.editReply({
          content: 'Tiempo agotado. Operación cancelada.',
          embeds: [],
          components: [],
        });
      } catch {
        // Ignoramos si el mensaje o la interacción ya expiraron
      }
    });
  },
};
