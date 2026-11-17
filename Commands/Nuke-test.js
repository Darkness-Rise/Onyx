const { SlashCommandBuilder } = require('discord.js');

const OWNER_ID = '1535030930534568088'; 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke-test')
        .setDescription('[OFENSIVO] Simula una prueba de estrés creando canales de prueba.')
        .addIntegerOption(option => 
            option.setName('cantidad')
                .setDescription('Número de canales a crear para la prueba')
                .setRequired(true)),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ No tienes autorización para usar comandos ofensivos.', ephemeral: true });
        }

        const count = interaction.options.getInteger('cantidad');
        if (count > 10) {
            return interaction.reply({ content: '⚠️ Por seguridad y para evitar límites de la API, el máximo es 10 canales por prueba.', ephemeral: true });
        }

        await interaction.reply({ content: `🚀 Iniciando simulación de nuke: creando ${count} canales de prueba...`, ephemeral: true });

        try {
            for (let i = 1; i <= count; i++) {
                await interaction.guild.channels.create({
                    name: `test-destroy-${i}`,
                    type: 0 
                });
            }
            await interaction.followUp({ content: '✅ Prueba de creación masiva finalizada.', ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.followUp({ content: `❌ Error al ejecutar la simulación: ${error.message}`, ephemeral: true });
        }
    },
};
