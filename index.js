const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const { obtenerPromptSistema } = require('./Config/personality');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.commands = new Collection();

// Cargar comandos desde la carpeta Commands
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
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

client.once('clientReady', async () => {
    console.log(`¡Bot conectado y listo como ${client.user.tag}!`);

    // Registrar los comandos de barra en Discord automáticamente
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    try {
        console.log('Registrando comandos de barra (Slash Commands)...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsJson },
        );
        console.log('¡Comandos registrados con éxito!');
    } catch (error) {
        console.error(error);
    }
});

// Manejador de interacciones (Slash Commands)
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

// Manejador de menciones para la IA con personalidad modular y respaldo de contenido vacío
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.mentions.has(client.user)) {
        const prompt = message.content.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();

        if (!prompt) {
            await message.reply("👁️... (Asiente en silencio y te mira fijamente, esperando que digas algo útil).");
            return;
        }

        await message.channel.sendTyping();

        try {
            const userId = message.author.id;
            const systemPrompt = obtenerPromptSistema(userId);

            const respuestaIA = await consultarOpenRouter(prompt, systemPrompt);
            await message.reply(respuestaIA);
        } catch (error) {
            console.error("Error al consultar OpenRouter:", error);
            await message.reply("👁️... (Mantiene la mirada fría). Tuve un problema conectándome con los servidores. Inténtalo más tarde.");
        }
    }
});

async function consultarOpenRouter(prompt, systemPrompt) {
    const url = "https://openrouter.ai/api/v1/chat/completions";

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://github.com/Darkness-Rise/Onyx", 
            "X-Title": "Onyx Bot",             
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
            "max_tokens": 150, // Ajustado a 150 para que alcance a razonar y responder con texto plano
            "messages": [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": prompt }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("Respuesta completa de OpenRouter:", JSON.stringify(data));

    let textoRespuesta = data.choices?.[0]?.message?.content;

    if (!textoRespuesta || textoRespuesta.trim() === "") {
        textoRespuesta = "👁️... (Asiente en silencio y revisa el cargador de su arma).";
    }

    return textoRespuesta;
}

client.login(DISCORD_TOKEN);
