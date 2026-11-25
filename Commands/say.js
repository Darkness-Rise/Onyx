const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Envía un mensaje anónimo (con o sin foto/video) a través de Onyx.')
        .addStringOption(option =>
            option.setName('mensaje')
                .setDescription('El contenido que dirá el bot')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('imagen')
                .setDescription('Foto o video opcional para adjuntar al mensaje')
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal opcional donde se enviará el mensaje')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const textoMensaje = interaction.options.getString('mensaje', true).trim();
        const adjunto = interaction.options.getAttachment('imagen');
        const canalDestino = interaction.options.getChannel('canal') || interaction.channel;

        try {
            if (!canalDestino || !canalDestino.isTextBased()) {
                return await interaction.editReply({
                    content: '⚠️ El canal seleccionado no es un canal de texto válido.'
                });
            }

            if (!textoMensaje) {
                return await interaction.editReply({
                    content: '⚠️ Debes escribir un mensaje para enviar.'
                });
            }

            if (adjunto) {
                const tipoMime = adjunto.contentType || '';
                const esFotoOVideo = tipoMime.startsWith('image/') || tipoMime.startsWith('video/');

                if (!esFotoOVideo) {
                    return await interaction.editReply({
                        content: '⚠️ *Interferencia en la frecuencia.* Solo se admiten fotos o videos como archivo adjunto.'
                    });
                }
            }

            const botMember = interaction.guild?.members?.me ?? await interaction.guild?.members?.fetchMe().catch(() => null);
            const permisosCanal = botMember ? canalDestino.permissionsFor(botMember) : null;

            if (permisosCanal) {
                const esHilo = typeof canalDestino.isThread === 'function' && canalDestino.isThread();
                const permisoEnvio = esHilo
                    ? PermissionFlagsBits.SendMessagesInThreads
                    : PermissionFlagsBits.SendMessages;

                if (!permisosCanal.has(permisoEnvio)) {
                    return await interaction.editReply({
                        content: `⚠️ *Interferencia en la frecuencia.* No tengo permiso para enviar mensajes en ${canalDestino}.`
                    });
                }

                if (adjunto && !permisosCanal.has(PermissionFlagsBits.AttachFiles)) {
                    return await interaction.editReply({
                        content: `⚠️ *Interferencia en la frecuencia.* No tengo permiso para adjuntar archivos en ${canalDestino}.`
                    });
                }
            }

            const payload = {
                content: textoMensaje,
                allowedMentions: { parse: ['users'] }
            };

            if (adjunto) payload.files = [adjunto];

            await canalDestino.send(payload);

            await interaction.editReply({
                content: `*Mensaje transmitido con éxito en ${canalDestino}. Nivel de sigilo: absoluto.*`
            });
        } catch (error) {
            console.error('Error al enviar mensaje anónimo:', error);
            await interaction.editReply({
                content: '⚠️ *Interferencia en la frecuencia.* No tengo permisos para escribir en ese canal o ocurrió un error.'
            }).catch(() => {});
        }
    },
};
