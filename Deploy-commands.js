const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
const commandsPath = path.join(__dirname, 'Commands');

console.log(`Buscando comandos en la ruta: ${commandsPath}`);

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    console.log(`Archivos encontrados en la carpeta:`, commandFiles);

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

(async () => {
    try {
        console.log(`Iniciando el despliegue de ${commands.length} comandos (/) para el servidor específico.`);

        const data = await rest.put(
            Routes.applicationGuildCommands('1562899179964211200', '1560958563034341388'),
            { body: commands },
        );

        console.log(`¡Se recargaron con éxito ${data.length} comandos (/) en el servidor!`);
    } catch (error) {
        console.error('Error al desplegar comandos en Discord:', error);
    }
})();
