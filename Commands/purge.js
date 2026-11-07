const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    adminOnly: true, // <--- Protegido automáticamente por el sistema global del index.js (Admins + Roles de Mod)
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Borra hasta 100 mensajes, opcionalmente filtrados por usuario.')
        .addIntegerOption(option => 
            option.setName('cantidad')
                  .setDescription('Número de mensajes a revisar (entre 1 y 100)')
                  .setRequired(true)
        )
        .addUserOption(option => 
            option.setName('usuario')
                  .setDescription('Filtrar mensajes de un usuario específico')
                  .setRequired(false)
        )
        // Restringido visualmente en Discord para administradores
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const cantidad = interaction.options.getInteger('cantidad');
        const usuarioObjetivo = interaction.options.getUser('usuario');

        if (cantidad <= 0 || cantidad > 100) {
            return interaction.editReply('*Pasa un trapo por la barra y niega con la cabeza.* Indica un número válido de mensajes a revisar (entre 1 y 100).');
        }

        try {
            const fetchedMessages = await interaction.channel.messages.fetch({ limit: cantidad });

            let mensajesABorrar = Array.from(fetchedMessages.values());

            if (usuarioObjetivo) {
                mensajesABorrar = mensajesABorrar.filter(msg => msg.author.id === usuarioObjetivo.id);
            }

            if (mensajesABorrar.length === 0) {
                return interaction.editReply(usuarioObjetivo 
                    ? `*Revisa las esquinas.* No encontré rastros ni mensajes recientes de ese usuario para limpiar.` 
                    : '*El mostrador está limpio.* No hay mensajes recientes para borrar.');
            }

            // Los mensajes de más de 14 días no se pueden borrar en masa por limitaciones de la API de Discord
            const dosSemanasAtras = Date.now() - 14 * 24 * 60 * 60 * 1000;
            mensajesABorrar = mensajesABorrar.filter(msg => msg.createdTimestamp > dosSemanasAtras);

            if (mensajesABorrar.length === 0) {
                return interaction.editReply('⚠️ Los mensajes encontrados tienen más de 14 días en el archivo y Discord prohíbe borrarlos en masa.');
            }

            await interaction.channel.bulkDelete(mensajesABorrar, true);

            const textoUsuario = usuarioObjetivo ? ` de ese usuario` : '';
            await interaction.editReply(`*Hace crujir sus nudillos.* Zona despejada. Se han borrado **${mensajesABorrar.length}** mensajes${textoUsuario}.`);

        } catch (error) {
            console.error('Error al hacer purge:', error);
            await interaction.editReply('⚠️ *Se traba el mecanismo.* Ocurrió un error al intentar limpiar el canal.');
        }
    },
};
