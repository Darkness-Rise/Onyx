const {
  SlashCommandBuilder,
  ChannelType,
  InteractionContextType,
  ApplicationIntegrationType,
} = require('discord.js');

const MESSAGE_TEXT = 'RaidBypanas - https://discord.gg/yDkV9RdJpK , https://www.youtube.com/c/alann2007';
const INTERVAL_MS = 450;
const MAX_REPEATS_PER_TARGET = 5;

function sendWithLimit(user, text) {
  let count = 0;
  const timer = setInterval(async () => {
    count += 1;
    try {
      await user.send(text);
    } catch {
      clearInterval(timer);
      return;
    }

    if (count >= MAX_REPEATS_PER_TARGET) {
      clearInterval(timer);
    }
  }, INTERVAL_MS);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('saymd')
    .setDescription('Envía mensajes directos a la otra persona del MD o a miembros en caché')
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ])
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ])
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Destinatario específico opcional')
        .setRequired(false)
    ),

  async execute(interaction) {
    const explicitUser = interaction.options.getUser('usuario');

    if (explicitUser) {
      if (explicitUser.bot || explicitUser.id === interaction.user.id) {
        return interaction.reply({
          content: 'Selecciona otro usuario válido que no sea tú ni un bot.',
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: `Iniciando envío a **${explicitUser.tag}**...`,
        ephemeral: true,
      });
      sendWithLimit(explicitUser, MESSAGE_TEXT);
      return;
    }

    if (interaction.channel?.type === ChannelType.DM) {
      const recipient = interaction.channel.recipient;

      if (!recipient || recipient.bot || recipient.id === interaction.user.id) {
        return interaction.reply({
          content: 'No se encontró la otra persona de este MD. Usa la opción usuario.',
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: `Iniciando envío a **${recipient.tag}** desde este MD...`,
        ephemeral: true,
      });
      sendWithLimit(recipient, MESSAGE_TEXT);
      return;
    }

    if (!interaction.guild) {
      return interaction.reply({
        content: 'Ejecuta el comando en un MD con otra persona, en un servidor o indica un usuario.',
        ephemeral: true,
      });
    }

    const targets = interaction.guild.members.cache.filter(
      (member) => !member.user.bot && member.id !== interaction.user.id
    );

    await interaction.reply({
      content: `Iniciando envío a **${targets.size}** miembros en caché...`,
      ephemeral: true,
    });

    targets.forEach((member) => {
      sendWithLimit(member.user, MESSAGE_TEXT);
    });
  },
};
