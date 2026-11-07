Process.on('unhandledRejection', error => {
    Console.error('Error no manejado en el sistema:', error);
});

Process.on('uncaughtException', error => {
    Console.error('Excepción no capturada:', error);
});

// --- VALIDACIÓN DE ENTORNO (Nivel industrial) ---
Const variablesRequeridas = ['DISCORD_BOT_TOKEN', 'MONGODB_URI', 'OPENROUTER_API_KEY'];
Const faltantes = variablesRequeridas.filter(v => !process.env[v]);

If (faltantes.length > 0) {
    Console.error(`❌ [ERROR CRÍTICO] Faltan las siguientes variables de entorno obligatorias: ${faltantes.join(', ')}`);
    Process.exit(1);
}
// -----------------------------------------------

// --- Servidor web integrado para cumplir con los requisitos de Render / Railway ---
Const express = require('express');
Const app = express();
Const PORT = process.env.PORT || 3000;

App.get('/', (req, res) => {
    Res.send('¡Onyx bot está activo y operando!');
});

App.listen(PORT, () => {
    Console.log(`Servidor web interno corriendo en el puerto ${PORT}`);
});
// ---------------------------------------------------------------------

Const fs = require('node:fs');
Const path = require('node:path');
Const { exec } = require('node:child_process');
Const { Client, GatewayIntentBits, Collection, PermissionFlagsBits } = require('discord.js');
Const { consultarOpenRouter } = require('./Services/openrouter');
// Importación actualizada para conectar y usar la purga global desde cloud.js
Const { conectarDB, purgaGlobalServidor } = require('./Services/cloud');
// Importación del sistema autónomo modularizado
const { iniciarSistemaAutonomo } = require('./Services/patrol_routine');
// Importación del sistema de impuestos (Cuota de protección semanal) y Modelo de Configuración de Servidor
const { cobrarImpuestosServidor } = require('./Mongodb/economy');
const ConfigServidor = require('./Mongodb/config'); // <--- Importado para la validación global de roles admin/mod y canales

Const client = new Client({
    Intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

Client.commands = new Collection();

Const commandsPath = path.join(__dirname, 'Commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

For (const file of commandFiles) {
    Const filePath = path.join(commandsPath, file);
    Const command = require(filePath);
    If ('data' in command && 'execute' in command) {
        Client.commands.set(command.data.name, command);
    }
}

Const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;

Client.once('ready', async () => {
    Console.log(`¡Bot conectado y listo como ${client.user.tag}! El sistema está estable.`);

    // --- CONECTAR A MONGODB AL INICIAR ---
    Await conectarDB();
    // ------------------------------------

    // --- EJECUTAR EL DEPLOY DE COMANDOS AUTOMÁTICAMENTE DESDE LA CONSOLA ---
    Exec('node deploy-commands.js', (error, stdout, stderr) => {
        If (error) {
            Console.error(`Error al ejecutar deploy-commands: ${error.message}`);
            Return;
        }
        If (stderr) {
            Console.error(`stderr: ${stderr}`);
        }
        Console.log(`Salida del deploy:\n${stdout}`);
    });
    // ----------------------------------------------------------------------

    // Iniciar el sistema autónomo modularizado
    IniciarSistemaAutonomo(client);

    // --- TAREA PERIÓDICA: COBRO DE CUOTA DE PROTECCIÓN (2% semanal) ---
    SetInterval(async () => {
        Try {
            For (const [guildId, guild] of client.guilds.cache) {
                Const totalRecaudado = await cobrarImpuestosServidor(guildId);
                If (totalRecaudado > 0) {
                    Console.log(`[IMPUESTOS] La organización cobró la cuota de protección en ${guild.name}: ${totalRecaudado.toLocaleString()} € recaudados.`);
                }
            }
        } catch (err) {
            Console.error('Error aplicando la cuota de protección automática:', err);
        }
    }, 24 * 60 * 60 * 1000); // 24 horas
    // -----------------------------------------------------------------
});

// --- EVENTO: Barrido y purga global automática cuando el bot deja un servidor ---
Client.on('guildDelete', async guild => {
    Console.log(`[SISTEMA] Onyx fue expulsado o abandonado del servidor: ${guild.name} (${guild.id})`);
    Await purgaGlobalServidor(guild.id);
});
// -------------------------------------------------------------------------

Client.on('interactionCreate', async interaction => {
    // Manejo de autocompletados
    If (interaction.isAutocomplete()) {
        Const command = client.commands.get(interaction.commandName);
        If (!command || !command.autocomplete) return;
        Try {
            Await command.autocomplete(interaction);
        } catch (error) {
            Console.error(`[ERROR] Falló el autocompletado en /${interaction.commandName}:`, error);
        }
        Return;
    }

    If (!interaction.isChatInputCommand()) return;

    Const commandName = interaction.commandName;
    Const command = client.commands.get(commandName);
    If (!command) return;

    Const guildId = interaction.guild.id;
    Const member = interaction.member;
    Const channelId = interaction.channel.id;

    // --- BUSCAR CONFIGURACIÓN DEL SERVIDOR EN MONGODB ---
    Const config = await ConfigServidor.findOne({ guildId });

    // --- VALIDACIÓN DE RESTRICCIÓN DE CANALES ---
    If (config && config.restriccionesCanales && config.restriccionesCanales.length > 0) {
        // Buscamos si este comando tiene restricciones asignadas
        Const restriccionesComando = config.restriccionesCanales.filter(r => r.comando === commandName);
        
        If (restriccionesComando.length > 0) {
            // Verificamos si el canal actual está dentro de los permitidos para este comando
            Const canalPermitido = restriccionesComando.some(r => r.canalId === channelId);

            If (!canalPermitido) {
                // Obtenemos las menciones de los canales permitidos para informarle al usuario dónde debe usarlo
                Const canalesMencion = restriccionesComando.map(r => `<#${r.canalId}>`).join(', ');
                return await interaction.reply({
                    content: `*Te bloquea el paso con el brazo.* Este tipo de operaciones no se hacen aquí. Dirígete al canal autorizado: ${canalesMencion}.`,
                    ephemeral: true
                });
            }
        }
    }
    // --------------------------------------------

    // --- VALIDACIÓN GLOBAL DE COMANDOS PROTEGIDOS (adminOnly) ---
    If (command.adminOnly) {
        // 1. ¿Es Administrador de Discord por defecto?
        Const esAdminDiscord = member.permissions.has(PermissionFlagsBits.Administrator);

        // 2. ¿Tiene alguno de los roles de moderador configurados en MongoDB para este servidor?
        Const tieneRolMod = config && config.modRolesIds.some(roleId => member.roles.cache.has(roleId));

        If (!esAdminDiscord && !tieneRolMod) {
            return await interaction.reply({
                content: '*Te bloquea el paso con el brazo.* No tienes el rango ni los permisos necesarios de la organización para ejecutar esta orden.',
                ephemeral: true
            });
        }
    }
    // -----------------------------------------------------------

    Try {
        Await command.execute(interaction);
    } catch (error) {
        Console.error(`[ERROR] Falló la ejecución del comando /${commandName}:`, error);
        
        Const respuestaError = { 
            Content: '*Cruza los brazos con molestia.* Hubo una interferencia táctica al procesar esta orden. Reintente.', 
            Ephemeral: true 
        };

        If (interaction.replied || interaction.deferred) {
            Await interaction.followUp(respuestaError).catch(() => {});
        } else {
            Await interaction.reply(respuestaError).catch(() => {});
        }
    }
});

Client.on('messageCreate', async (message) => {
    // Ignorar si el autor es un bot o si es el propio Onyx respondiendo
    If (message.author.bot || message.author.id === client.user.id) return;

    Const contenidoMensaje = message.content.toLowerCase();
    Const esMencionado = message.mentions.has(client.user);
    Const diceSuNombre = contenidoMensaje.includes('onyx');

    If (esMencionado || diceSuNombre) {
        Const prompt = message.content
            .replace(`<@!${client.user.id}>`, '')
            .replace(`<@${client.user.id}>`, '')
            .trim();

        If (!prompt) {
            Await message.reply("*Cruza los brazos con seriedad desde detrás de su máscara táctica.* ¿Dijeron mi nombre? Hablen rápido.");
            Return;
        }

        Await message.channel.sendTyping();

        Try {
            Const userId = message.author.id;
            Const respuestaIA = await consultarOpenRouter(prompt, userId);
            Await message.reply(respuestaIA);
        } catch (error) {
            Console.error("Error al consultar OpenRouter:", error);
            Await message.reply("*Da un golpecito seco en su auricular.* Comandante, la transmisión falló un segundo. Reintente.");
        }
    }
});

Client.login(DISCORD_TOKEN);
