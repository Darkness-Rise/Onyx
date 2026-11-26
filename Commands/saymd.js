const {
  SlashCommandBuilder,
  ChannelType,
  InteractionContextType,
  ApplicationIntegrationType,
} = require('discord.js');

const INTERVAL_MS = 450;
const MIN_REPEATS = 1;
const MAX_REPEATS = 20;
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
  const cleanText = text.trim();
  const cleanUrl = imageUrl ? imageUrl.trim() : '';
  const files = attachment ? [{ attachment: attachment.url, name: attachment.name }] : undefined;
  const content = cleanUrl ? `${cleanText}\n${cleanUrl}` : cleanText;

  return {
    content,
    ...(files ? { files } : {}),
  };
}

async function sendRepeated(user, payload, repeats) {
  let sent = 0;
  let failed = 0;
  let reason = null;

  for (let i = 0; i < repeats; i += 1) {
    try {
      await user.send(payload);
      sent += 1;
    } catch (error) {
      failed += 1;
      reason = error.message || 'Error al enviar MD';
      console.error(`Error enviando MD a ${user.tag} (${user.id}):`, reason);
      break;
    }

    if (i < repeats - 1) {
      await sleep(INTERVAL_MS);
    }
  }

  return { sent, failed, reason };
}

async function sendWhisper(interaction, content) {
  try {
    await interaction.followUp({
      content,
      ephemeral: true,
    });
  } catch (error) {
    console.error('No se pudo enviar el whisper de estado:', error.message);
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
    .addStringOption((option) =>
      option
        .setName('mensaje')
        .setDescription('Texto del mensaje a enviar')
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('Destinatario específico opcional')
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
    const customMessage = interaction.options.getString('mensaje', true);
    const explicitUser = interaction.options.getUser('usuario');
    const rawRepeats = interaction.options.getInteger('cantidad');
    const attachment = interaction.options.getAttachment('archivo');
    const imageUrl = interaction.options.getString('imagen');

    if (!customMessage.trim()) {
      return interaction.reply({
        content: 'El mensaje no puede estar vacío.',
        ephemeral: true,
      });
    }

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

      const result = await sendRepeated(explicitUser, payload, repeats);
      const completed = result.sent === repeats && result.failed === 0;

      const whisperText = completed
        ? `Envío completado: **${result.sent}/${repeats}** mensajes entregados a **${explicitUser.tag}**.`
        : `Envío incompleto a **${explicitUser.tag}**: **${result.sent}/${repeats}** entregados${
            result.reason ? ` (${result.reason})` : ''
          }.`;

      await sendWhisper(interaction, whisperText);
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

      const result = await sendRepeated(recipient, payload, repeats);
      const completed = result.sent === repeats && result.failed === 0;

      const whisperText = completed
        ? `Envío completado: **${result.sent}/${repeats}** mensajes entregados a **${recipient.tag}**.`
        : `Envío incompleto a **${recipient.tag}**: **${result.sent}/${repeats}** entregados${
            result.reason ? ` (${result.reason})` : ''
          }.`;

      await sendWhisper(interaction, whisperText);
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

    let totalSent = 0;
    let totalFailed = 0;
    let incompleteUsers = 0;
    const expectedTotal = targets.size * repeats;

    for (const member of targets.values()) {
      const result = await sendRepeated(member.user, payload, repeats);
      totalSent += result.sent;
      totalFailed += result.failed;
      if (result.sent < repeats || result.failed > 0) {
        incompleteUsers += 1;
      }
    }

    const allCompleted = totalSent === expectedTotal && totalFailed === 0;
    const whisperText = allCompleted
      ? `Envío completado al 100%: **${totalSent}/${expectedTotal}** mensajes entregados a **${targets.size}** usuarios.`
      : `Envío no completado del todo: **${totalSent}/${expectedTotal}** entregados (${incompleteUsers} usuario(s) con fallo o incompletos).`;

    await sendWhisper(interaction, whisperText);
  },
};
