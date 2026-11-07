const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    adminOnly: true, // <--- Protegido automáticamente por el sistema global (Admins + Roles de Mod de /config)
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Envía un mensaje anónimo a través de Onyx.')
        .addStringOption(option =>
            option.setName('mensaje')
                .setDescription('El contenido que dirá el bot')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal opcional donde se enviará el mensaje')
                .setRequired(false))
        // Restricción visual de permisos en Discord para moderadores/gestores
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // Respondemos de forma diferida y oculta (ephemeral) para tener tiempo de procesar el envío
        await interaction.deferReply({ ephemeral: true });

        const textoMensaje = interaction.options.getString('mensaje');
        const canalDestino = interaction.options.getChannel('canal') || interaction.channel;

        try {
            // Verificamos si el canal destino permite enviar mensajes
            if (!canalDestino.isTextBased()) {
                return await interaction.editReply({
                    content: '⚠️ El canal seleccionado no es un canal de texto válido.'
                });
            }

            // Enviamos el mensaje limpio usando la identidad del bot al canal correspondiente
            await canalDestino.send(textoMensaje);

            // Confirmamos de forma oculta al administrador/moderador
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
