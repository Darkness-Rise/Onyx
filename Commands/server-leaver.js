import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} from 'discord.js';

const SNOWFLAKE_REGEX = /^\d{17,20}$/;
const CONFIRM_TIMEOUT_MS = 30_000; // 30 segundos para confirmar

export default {
  data: new SlashCommandBuilder()
    .setName('leaveserver')
    .setDescription('Hace que el bot abandone un servidor específico (solo owner).')
    .addStringOption((option) =>
      option
        .setName('guild_id')
        .setDescription('ID del servidor del que saldrá el bot.')
        .setRequired(true)
    ),

  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;

    if (!ownerId || interaction.user.id !== ownerId) {
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

    // Buscamos primero en caché y luego vía REST para cubrir servidores no cacheados
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
        if (btnInteraction.user.id !== ownerId) {
          btnInteraction
            .reply({
              content: 'Solo el owner puede responder a esta confirmación.',
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

        // Confirmado: revalidamos que siga en el servidor antes de llamar a leave()
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
