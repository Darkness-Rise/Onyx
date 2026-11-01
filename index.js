// Escudo de seguridad global para evitar que el bot se caiga por errores inesperados
process.on('unhandledRejection', error => {
    console.error('Error no manejado en el sistema:', error);
});

process.on('uncaughtException', error => {
    console.error('Excepción no capturada:', error);
});

const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const { consultarOpenRouter } = require('./Services/openrouter');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'Commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commandsJson = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsJson.push(command.data.toJSON());
    }
}

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Cambiamos a 'ready' para asegurar la compatibilidad total del ciclo de vida en Railway
client.once('ready', async () => {
    console.log(`¡Bot conectado y listo como ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    try {
        console.log('Registrando comandos de barra (Slash Commands)...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsJson },
        );
        console.log('¡Comandos registrados con éxito!');
    } catch (error) {
        console.error("Error registrando comandos:", error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const contenidoMensaje = message.content.toLowerCase();
    const esMencionado = message.mentions.has(client.user);
    const diceSuNombre = contenidoMensaje.includes('onyx');

    if (esMencionado || diceSuNombre) {
        const prompt = message.content
            .replace(`<@!${client.user.id}>`, '')
            .replace(`<@${client.user.id}>`, '')
            .trim();

        if (!prompt) {
            await message.reply("*Cruza los brazos con seriedad desde detrás de su máscara táctica.* ¿Dijeron mi nombre? Hablen rápido.");
            return;
        }

        await message.channel.sendTyping();

        try {
            const userId = message.author.id;
            const respuestaIA = await consultarOpenRouter(prompt, userId);
            await message.reply(respuestaIA);
        } catch (error) {
            console.error("Error al consultar OpenRouter:", error);
            await message.reply("*Da un golpecito seco en su auricular.* Comandante, la transmisión falló un segundo. Reintente.");
        }
    }
});

// Mantener el proceso vivo ante señales del sistema de forma limpia
process.on('SIGTERM', () => {
    console.log('Recibida señal SIGTERM, cerrando sesión del bot ordenadamente...');
    client.destroy();
    process.exit(0);
});

client.login(DISCORD_TOKEN);
