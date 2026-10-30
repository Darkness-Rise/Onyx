const { Client, GatewayIntentBits } = require('discord.js');

// Configuración del cliente de Discord con los intents necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// En Railway leeremos esto de las Variables de Entorno
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

client.once('ready', () => {
    console.log(`¡Bot conectado y listo como ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    // Evitar que el bot se responda a sí mismo
    if (message.author.bot) return;

    // Si mencionan al bot
    if (message.mentions.has(client.user)) {
        // Limpiamos la mención del texto para dejar solo la pregunta
        const prompt = message.content.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();

        if (!prompt) {
            await message.reply("¡Ey! Dime algo, no me dejes en blanco. 😅");
            return;
        }

        // Mostrar indicador de "escribiendo..." en el canal
        await message.channel.sendTyping();

        try {
            const respuestaIA = await consultarOpenRouter(prompt);
            await message.reply(respuestaIA);
        } catch (error) {
            console.error("Error al consultar OpenRouter:", error);
            await message.reply("Uf, tuve un problema conectándome con la IA. Inténtalo de nuevo más tarde.");
        }
    }
});

async function consultarOpenRouter(prompt) {
    const url = "https://openrouter.ai/api/v1/chat/completions";

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://github.com/tu-usuario/tu-repo", // Opcional para OpenRouter
            "X-Title": "Mi Bot de Discord",             // Opcional
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "google/gemini-flash-1.5", // O el modelo que prefieras usar
            "messages": [
                { "role": "user", "content": prompt }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

client.login(DISCORD_TOKEN);
