const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { 
    obtenerConfigServidor, 
    guardarConfigServidor, 
    escanearPatrullasDB, 
    limpiarPatrullasDB 
} = require('../Mongodb/patrol_log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('patrol')
        .setDescription('Sistema de patrullaje autónomo de Onyx respaldado en MongoDB.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Subcomando: SET (Panel interactivo con selección continua hasta 10 canales)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Abre un panel interactivo para añadir canales a la patrulla uno a uno.')
        )
        // Subcomando: UNSET (Menú interactivo con los canales activos para quitarlos)
        .addSubcommand(subcommand =>
            subcommand
                .setName('unset')
                .setDescription('Abre un panel interactivo para remover canales de la ruta.')
        )
        // Subcomando: LOG (Muestra canales activos y últimas acciones)
        .addSubcommand(subcommand =>
            subcommand
                .setName('log')
                .setDescription('Muestra el estado actual y los últimos registros de patrulla en MongoDB.')
        )
        // Subcomando: CLEAN (Limpia los registros innecesarios)
        .addSubcommand(subcommand =>
            subcommand
                .setName('clean')
                .setDescription('Elimina el historial de patrullaje antiguo y resetea contadores.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        
        let configDoc = await obtenerConfigServidor(guildId);
        let canalesMap = configDoc.canales; // Map de Mongoose

        // --- SUBCOMANDO: SET CON SELECCIÓN CONTINUA (Filtra canales ya agregados) ---
        if (subcommand === 'set') {
            await interaction.deferReply({ ephemeral: true });

            const LIMITE_MAXIMO = 10;

            const generarPanel = (mapaActual) => {
                // Si ya llegó al límite, no necesitamos generar opciones de menú
                if (mapaActual.size >= LIMITE_MAXIMO) {
                    const botonTerminar = new ButtonBuilder()
                        .setCustomId('btn_terminar_set')
                        .setLabel('Finalizar Configuración')
                        .setStyle(ButtonStyle.Success);

                    let listaTexto = Array.from(mapaActual.keys()).map(id => `<#${id}>`).join(', ');

                    return {
                        content: `*Cruza los brazos.* Has alcanzado el límite máximo de **${LIMITE_MAXIMO}** canales de patrullaje.\n\n**Canales actuales:** ${listaTexto}`,
                        components: [new ActionRowBuilder().addComponents(botonTerminar)]
                    };
                }

                // Filtramos los canales de texto que NO están en el mapa actual
                const canalesDisponibles = interaction.guild.channels.cache
                    .filter(c => c.type === 0 && !mapaActual.has(c.id))
                    .first(25); // Límite de Discord para menús

                if (canalesDisponibles.length === 0) {
                    const botonTerminar = new ButtonBuilder()
                        .setCustomId('btn_terminar_set')
                        .setLabel('Finalizar Configuración')
                        .setStyle(ButtonStyle.Success);

                    let listaTexto = mapaActual.size > 0 
                        ? Array.from(mapaActual.keys()).map(id => `<#${id}>`).join(', ') 
                        : 'Ninguno';

                    return {
                        content: `*Revisa el perímetro.* No quedan más canales de texto disponibles para añadir.\n\n**Canales actuales (${mapaActual.size}/${LIMITE_MAXIMO}):** ${listaTexto}`,
                        components: [new ActionRowBuilder().addComponents(botonTerminar)]
                    };
                }

                const options = canalesDisponibles.map(canal => ({
                    label: `#${canal.name}`,
                    description: 'Añadir a la ruta de patrullaje',
                    value: canal.id
                }));

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_patrol_continuous')
                    .setPlaceholder(`Canales en patrulla: ${mapaActual.size}/${LIMITE_MAXIMO} (Selecciona uno)`)
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(options);

                const botonTerminar = new ButtonBuilder()
                    .setCustomId('btn_terminar_set')
                    .setLabel('Finalizar Configuración')
                    .setStyle(ButtonStyle.Success);

                const rowMenu = new ActionRowBuilder().addComponents(selectMenu);
                const rowBoton = new ActionRowBuilder().addComponents(botonTerminar);

                let listaTexto = mapaActual.size > 0 
                    ? Array.from(mapaActual.keys()).map(id => `<#${id}>`).join(', ') 
                    : 'Ninguno';

                return {
                    content: `*Abre su maletín táctico.* Selecciona los canales uno a uno (los ya agregados están ocultos).\n\n**Canales actuales (${mapaActual.size}/${LIMITE_MAXIMO}):** ${listaTexto}`,
                    components: [rowMenu, rowBoton]
                };
            };

            const mensajeInicial = await interaction.editReply(generarPanel(canalesMap));

            // Si ya alcanzó el límite desde el inicio, ni abrimos colector innecesariamente
            if (canalesMap.size >= LIMITE_MAXIMO) return;

            const collector = mensajeInicial.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 120000 
            });

            collector.on('collect', async i => {
                if (i.customId === 'select_patrol_continuous') {
                    const channelId = i.values[0];

                    if (canalesMap.has(channelId)) {
                        return await i.reply({ content: '⚠️ Ese canal ya se encuentra añadido a la patrulla.', ephemeral: true });
                    }

                    if (canalesMap.size >= LIMITE_MAXIMO) {
                        return await i.reply({ content: `❌ Has alcanzado el límite máximo de ${LIMITE_MAXIMO} canales.`, ephemeral: true });
                    }

                    canalesMap.set(channelId, 0);
                    await guardarConfigServidor(guildId, canalesMap);

                    // Actualizamos el panel (el canal seleccionado desaparecerá automáticamente del menú)
                    await i.update(generarPanel(canalesMap));
                } 
                else if (i.customId === 'btn_terminar_set') {
                    collector.stop('terminado');
                    await i.update({
                        content: `*Ajusta sus guantes tácticos con firmeza.* Configuración de patrullaje guardada con éxito. Total de canales vigilados: **${canalesMap.size}**.`,
                        components: []
                    });
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await interaction.editReply({
                        content: '*Cierra el maletín táctico.* Tiempo de configuración agotado. Los canales guardados hasta el momento se mantienen activos.',
                        components: []
                    }).catch(() => {});
                }
            });
        }

        // --- SUBCOMANDO: UNSET INTERACTIVO ---
        else if (subcommand === 'unset') {
            await interaction.deferReply({ ephemeral: true });

            if (canalesMap.size === 0) {
                return await interaction.editReply({
                    content: '*Cruza los brazos.* No hay ningún canal bajo patrullaje actualmente para remover.'
                });
            }

            const options = [];
            for (const [canalId] of canalesMap.entries()) {
                const canal = interaction.guild.channels.cache.get(canalId);
                options.push({
                    label: canal ? `#${canal.name}` : `Canal ID: ${canalId}`,
                    description: 'Remover de la vigilancia de Onyx',
                    value: canalId
                });
            }

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_patrol_unset')
                    .setPlaceholder('Selecciona el canal a retirar')
                    .setMinValues(1)
                    .setMaxValues(Math.min(options.length, 5))
                    .addOptions(options)
            );

            const response = await interaction.editReply({
                content: '*Revisa los puntos activos.* Selecciona el canal que deseas retirar de la ruta:',
                components: [row]
            });

            try {
                const confirmation = await response.awaitMessageComponent({ 
                    filter: i => i.user.id === interaction.user.id, 
                    time: 60000 
                });

                let removidos = [];
                for (const channelId of confirmation.values) {
                    if (canalesMap.has(channelId)) {
                        canalesMap.delete(channelId);
                        removidos.push(`<#${channelId}>`);
                    }
                }

                await guardarConfigServidor(guildId, canalesMap);

                await confirmation.update({
                    content: `*Retira la mirada del mapa.* Canales removidos de la base de datos: ${removidos.join(', ')}.`,
                    components: []
                });
            } catch (e) {
                await interaction.editReply({ content: 'Tiempo de espera agotado.', components: [] });
            }
        }

        // --- SUBCOMANDO: LOG ---
        else if (subcommand === 'log') {
            await interaction.deferReply({ ephemeral: true });

            if (canalesMap.size === 0) {
                return await interaction.editReply({
                    content: '*Cruza los brazos con seriedad.* No hay ningún canal asignado para patrullar actualmente.'
                });
            }

            const ultimosLogs = await escanearPatrullasDB(guildId, 5);

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Registro de Patrullaje Táctico (MongoDB)')
                .setColor('#2b2d31')
                .setDescription('Estado actual y actividad reciente del cártel:')
                .setTimestamp();

            let descripcionCanales = '';
            for (const [canalId, contador] of canalesMap.entries()) {
                descripcionCanales += `• <#${canalId}> — **${contador}** patrullajes realizados\n`;
            }
            embed.addFields({ name: 'Canales Activos', value: descripcionCanales });

            if (ultimosLogs.length > 0) {
                let textoLogs = '';
                for (const log of ultimosLogs) {
                    const hora = new Date(log.timestamp).toLocaleTimeString();
                    textoLogs += `\`[${hora}] <#${log.channelId}>\`: ${log.actionText}\n`;
                }
                embed.addFields({ name: 'Ultimas Acciones Registradas', value: textoLogs });
            }

            await interaction.editReply({ embeds: [embed] });
        }

        // --- SUBCOMANDO: CLEAN ---
        else if (subcommand === 'clean') {
            await interaction.deferReply({ ephemeral: true });
            const borrados = await limpiarPatrullasDB(guildId);
            await interaction.editReply({
                content: `*Limpia el historial del servidor.* Se han purgado **${borrados}** registros antiguos de la base de datos y reseteado los contadores.`
            });
        }
    },
};
