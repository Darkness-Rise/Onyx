const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
        .setName('setpatrol')
        .setDescription('Define el canal donde Onyx hará sus rondas y patrullaje autónomo.')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('El canal de texto para las patrullas')
                .setRequired(true)
        )
        // Opcional: restringir que solo administradores puedan usarlo
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const canalSeleccionado = interaction.options.getChannel('canal');
        const guildId = interaction.guild.id;

        // Validar que sea un canal de texto
        if (canalSeleccionado.type !== 0) { // 0 es GuildText
            return await interaction.reply({ 
                content: 'Las patrullas solo pueden asignarse en canales de texto.', 
                ephemeral: true 
            });
        }

        const config = leerConfig();
        config[guildId] = canalSeleccionado.id;
        guardarConfig(config);

        await interaction.reply({
            content: `*Ajusta sus guantes tácticos y asiente con frialdad.* Canal de patrullaje asignado a <#${canalSeleccionado.id}>. Mantendré el perímetro vigilado.`,
            ephemeral: false
        });
    },
};
