module.exports = {
    name: 'purge',
    description: 'Borra hasta 200 mensajes, opcionalmente filtrados por usuario.',
    async execute(message, args) {
        // 1. Verificar permisos
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply('¡Ey! No tienes permisos de *Gestionar Mensajes* para usar este comando. 🚫');
        }

        // 2. Obtener la cantidad (por defecto 50, máximo 200)
        let cantidad = parseInt(args[0]);
        
        // Si el primer argumento no es un número (ej: mencionaron a alguien directo), ajustamos
        let usuarioObjetivo = message.mentions.users.first();
        
        if (isNaN(cantidad)) {
            // Si no pusieron número pero sí mencionaron a alguien, ponemos un límite por defecto de 50
            cantidad = 50; 
        } else {
            // Si pusieron un número, verificamos que esté entre 1 y 200
            if (cantidad <= 0 || cantidad > 200) {
                return message.reply('Por favor, indica un número válido de mensajes a revisar (entre 1 y 200). Ejemplo: `!purge 100 @usuario`');
            }
            // Si el segundo argumento es una mención, la guardamos
            usuarioObjetivo = message.mentions.users.at(1) || message.mentions.users.first();
        }

        try {
            await message.channel.sendTyping();

            // Como fetch trae un máximo de 100 por tanda, si piden más de 100 pedimos el doble
            let fetchLimit = cantidad > 100 ? 200 : cantidad + 1;
            const fetchedMessages = await message.channel.messages.fetch({ limit: fetchLimit });

            let mensajesABorrar = Array.from(fetchedMessages.values());

            // Si especificaron un usuario, filtramos solo sus mensajes
            if (usuarioObjetivo) {
                mensajesABorrar = mensajesABorrar.filter(msg => msg.author.id === usuarioObjetivo.id);
            }

            // Limitamos estrictamente a la cantidad que pidió el usuario
            mensajesABorrar = mensajesABorrar.slice(0, cantidad);

            if (mensajesABorrar.length === 0) {
                return message.reply(usuarioObjetivo 
                    ? `No encontré mensajes recientes de ${usuarioObjetivo.tag} para borrar.` 
                    : 'No hay mensajes para borrar.');
            }

            // Discord no borra mensajes de más de 14 días con bulkDelete, filtramos esos por seguridad
            const dosSemanasAtras = Date.now() - 14 * 24 * 60 * 60 * 1000;
            mensajesABorrar = mensajesABorrar.filter(msg => msg.createdTimestamp > dosSemanasAtras);

            if (mensajesABorrar.length === 0) {
                return message.reply('Los mensajes encontrados son más antiguos de 14 días y Discord no permite borrarlos en masa.');
            }

            // Ejecutamos el borrado masivo
            await message.channel.bulkDelete(mensajesABorrar, true);

            const textoUsuario = usuarioObjetivo ? ` de ${usuarioObjetivo.tag}` : '';
            const msgConfirm = await message.channel.send(`¡Listo! Se han limpiado ${mensajesABorrar.length} mensajes${textoUsuario}.`);
            
            setTimeout(() => msgConfirm.delete().catch(() => {}), 4000);

        } catch (error) {
            console.error('Error al hacer purge:', error);
            await message.reply('Ocurrió un error al intentar borrar los mensajes.');
        }
    },
};
