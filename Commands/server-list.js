import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} from 'discord.js';

const PER_PAGE = 10;
const COLLECTOR_TIME_MS = 120_000; // 2 minutos

function buildGuildEmbed(guildsList, pageIndex, totalPages, totalGuilds) {
  const start = pageIndex * PER_PAGE;
  const slice = guildsList.slice(start, start + PER_PAGE);

  const lines = slice.map((guild, idx) => {
    const num = start + idx + 1;
    // Escapamos caracteres markdown básicos para que nombres raros no rompan el formato
    const safeName = guild.name.replace(/([*_`~|>])/g, '\\$1');
    return `**${num}.** ${safeName}\n\`ID: ${guild.id}\``;
  });

  return new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('Servidores del bot')
    .setDescription(lines.join('\n\n'))
    .setFooter({
      text: `Página ${pageIndex + 1} de ${totalPages} • Total: ${totalGuilds} servidores`,
    })
    .setTimestamp();
}

function buildPaginationRow(pageIndex, totalPages, disabledAll = false) {
  const prevButton = new ButtonBuilder()
    .setCustomId('guilds_prev')
    .setLabel('Anterior')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabledAll || pageIndex <= 0);

  const nextButton = new ButtonBuilder()
    .setCustomId('guilds_next')
    .setLabel('Siguiente')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabledAll || pageIndex >= totalPages - 1);

  return new ActionRowBuilder().addComponents(prevButton, nextButton);
}

export default {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('Lista los servidores donde está el bot (máx. 10 por página).'),

  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;

    if (!ownerId || interaction.user.id !== ownerId) {
      await interaction.reply({
        content: 'No tienes permiso para usar este comando.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Obtenemos todos los servidores vía REST para no depender de una caché incompleta
    const fetchedGuilds = await interaction.client.guilds.fetch();
    const guildsList = Array.from(fetchedGuilds.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );

    if (guildsList.length === 0) {
      await interaction.editReply({
        content: 'El bot no está en ningún servidor actualmente.',
      });
      return;
    }

    const totalPages = Math.ceil(guildsList.length / PER_PAGE);
    let currentPage = 0;

    const embed = buildGuildEmbed(guildsList, currentPage, totalPages, guildsList.length);
    const components =
      totalPages > 1 ? [buildPaginationRow(currentPage, totalPages)] : [];

    const message = await interaction.editReply({
      embeds: [embed],
      components,
    });

    if (totalPages <= 1) {
      return;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_TIME_MS,
      filter: (btnInteraction) => {
        if (btnInteraction.user.id !== interaction.user.id) {
          btnInteraction
            .reply({
              content: 'Solo quien ejecutó el comando puede cambiar de página.',
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
          return false;
        }
        return true;
      },
    });

    collector.on('collect', async (btnInteraction) => {
      try {
        if (btnInteraction.customId === 'guilds_prev' && currentPage > 0) {
          currentPage -= 1;
        } else if (
          btnInteraction.customId === 'guilds_next' &&
          currentPage < totalPages - 1
        ) {
          currentPage += 1;
        }

        const updatedEmbed = buildGuildEmbed(
          guildsList,
          currentPage,
          totalPages,
          guildsList.length
        );
        const updatedRow = buildPaginationRow(currentPage, totalPages);

        await btnInteraction.update({
          embeds: [updatedEmbed],
          components: [updatedRow],
        });
      } catch (err) {
        console.error('Error al actualizar la página de servidores:', err);
      }
    });

    collector.on('end', async () => {
      try {
        const disabledRow = buildPaginationRow(currentPage, totalPages, true);
        await interaction.editReply({
          components: [disabledRow],
        });
      } catch {
        // Si el mensaje fue borrado o el token de interacción caducó, ignoramos limpio
      }
    });
  },
};
