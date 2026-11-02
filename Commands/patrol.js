const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const rutaConfig = path.join(__dirname, '../Config/canales.json');

// Función auxiliar para leer la config
function leerConfig() {
    if (!fs.existsSync(rutaConfig)) return {};
    try {
        return JSON.parse(fs.readFileSync(rutaConfig, 'utf8'));
    } catch (e) {
        return {};
    }
}

// Función auxiliar para guardar la config
function guardarConfig(data) {
    fs.writeFileSync(rutaConfig, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('patrol')
        .setDescription('Sistema de patrullaje autónomo de Onyx.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Subcomando: SET (Añadir uno o más canales)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Añade uno o varios canales a la ruta de patrullaje.')
                .addChannelOption(option =>
                    option.setName('canal_1')
                        .setDescription('Primer canal de patrulla')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('canal_2')
                        .setDescription('Segundo canal opcional')
                        .setRequired(false))
                .addChannelOption(option =>
                    option.setName('canal_3')
                        .setDescription('Tercer canal opcional')
                        .setRequired(false))
        )
        // Subcomando: UNSET (Quitar canales específicos)
        .addSubcommand(subcommand =>
            subcommand
                .setName('unset')
                .setDescription('Remueve un canal de la lista de patrullaje.')
                .addChannelOption(option =>
                    option.setName('canal')
                        .setDescription('El canal que deseas retirar de las rondas')
                        .setRequired(true))
        )
        // Subcomando: LOG (Ver canales activos y contadores)
        .addSubcommand(subcommand =>
            subcommand
                .setName('log')
                .setDescription('Muestra el estado actual y los registros de patrullaje.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        let config = leerConfig();

        // Asegurar la estructura para el servidor actual
        if (!config[guildId]) {
            config[guildId] = { canales: {} }; // Estructura: { idCanal: contadorPatrullajes }
        }

        // --- SUBCOMANDO: SET ---
        if (subcommand === 'set') {
            const canalesNuevos = [
                interaction.options.getChannel('canal_1'),
                interaction.options.getChannel('canal_2'),
                interaction.options.getChannel('canal_3')
            ].filter(Boolean); // Filtra los que no se hayan seleccionado

            let agregados = [];

            for (const canal of canalesNuevos) {
                if (canal.type !== 0) continue; // Solo canales de texto (GuildText = 0)

                if (!config[guildId].canales[canal.id]) {
                    config[guildId].canales[canal.id] = 0; // Inicializa el contador en 0 si es nuevo
                    agregados.push(`<#${canal.id}>`);
                }
            }

            guardarConfig(config);

            if (agregados.length === 0) {
                return await interaction.reply({
                    content: 'Los canales seleccionados ya estaban en la ruta de patrulla o no son canales de texto válidos.',
                    ephemeral: true
                });
            }

            await interaction.reply({
                content: `*Ajusta sus guantes tácticos con firmeza.* Perímetro ampliado. Nuevos puntos añadidos a la ruta: ${agregados.join(', ')}.`,
                ephemeral: false
            });
        }

        // --- SUBCOMANDO: UNSET ---
        else if (subcommand === 'unset') {
            const canalAQuitar = interaction.options.getChannel('canal');

            if (!config[guildId].canales[canalAQuitar.id]) {
                return await interaction.reply({
                    content: `Ese canal no se encuentra registrado en el sistema de patrullaje.`,
                    ephemeral: true
                });
            }

            delete config[guildId].canales[canalAQuitar.id];
            guardarConfig(config);

            await interaction.reply({
                content: `*Retira la mirada del mapa táctico.* Canal <#${canalAQuitar.id}> removido de las rondas de vigilancia.`,
                ephemeral: false
            });
        }

        // --- SUBCOMANDO: LOG ---
        else if (subcommand === 'log') {
            const canalesMap = config[guildId].canales;
            const listaCanalesIds = Object.keys(canalesMap);

            if (listaCanalesIds.length === 0) {
                return await interaction.reply({
                    content: '*Cruza los brazos con seriedad.* No hay ningún canal asignado para patrullar actualmente en este servidor.',
                    ephemeral: true
                });
            }

            // Construimos un Embed ordenado con los datos y contadores
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Registro de Patrullaje Táctico')
                .setColor('#2b2d31')
                .setDescription('Estado actual de los perímetros bajo vigilancia de Onyx:')
                .setTimestamp();

            let descripcionCampos = '';
            for (const canalId of listaCanalesIds) {
                const contador = canalesMap[canalId];
                descripcionCampos += `• <#${canalId}> — **${contador}** patrullajes realizados\n`;
            }

            embed.addFields({ name: 'Canales Activos', value: descripcionCampos });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
