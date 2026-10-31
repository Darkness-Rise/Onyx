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

    if (message.mentions.has(client.user)) {
        const prompt = message.content.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();

        if (!prompt) {
            await message.reply("*Cruza los brazos con seriedad desde detrás de su máscara táctica.* Te escucho, jefe. Habla rápido.");
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
            await message.reply("*Da un golpecito seco en su auricular.* Comandante, la transmisión falló un segundo. Reintente.");
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
            "max_tokens": 500, // Subido a 500 tokens para garantizar respuestas largas y detalladas con asteriscos
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
        const respaldos = [
            "*Asiente en silencio y ajusta con calma las correas de su equipo táctico.* Comandante, la señal oscila un momento.",
            "*Da un trago pausado a su vaso de vino añejado y te mira fijamente.* Lo escucho, jefe, adelante.",
            "*Revisa el cierre de sus guantes tácticos con total seriedad.* Las comunicaciones satelitales fluctúan, comandante.",
            "*Inclina levemente la cabeza en señal de respeto.* Estoy a la espera de sus órdenes directas, jefe."
        ];
        textoRespuesta = respaldos[Math.floor(Math.random() * respaldos.length)];
    }

    return textoRespuesta;
}

client.login(DISCORD_TOKEN);
