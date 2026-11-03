Process.on('unhandledRejection', error => {
    console.error('Error no manejado en el sistema:', error);
});

process.on('uncaughtException', error => {
    console.error('Excepción no capturada:', error);
});

// --- Servidor web integrado para cumplir con los requisitos de Render / Railway ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('¡Onyx bot está activo y operando!');
});

app.listen(PORT, () => {
    console.log(`Servidor web interno corriendo en el puerto ${PORT}`);
});
// ---------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { consultarOpenRouter } = require('./Services/openrouter');
const { conectarDB } = require('./Services/cloud'); // <-- Conexión modular de MongoDB

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

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const rutaConfigCanales = path.join(__dirname, 'Config/canales.json');

function leerConfigCanales() {
    if (!fs.existsSync(rutaConfigCanales)) return {};
    try {
        return JSON.parse(fs.readFileSync(rutaConfigCanales, 'utf8'));
    } catch (e) {
        return {};
    }
}

// --- SISTEMA DE ACCIONES AUTÓNOMAS Y PRESENCIA DINÁMICA MULTI-SERVIDOR ---
function iniciarSistemaAutonomoMultiServidor() {
    const estadosDinamicos = [
        { name: 'vigilando los accesos del cártel', type: 3 }, // Watching
        { name: 'un buen vino tinto', type: 2 },                // Listening
        { name: 'limpiando el cañón de su arma', type: 0 },     // Playing
        { name: 'revisando el perímetro en silencio', type: 3 } // Watching
    ];

    const actualizarPresencia = () => {
        const estadoAleatorio = estadosDinamicos[Math.floor(Math.random() * estadosDinamicos.length)];
        client.user.setPresence({
            activities: [estadoAleatorio],
            status: 'dnd', // No molestar
        });
    };

    actualizarPresencia();
    setInterval(actualizarPresencia, 30 * 60 * 1000); // Rota el estado cada 30 min

    // TIEMPO DE PRUEBA: 1 a 2 minutos para ver si salta rápido
    const obtenerTiempoAleatorio = () => {
        const minMinutos = 1;
        const maxMinutos = 2;
        return (Math.random() * (maxMinutos - minMinutos) + minMinutos) * 60 * 1000;
    };

    const ejecutarRondas = async () => {
        const config = leerConfigCanales();
        console.log("[PATRULLAJE] Configuración leída de canales:", config);
        
        if (Object.keys(config).length === 0) {
            console.log("[PATRULLAJE] Advertencia: El archivo canales.json está vacío o no se encontró.");
        }

        for (const [guildId, channelId] of Object.entries(config)) {
            try {
                const guild = client.guilds.cache.get(guildId);
                if (!guild) {
                    console.log(`[PATRULLAJE] No se encontró el servidor en caché con ID: ${guildId}`);
                    continue;
                }

                const canal = await guild.channels.fetch(channelId);
                if (canal) {
                    console.log(`[PATRULLAJE] Enviando acción autónoma al canal ${canal.name} (${guild.name})...`);
                    const promptAccion = "Genera una acción corta y aleatoria en tercera persona (*como esta*) de lo que estás haciendo en este momento en el servidor (ej: patrullando los pasillos, limpiando tu arma, bebiendo vino, ajustando tus guantes o tu máscara). Sé breve, directo y mantén tu personalidad fría de ex-militar.";
                    
                    const accionGenerada = await consultarOpenRouter(promptAccion, `sistema-autonomo-${guildId}`);
                    if (accionGenerada) {
                        await canal.send(accionGenerada);
                        console.log("[PATRULLAJE] ¡Mensaje enviado con éxito!");
                    }
                } else {
                    console.log(`[PATRULLAJE] No se pudo encontrar el canal con ID: ${channelId}`);
                }
            } catch (err) {
                console.error(`No se pudo enviar patrulla en el servidor ${guildId}:`, err);
            }
        }

        setTimeout(ejecutarRondas, obtenerTiempoAleatorio());
    };

    // Primera ejecución de prueba en 15 segundos tras arrancar
    setTimeout(ejecutarRondas, 15000);
}
// -------------------------------------------------------------------------

client.once('ready', async () => {
    console.log(`¡Bot conectado y listo como ${client.user.tag}! El sistema está estable.`);

    // --- CONECTAR A MONGODB AL INICIAR ---
    await conectarDB();
    // ------------------------------------

    // --- EJECUTAR EL DEPLOY DE COMANDOS AUTOMÁTICAMENTE DESDE LA CONSOLA ---
    exec('node deploy-commands.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error al ejecutar deploy-commands: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
        }
        console.log(`Salida del deploy:\n${stdout}`);
    });
    // ----------------------------------------------------------------------

    iniciarSistemaAutonomoMultiServidor();
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
    // Ignorar si el autor es un bot o si es el propio Onyx respondiendo
    if (message.author.bot || message.author.id === client.user.id) return;

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

client.login(DISCORD_TOKEN);
