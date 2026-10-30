const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Borra hasta 200 mensajes, opcionalmente filtrados por usuario.')
        .addIntegerOption(option =>
            option.name('cantidad')
                .setDescription('Número de mensajes a revisar (entre 1 y 200)')
                .setRequired(true))
        .addUserOption(option =>
            option.name('usuario')
                .setDescription('Filtrar mensajes de un usuario específico')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const cantidad = interaction.options.getInteger('cantidad');
        const usuarioObjetivo = interaction.options.getUser('usuario');

        if (cantidad <= 0 || cantidad > 200) {
            return interaction.editReply('Por favor, indica un número válido de mensajes a revisar (entre 1 y 200).');
        }

        try {
            let fetchLimit = cantidad > 100 ? 200 : cantidad;
            const fetchedMessages = await interaction.channel.messages.fetch({ limit: fetchLimit });

            let mensajesABorrar = Array.from(fetchedMessages.values());

            if (usuarioObjetivo) {
                mensajesABorrar = mensajesABorrar.filter(msg => msg.author.id === usuarioObjetivo.id);
            }

            mensajesABorrar = mensajesABorrar.slice(0, cantidad);

            if (mensajesABorrar.length === 0) {
                return interaction.editReply(usuarioObjetivo 
                    ? `No encontré mensajes recientes de ${usuarioObjetivo.tag} para borrar.` 
                    : 'No hay mensajes para borrar.');
            }

            const dosSemanasAtras = Date.now() - 14 * 24 * 60 * 60 * 1000;
            mensajesABorrar = mensajesABorrar.filter(msg => msg.createdTimestamp > dosSemanasAtras);

            if (mensajesABorrar.length === 0) {
                return interaction.editReply('Los mensajes encontrados son más antiguos de 14 días y Discord no permite borrarlos en masa.');
            }

            await interaction.channel.bulkDelete(mensajesABorrar, true);

            const textoUsuario = usuarioObjetivo ? ` de ${usuarioObjetivo.tag}` : '';
            await interaction.editReply(`¡Listo! Se han limpiado ${mensajesABorrar.length} mensajes${textoUsuario}.`);

        } catch (error) {
            console.error('Error al hacer purge:', error);
            await interaction.editReply('Ocurrió un error al intentar borrar los mensajes.');
        }
    },
};
