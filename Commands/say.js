const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
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
        // Opcional: seguridad para que solo ciertos rangos o administradores lo usen
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // Obtenemos los argumentos
        const textoMensaje = interaction.options.getString('mensaje');
        const canalDestino = interaction.options.getChannel('canal') || interaction.channel;

        try {
            // Enviamos el mensaje limpio usando la identidad del bot
            await canalDestino.send(textoMensaje);

            // Le respondemos de forma oculta (ephemeral) al usuario para confirmar que se envió
            await interaction.reply({
                content: `*Mensaje transmitido con éxito en ${canalDestino}. Nivel de sigilo: absoluto.*`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error al enviar mensaje anónimo:', error);
            await interaction.reply({
                content: 'Error en la transmisión. No tengo permisos para escribir en ese canal.',
                ephemeral: true
            });
        }
    },
};
