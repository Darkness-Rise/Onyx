const {
  SlashCommandBuilder,
  ChannelType,
  InteractionContextType,
  ApplicationIntegrationType,
} = require('discord.js');

const DEFAULT_MESSAGE = 'RaidBypanas - https://discord.gg/yDkV9RdJpK , https://www.youtube.com/c/alann2007';
const INTERVAL_MS = 450;
const MIN_REPEATS = 1;
const MAX_REPEATS = 10;
const DEFAULT_REPEATS = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildPayload({ text, imageUrl, attachment }) {
  const cleanText = text ? text.trim() : '';
  const cleanUrl = imageUrl ? imageUrl.trim() : '';
  const files = attachment ? [{ attachment: attachment.url, name: attachment.name }] : undefined;

  let content = null;
  if (cleanText && cleanUrl) {
    content = `${cleanText}\n${cleanUrl}`;
  } else if (cleanText) {
    content = cleanText;
  } else if (cleanUrl) {
    content = cleanUrl;
  } else if (!files) {
    content = DEFAULT_MESSAGE;
  }

  return {
    ...(content ? { content } : {}),
    ...(files ? { files } : {}),
  };
}

async function sendRepeated(user, payload, repeats) {
  for (let i = 0; i < repeats; i += 1) {
    try {
      await user.send(payload);
    } catch (error) {
      console.error(`Error enviando MD a ${user.tag} (${user.id}):`, error.message);
      break;
    }

    if (i < repeats - 1) {
      await sleep(INTERVAL_MS);
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('saymd')
    .setDescription('Envía mensajes directos configurables con imagen adjunta o enlace')
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
    )
    .addStringOption((option) =>
      option
        .setName('mensaje')
        .setDescription('Texto del mensaje (si se omite, usa el mensaje por defecto)')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('cantidad')
        .setDescription(`Veces a enviar (${MIN_REPEATS} a ${MAX_REPEATS}, por defecto ${DEFAULT_REPEATS})`)
        .setMinValue(MIN_REPEATS)
        .setMaxValue(MAX_REPEATS)
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName('archivo')
        .setDescription('Adjunta una imagen directamente desde tu dispositivo')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('imagen')
        .setDescription('Enlace http/https directo de una imagen')
        .setRequired(false)
    ),

  async execute(interaction) {
    const explicitUser = interaction.options.getUser('usuario');
    const customMessage = interaction.options.getString('mensaje');
    const rawRepeats = interaction.options.getInteger('cantidad');
    const attachment = interaction.options.getAttachment('archivo');
    const imageUrl = interaction.options.getString('imagen');

    if (attachment && !attachment.contentType?.startsWith('image/')) {
      return interaction.reply({
        content: 'El archivo adjunto debe ser una imagen válida (`image/*`).',
        ephemeral: true,
      });
    }

    if (imageUrl && !isValidHttpUrl(imageUrl.trim())) {
      return interaction.reply({
        content: 'La opción `imagen` debe ser una URL válida que empiece con `http://` o `https://`.',
        ephemeral: true,
      });
    }

    const repeats = rawRepeats ?? DEFAULT_REPEATS;
    const payload = buildPayload({
      text: customMessage,
      imageUrl,
      attachment,
    });

    if (explicitUser) {
      if (explicitUser.bot || explicitUser.id === interaction.user.id) {
        return interaction.reply({
          content: 'Selecciona otro usuario válido que no sea tú ni un bot.',
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: `Enviando (${repeats}x) a **${explicitUser.tag}**...`,
        ephemeral: true,
      });
      await sendRepeated(explicitUser, payload, repeats);
      return;
    }

    if (interaction.channel?.type === ChannelType.DM) {
      const recipient = interaction.channel.recipient;

      if (!recipient || recipient.bot || recipient.id === interaction.user.id) {
        return interaction.reply({
          content: 'No se encontró la otra persona de este MD. Usa la opción `usuario`.',
          ephemeral: true,
        });
      }

      await interaction.reply({
        content: `Enviando (${repeats}x) a **${recipient.tag}** desde este MD...`,
        ephemeral: true,
      });
      await sendRepeated(recipient, payload, repeats);
      return;
    }

    if (!interaction.guild) {
      return interaction.reply({
        content: 'Ejecuta el comando en un MD con otra persona, en un servidor o indica un `usuario`.',
        ephemeral: true,
      });
    }

    const targets = interaction.guild.members.cache.filter(
      (member) => !member.user.bot && member.id !== interaction.user.id
    );

    await interaction.reply({
      content: `Enviando (${repeats}x) a **${targets.size}** miembros en caché...`,
      ephemeral: true,
    });

    for (const member of targets.values()) {
      await sendRepeated(member.user, payload, repeats);
    }
  },
};
