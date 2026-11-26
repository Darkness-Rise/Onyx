const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    InteractionContextType,
    ApplicationIntegrationType,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Envía un mensaje anónimo (con o sin foto/video) a través de Onyx.')
        .setContexts([
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel,
        ])
        .setIntegrationTypes([
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall,
        ])
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
        const canalOpcion = interaction.options.getChannel('canal');

        try {
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

            const payload = {
                content: textoMensaje,
                allowedMentions: { parse: ['users'] }
            };

            if (adjunto) payload.files = [adjunto];

            // Caso 1: Se especificó un canal explícito
            if (canalOpcion) {
                if (!canalOpcion.isTextBased()) {
                    return await interaction.editReply({
                        content: '⚠️ El canal seleccionado no es un canal de texto válido.'
                    });
                }

                if (interaction.guild) {
                    const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetchMe().catch(() => null);
                    const permisosCanal = botMember ? canalOpcion.permissionsFor(botMember) : null;

                    if (permisosCanal) {
                        const esHilo = typeof canalOpcion.isThread === 'function' && canalOpcion.isThread();
                        const permisoEnvio = esHilo
                            ? PermissionFlagsBits.SendMessagesInThreads
                            : PermissionFlagsBits.SendMessages;

                        if (!permisosCanal.has(permisoEnvio)) {
                            return await interaction.editReply({
                                content: `⚠️ *Interferencia en la frecuencia.* No tengo permiso para enviar mensajes en ${canalOpcion}.`
                            });
                        }

                        if (adjunto && !permisosCanal.has(PermissionFlagsBits.AttachFiles)) {
                            return await interaction.editReply({
                                content: `⚠️ *Interferencia en la frecuencia.* No tengo permiso para adjuntar archivos en ${canalOpcion}.`
                            });
                        }
                    }
                }

                await canalOpcion.send(payload);

                return await interaction.editReply({
                    content: `*Mensaje transmitido con éxito en ${canalOpcion}. Nivel de sigilo: absoluto.*`
                });
            }

            // Caso 2: Dentro de un servidor sin canal explícito -> canal actual
            if (interaction.guild) {
                const canalActual = interaction.channel;

                if (!canalActual || !canalActual.isTextBased()) {
                    return await interaction.editReply({
                        content: '⚠️ No se pudo determinar un canal de texto válido.'
                    });
                }

                const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetchMe().catch(() => null);
                const permisosCanal = botMember ? canalActual.permissionsFor(botMember) : null;

                if (permisosCanal) {
                    const esHilo = typeof canalActual.isThread === 'function' && canalActual.isThread();
                    const permisoEnvio = esHilo
                        ? PermissionFlagsBits.SendMessagesInThreads
                        : PermissionFlagsBits.SendMessages;

                    if (!permisosCanal.has(permisoEnvio)) {
                        return await interaction.editReply({
                            content: `⚠️ *Interferencia en la frecuencia.* No tengo permiso para enviar mensajes en ${canalActual}.`
                        });
                    }

                    if (adjunto && !permisosCanal.has(PermissionFlagsBits.AttachFiles)) {
                        return await interaction.editReply({
                            content: `⚠️ *Interferencia en la frecuencia.* No tengo permiso para adjuntar archivos en ${canalActual}.`
                        });
                    }
                }

                await canalActual.send(payload);

                return await interaction.editReply({
                    content: `*Mensaje transmitido con éxito en ${canalActual}. Nivel de sigilo: absoluto.*`
                });
            }

            // Caso 3: Fuera de servidor (MD / conversación privada)
            const canalDestinoMD = interaction.channel && typeof interaction.channel.send === 'function'
                ? interaction.channel
                : await interaction.user.createDM();

            await canalDestinoMD.send(payload);

            await interaction.editReply({
                content: '*Mensaje transmitido con éxito en esta conversación. Nivel de sigilo: absoluto.*'
            });
        } catch (error) {
            console.error('Error al enviar mensaje anónimo:', error);
            await interaction.editReply({
                content: '⚠️ *Interferencia en la frecuencia.* No se pudo enviar el mensaje en esta conversación.'
            }).catch(() => {});
        }
    },
};
