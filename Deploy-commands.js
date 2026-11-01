const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
const commandsPath = path.join(__dirname, 'Commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log(`Iniciando el despliegue de ${commands.length} comandos (/) de la aplicación.`);

        // Usando directamente el ID de tu bot para registrar los comandos globales
        const data = await rest.put(
            Routes.applicationCommands('1562899179964211200'),
            { body: commands },
        );

        console.log(`¡Se recargaron con éxito ${data.length} comandos (/) de la aplicación!`);
    } catch (error) {
        console.error(error);
    }
})();
