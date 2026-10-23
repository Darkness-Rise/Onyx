const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const { consultarIA } = require('./services/aiService'); // Importamos el servicio de IA

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Conexión a MongoDB
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('🟢 [DB]: Onyx se ha conectado a la base de datos de la mafia.'))
        .catch(err => console.error('🔴 [DB Error]: No se pudo conectar a MongoDB:', err));
}

client.once('ready', () => {
    console.log(`🖤 [Onyx]: El ejecutor ${client.user.tag} está en línea y vigilando el territorio.`);
});

// Escucha de mensajes para interactuar con la IA
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Si mencionan al bot o usan el prefijo, procesa con la IA de OpenRouter
    if (message.mentions.has(client.user)) {
        // Limpiamos la mención del texto para enviarle solo la pregunta limpia a la IA
        const textoLimpio = message.content.replace(/<@!?\d+>/g, '').trim();
        
        if (!textoLimpio) {
            await message.reply('*Ajusta su máscara en silencio, esperando instrucciones.*');
            return;
        }

        // Mostrar indicador de que está escribiendo/pensando
        await message.channel.sendTyping();

        // Consultar a la IA
        const respuestaIA = await consultarIA(textoLimpio);
        await message.reply(respuestaIA);
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
