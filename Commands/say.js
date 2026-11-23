const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    adminOnly: true, // <--- Protegido automáticamente por el sistema global (Admins + Roles de Mod de /config)
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Envía un mensaje anónimo (con o sin imagen) a través de Onyx.')
        .addStringOption(option =>
            option.setName('mensaje')
                .setDescription('El contenido que dirá el bot')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('imagen')
                .setDescription('Imagen opcional para adjuntar al mensaje')
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal opcional donde se enviará el mensaje')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const textoMensaje = interaction.options.getString('mensaje');
        const adjunto = interaction.options.getAttachment('imagen');
        const canalDestino = interaction.options.getChannel('canal') || interaction.channel;

        try {
            if (!canalDestino || !canalDestino.isTextBased()) {
                return await interaction.editReply({
                    content: '⚠️ El canal seleccionado no es un canal de texto válido.'
                });
            }

            if (!textoMensaje && !adjunto) {
                return await interaction.editReply({
                    content: '⚠️ Debes escribir un mensaje o adjuntar una imagen para enviar.'
                });
            }

            // Opcional: descomenta si quieres bloquear archivos que no sean imágenes
            // if (adjunto && !adjunto.contentType?.startsWith('image/')) {
            //     return await interaction.editReply({
            //         content: '⚠️ El archivo adjunto debe ser una imagen válida.'
            //     });
            // }

            const payload = {
                allowedMentions: { parse: ['users'] }
            };

            if (textoMensaje) payload.content = textoMensaje;
            if (adjunto) payload.files = [adjunto];

            await canalDestino.send(payload);

            await interaction.editReply({
                content: `*Mensaje transmitido con éxito en ${canalDestino}. Nivel de sigilo: absoluto.*`
            });
        } catch (error) {
            console.error('Error al enviar mensaje anónimo:', error);
            await interaction.editReply({
                content: '⚠️ *Interferencia en la frecuencia.* No tengo permisos para escribir en ese canal o ocurrió un error.'
            });
        }
    },
};
