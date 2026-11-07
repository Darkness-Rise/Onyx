const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    RoleSelectMenuBuilder, 
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const ConfigServidor = require('../Mongodb/config');

module.exports = {
    adminOnly: true, 
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('[ADMIN] Abre el panel interactivo de configuración del bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guild.id;
        const guildName = interaction.guild.name;
        const client = interaction.client; // <-- Obtenemos el cliente para leer los comandos registrados

        let config = await ConfigServidor.findOne({ guildId });
        if (!config) {
            config = await ConfigServidor.create({ guildId, modRolesIds: [], restriccionesCanales: [] });
        }

        let categoriaActual = 'cat_roles';
        let comandoSeleccionadoTemp = null; // Almacena temporalmente qué comando eligió restringir

        // Función para generar el Panel de Control Dinámico
        const generarPanel = (currentConfig, cat) => {
            categoriaActual = cat;
            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Panel de Control del Distrito — ${guildName}`)
                .setColor('#2b2d31')
                .setTimestamp();

            // Menú superior para cambiar de categoría
            const menuCategorias = new StringSelectMenuBuilder()
                .setCustomId('config_menu_categorias')
                .setPlaceholder('📂 Selecciona una categoría a configurar...')
                .addOptions([
                    new StringSelectMenuOptionBuilder()
                        .setValue('cat_roles')
                        .setLabel('Roles de Moderación')
                        .setDescription('Gestiona quiénes pueden usar comandos administrativos')
                        .setEmoji('🛡️')
                        .setDefault(cat === 'cat_roles'),
                    new StringSelectMenuOptionBuilder()
                        .setValue('cat_canales')
                        .setLabel('Restricción de Canales')
                        .setDescription('Asigna comandos a canales específicos (ej. Dark-Market)')
                        .setEmoji('🎯')
                        .setDefault(cat === 'cat_canales')
                ]);

            const rowCategoria = new ActionRowBuilder().addComponents(menuCategorias);
            let componentesRows = [rowCategoria];

            if (cat === 'cat_roles') {
                const rolesMencion = currentConfig.modRolesIds.length > 0 
                    ? currentConfig.modRolesIds.map(id => `<@&${id}>`).join(', ') 
                    : '*Ningún rol asignado todavía*';

                embed.setDescription('Gestiona los permisos y accesos especiales del bot en este servidor.')
                     .addFields({ name: '🛡️ Roles de Moderadores/Admins actuales', value: rolesMencion });

                const selectRol = new RoleSelectMenuBuilder()
                    .setCustomId('config_select_roles')
                    .setPlaceholder('👇 Selecciona los roles con permisos...')
                    .setMinValues(1)
                    .setMaxValues(5);

                const rowSelect = new ActionRowBuilder().addComponents(selectRol);
                const rowBotones = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('config_limpiar_roles').setEmoji('🧹').setLabel('Limpiar Roles').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('config_cerrar').setEmoji('🔒').setLabel('Cerrar Panel').setStyle(ButtonStyle.Secondary)
                );
                componentesRows.push(rowSelect, rowBotones);

            } else if (cat === 'cat_canales') {
                const restriccionesLista = currentConfig.restriccionesCanales.length > 0
                    ? currentConfig.restriccionesCanales.map(r => `• Comando \`/${r.comando}\` ➔ <#${r.canalId}>`).join('\n')
                    : '*Ninguna restricción configurada.*';

                embed.setDescription('Amarra comandos específicos a canales concretos (como tu `#dark-market`).')
                     .addFields({ name: '🎯 Restricciones Actuales', value: restriccionesLista });

                // Detectamos AUTOMÁTICAMENTE todos los comandos del bot que tengan un nombre válido
                const comandosDisponibles = Array.from(client.commands.values()).map(cmd => {
                    const nombreCmd = cmd.data?.name || cmd.name;
                    return nombreCmd;
                }).filter(Boolean);

                // Quitamos duplicados por si acaso
                const comandosUnicos = [...new Set(comandosDisponibles)];

                // Creamos el menú desplegable con LOS COMANDOS DETECTADOS SOLITOS
                const opcionesComandos = comandosUnicos.map(cmdName => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`/${cmdName}`)
                        .setValue(cmdName)
                        .setDescription(`Restringir el uso del comando /${cmdName}`)
                        .setDefault(comandoSeleccionadoTemp === cmdName)
                );

                const selectComando = new StringSelectMenuBuilder()
                    .setCustomId('config_select_comando_objetivo')
                    .setPlaceholder(comandoSeleccionadoTemp ? `Comando seleccionado: /${comandoSeleccionadoTemp}` : '1️⃣ Selecciona el comando a restringir...')
                    .addOptions(opcionesComandos);

                const rowComando = new ActionRowBuilder().addComponents(selectComando);
                componentesRows.push(rowComando);

                // Si ya eligió un comando, mostramos el selector de canales para vincularlo
                if (comandoSeleccionadoTemp) {
                    const selectCanal = new ChannelSelectMenuBuilder()
                        .setCustomId('config_select_canal_restringido')
                        .setPlaceholder(`2️⃣ Selecciona el canal para /${comandoSeleccionadoTemp}...`)
                        .setMinValues(1)
                        .setMaxValues(1);

                    const rowCanal = new ActionRowBuilder().addComponents(selectCanal);
                    componentesRows.push(rowCanal);
                }

                const rowBotonesCanales = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('config_limpiar_canales').setEmoji('🧹').setLabel('Limpiar Restricciones').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('config_cerrar').setEmoji('🔒').setLabel('Cerrar Panel').setStyle(ButtonStyle.Secondary)
                );
                componentesRows.push(rowBotonesCanales);
            }

            return { embeds: [embed], components: componentesRows };
        };

        const mensajePanel = await interaction.editReply(generarPanel(config, categoriaActual));
        const collector = mensajePanel.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return await i.reply({ content: '⚠️ Este panel no te pertenece, abre el tuyo con `/config`.', ephemeral: true });
            }

            // --- CAMBIO DE CATEGORÍA ---
            if (i.isStringSelectMenu() && i.customId === 'config_menu_categorias') {
                await i.deferUpdate();
                categoriaActual = i.values[0];
                comandoSeleccionadoTemp = null; // Reseteamos al cambiar de categoría
                await i.editReply(generarPanel(config, categoriaActual));
            }

            // --- SELECCIÓN DE ROLES ---
            else if (i.isRoleSelectMenu() && i.customId === 'config_select_roles') {
                await i.deferUpdate();
                config = await ConfigServidor.findOneAndUpdate(
                    { guildId },
                    { $addToSet: { modRolesIds: { $each: i.values } } },
                    { new: true, upsert: true }
                );
                await i.editReply(generarPanel(config, 'cat_roles'));
            }

            // --- PASO 1: SELECCIONAR QUÉ COMANDO SE VA A RESTRINGIR ---
            else if (i.isStringSelectMenu() && i.customId === 'config_select_comando_objetivo') {
                await i.deferUpdate();
                comandoSeleccionadoTemp = i.values[0]; // Guardamos el comando elegido (ej. 'tienda')
                await i.editReply(generarPanel(config, 'cat_canales'));
            }

            // --- PASO 2: SELECCIONAR EL CANAL DESTINO PARA ESE COMANDO ---
            else if (i.isChannelSelectMenu() && i.customId === 'config_select_canal_restringido') {
                await i.deferUpdate();
                const canalIdSeleccionado = i.values[0];

                if (!comandoSeleccionadoTemp) {
                    return; // Si por algo no hay comando seleccionado, ignoramos
                }

                // Evitamos duplicar la misma regla exacta
                config = await ConfigServidor.findOneAndUpdate(
                    { guildId },
                    { $addToSet: { restriccionesCanales: { comando: comandoSeleccionadoTemp, canalId: canalIdSeleccionado } } },
                    { new: true, upsert: true }
                );

                comandoSeleccionadoTemp = null; // Reseteamos selección temporal
                await i.editReply(generarPanel(config, 'cat_canales'));
            }

            // --- LIMPIAR DATOS ---
            else if (i.isButton() && i.customId === 'config_limpiar_roles') {
                await i.deferUpdate();
                config = await ConfigServidor.findOneAndUpdate({ guildId }, { modRolesIds: [] }, { new: true });
                await i.editReply(generarPanel(config, 'cat_roles'));
            }
            else if (i.isButton() && i.customId === 'config_limpiar_canales') {
                await i.deferUpdate();
                config = await ConfigServidor.findOneAndUpdate({ guildId }, { restriccionesCanales: [] }, { new: true });
                await i.editReply(generarPanel(config, 'cat_canales'));
            }

            // --- CERRAR PANEL ---
            else if (i.isButton() && i.customId === 'config_cerrar') {
                await i.update({ content: '🔒 *El panel de configuración ha sido cerrado.*', embeds: [], components: [] });
                collector.stop();
            }
        });

        collector.on('end', async () => {
            await mensajePanel.edit({ components: [] }).catch(() => {});
        });
    },
};
