const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log('Iniciando la limpieza de comandos globales antiguos...');

        // Envía un array vacío a la ruta global para borrar cualquier comando huérfano
        const data = await rest.put(
            Routes.applicationCommands('1562899179964211200'),
            { body: [] },
        );

        console.log('¡Comandos globales eliminados con éxito! La barra de comandos ha quedado limpia.');
    } catch (error) {
        console.error('Error al limpiar comandos globales:', error);
    }
})();
