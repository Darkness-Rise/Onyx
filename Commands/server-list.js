const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} = require('discord.js');

const PER_PAGE = 10;
const COLLECTOR_TIME_MS = 120_000; // 2 minutos
const OWNER_IDS = new Set([
  '1573052133031416022',
  '1535030930534568088',
]);

function buildGuildEmbed(guildsList, pageIndex, totalPages, totalGuilds) {
  const start = pageIndex * PER_PAGE;
  const slice = guildsList.slice(start, start + PER_PAGE);

  const lines = slice.map((guild, idx) => {
    const num = start + idx + 1;
    const rawName = guild.name || 'Servidor sin nombre';
    const safeName = rawName.replace(/([*_`~|>])/g, '\\$1');
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guilds')
    .setDescription('Lista los servidores donde está el bot (máx. 10 por página).'),

  async execute(interaction) {
    if (!OWNER_IDS.has(interaction.user.id)) {
      await interaction.reply({
        content: 'No tienes permiso para usar este comando.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const fetchedGuilds = await interaction.client.guilds.fetch();
    const guildsList = Array.from(fetchedGuilds.values()).sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });

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
        if (!OWNER_IDS.has(btnInteraction.user.id)) {
          btnInteraction
            .reply({
              content: 'No tienes permiso para interactuar con este menú.',
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
          return false;
        }
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
        // Ignoramos si el mensaje fue eliminado o la interacción expiró
      }
    });
  },
};
