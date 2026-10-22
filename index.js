const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');

// Inicializar el cliente de Discord con los intents necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Conexión a MongoDB (opcional por ahora, pero lista para usarse)
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('🟢 [DB]: Onyx se ha conectado a la base de datos de la mafia.'))
        .catch(err => console.error('🔴 [DB Error]: No se pudo conectar a MongoDB:', err));
}

client.once('ready', () => {
    console.log(`🖤 [Onyx]: El ejecutor ${client.user.tag} está en línea y vigilando el territorio.`);
});

// Escucha simple para probar que responde en el servidor
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Comando de prueba básico o mención
    if (message.content.toLowerCase() === '!onyx' || message.mentions.has(client.user)) {
        await message.reply('*Ajusta su máscara en silencio, analizando la situación con frialdad.* Territorio vigilado, jefe. ¿Cuál es la orden?');
    }
});

// Iniciar sesión con el Token de Discord
client.login(process.env.DISCORD_BOT_TOKEN);
