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
        .setName('unsetpatrol')
        .setDescription('Desactiva el sistema de patrullaje autónomo de Onyx en este servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const config = leerConfig();

        if (!config[guildId]) {
            return await interaction.reply({
                content: '*Revisa su arma sin inmutarse.* Este servidor no tenía ninguna patrulla activa.',
                ephemeral: true
            });
        }

        // Eliminar el registro del servidor actual
        delete config[guildId];
        guardarConfig(config);

        await interaction.reply({
            content: '*Asiente levemente y guarda silencio.* Patrullaje autónomo desactivado. Operaciones de ronda detenidas en este servidor.',
            ephemeral: false
        });
    },
};
