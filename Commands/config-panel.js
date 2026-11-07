const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    RoleSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const ConfigServidor = require('../Mongodb/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('[ADMIN] Abre el panel interactivo de configuración del bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guild.id;
        const guildName = interaction.guild.name;

        // Buscamos o creamos la config inicial del servidor
        let config = await ConfigServidor.findOne({ guildId });
        if (!config) {
            config = await ConfigServidor.create({ guildId, modRolesIds: [] });
        }

        // Función para generar el Embed y los componentes del Panel
        const generarPanel = (currentConfig) => {
            const rolesMencion = currentConfig.modRolesIds.length > 0 
                ? currentConfig.modRolesIds.map(id => `<@&${id}>`).join(', ') 
                : '*Ningún rol asignado todavía*';

            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Panel de Control del Distrito — ${guildName}`)
                .setColor('#2b2d31')
                .setDescription('Gestiona los permisos y accesos especiales del bot en este servidor desde este panel interactivo.')
                .addFields(
                    { name: '🛡️ Roles de Moderadores/Admins del Bot', value: rolesMencion }
                )
                .setTimestamp();

            // Menú desplegable para seleccionar roles de Discord directamente
            const selectRol = new RoleSelectMenuBuilder()
                .setCustomId('config_select_roles')
                .setPlaceholder('👇 Selecciona los roles con permisos de admin...')
                .setMinValues(1)
                .setMaxValues(5); // Permite seleccionar hasta 5 roles a la vez

            const rowSelect = new ActionRowBuilder().addComponents(selectRol);

            // Botón para limpiar/reiciar los roles configurados
            const rowBotones = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('config_limpiar_roles')
                    .setEmoji('🧹')
                    .setLabel('Limpiar Roles')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('config_cerrar')
                    .setEmoji('🔒')
                    .setLabel('Cerrar Panel')
                    .setStyle(ButtonStyle.Secondary)
            );

            return { embeds: [embed], components: [rowSelect, rowBotones] };
        };

        const mensajePanel = await interaction.editReply(generarPanel(config));

        // Colector para manejar las interacciones del panel (expira en 3 minutos)
        const collector = mensajePanel.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return await i.reply({ content: '⚠️ Este panel no te pertenece, abre el tuyo con `/config`.', ephemeral: true });
            }

            // --- CASO 1: SELECCIÓN DE ROLES ---
            if (i.isRoleSelectMenu() && i.customId === 'config_select_roles') {
                await i.deferUpdate();
                const rolesSeleccionados = i.values; // Array de IDs de roles seleccionados

                // Actualizamos en MongoDB (añadimos sin repetir)
                config = await ConfigServidor.findOneAndUpdate(
                    { guildId },
                    { $addToSet: { modRolesIds: { $each: rolesSeleccionados } } },
                    { new: true, upsert: true }
                );

                await i.editReply(generarPanel(config));
            }

            // --- CASO 2: LIMPIAR ROLES ---
            else if (i.isButton() && i.customId === 'config_limpiar_roles') {
                await i.deferUpdate();

                config = await ConfigServidor.findOneAndUpdate(
                    { guildId },
                    { modRolesIds: [] },
                    { new: true }
                );

                await i.editReply(generarPanel(config));
            }

            // --- CASO 3: CERRAR PANEL ---
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
