const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
const commandsPath = path.join(__dirname, 'Commands');

console.log(`Buscando comandos en la ruta: ${commandsPath}`);

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
    console.log('Archivos encontrados en la carpeta:', commandFiles);

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
            console.log(`-> Comando cargado con éxito: ${command.data.name}`);
        } else {
            console.log(`[ADVERTENCIA] El archivo ${file} no tiene 'data' o 'execute'.`);
        }
    }
} else {
    console.error(`[ERROR] No se encontró la carpeta Commands en: ${commandsPath}`);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
const clientId = '1562899179964211200';
const guildId = '1560958563034341388';

(async () => {
    try {
        // 1. Limpiar comandos viejos (guild y globales) para eliminar duplicados
        console.log(`Limpiando comandos del servidor ${guildId}...`);
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: [] }
        );

        console.log('Limpiando comandos globales antiguos...');
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: [] }
        );

        // 2. Registrar exclusivamente de forma global
        console.log(`Registrando ${commands.length} comandos a nivel global...`);
        const globalData = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        const nombresDesplegados = globalData.map((cmd) => `/${cmd.name}`).join(', ') || 'ninguno';
        console.log(`¡${globalData.length} comandos cargados a nivel global! Comandos desplegados: ${nombresDesplegados}`);
    } catch (error) {
        console.error('Error durante la limpieza y el registro global:', error);
    }
})();
