process.on('unhandledRejection', error => {
    console.error('Error no manejado en el sistema:', error);
});

process.on('uncaughtException', error => {
    console.error('Excepción no capturada:', error);
});

// --- VALIDACIÓN DE ENTORNO (Nivel industrial) ---
const variablesRequeridas = ['DISCORD_BOT_TOKEN', 'MONGODB_URI', 'OPENROUTER_API_KEY'];
const faltantes = variablesRequeridas.filter(v => !process.env[v]);

if (faltantes.length > 0) {
    console.error(`❌ [ERROR CRÍTICO] Faltan las siguientes variables de entorno obligatorias: ${faltantes.join(', ')}`);
    process.exit(1);
}
// -----------------------------------------------

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
const { Client, GatewayIntentBits, Collection, PermissionFlagsBits } = require('discord.js');
const { consultarOpenRouter } = require('./Services/openrouter');
// Importación actualizada para conectar y usar la purga global desde cloud.js
const { conectarDB, purgaGlobalServidor } = require('./Services/cloud');
// Importación del sistema autónomo modularizado
const { iniciarSistemaAutonomo } = require('./Services/patrol_routine');
// Importación del sistema de impuestos (Cuota de protección semanal) y Modelo de Configuración de Servidor
const { cobrarImpuestosServidor } = require('./Mongodb/economy');
const ConfigServidor = require('./Mongodb/config'); // <--- Importado para la validación global de roles admin/mod

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

    // Iniciar el sistema autónomo modularizado
    iniciarSistemaAutonomo(client);

    // --- TAREA PERIÓDICA: COBRO DE CUOTA DE PROTECCIÓN (2% semanal) ---
    setInterval(async () => {
        try {
            for (const [guildId, guild] of client.guilds.cache) {
                const totalRecaudado = await cobrarImpuestosServidor(guildId);
                if (totalRecaudado > 0) {
                    console.log(`[IMPUESTOS] La organización cobró la cuota de protección en ${guild.name}: ${totalRecaudado.toLocaleString()} € recaudados.`);
                }
            }
        } catch (err) {
            console.error('Error aplicando la cuota de protección automática:', err);
        }
    }, 24 * 60 * 60 * 1000); // 24 horas
    // -----------------------------------------------------------------
});

// --- EVENTO: Barrido y purga global automática cuando el bot deja un servidor ---
client.on('guildDelete', async guild => {
    console.log(`[SISTEMA] Onyx fue expulsado o abandonado del servidor: ${guild.name} (${guild.id})`);
    await purgaGlobalServidor(guild.id);
});
// -------------------------------------------------------------------------

client.on('interactionCreate', async interaction => {
    // Manejo de autocompletados
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(`[ERROR] Falló el autocompletado en /${interaction.commandName}:`, error);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // --- VALIDACIÓN GLOBAL DE COMANDOS PROTEGIDOS (adminOnly) ---
    if (command.adminOnly) {
        const guildId = interaction.guild.id;
        const member = interaction.member;

        // 1. ¿Es Administrador de Discord por defecto?
        const esAdminDiscord = member.permissions.has(PermissionFlagsBits.Administrator);

        // 2. ¿Tiene alguno de los roles de moderador configurados en MongoDB para este servidor?
        const config = await ConfigServidor.findOne({ guildId });
        const tieneRolMod = config && config.modRolesIds.some(roleId => member.roles.cache.has(roleId));

        if (!esAdminDiscord && !tieneRolMod) {
            return await interaction.reply({
                content: '*Te bloquea el paso con el brazo.* No tienes el rango ni los permisos necesarios de la organización para ejecutar esta orden.',
                ephemeral: true
            });
        }
    }
    // -----------------------------------------------------------

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[ERROR] Falló la ejecución del comando /${interaction.commandName}:`, error);
        
        const respuestaError = { 
            content: '*Cruza los brazos con molestia.* Hubo una interferencia táctica al procesar esta orden. Reintente.', 
            ephemeral: true 
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(respuestaError).catch(() => {});
        } else {
            await interaction.reply(respuestaError).catch(() => {});
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
