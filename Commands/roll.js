const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Lanza un dado (por defecto de 6 caras).')
        .addIntegerOption(option =>
            option.setName('caras')
                .setDescription('Número de caras del dado (ej. 20)')
                .setRequired(false)),
    async execute(interaction) {
        // Obtenemos el número de caras (si no se pone nada, por defecto es 6)
        const caras = interaction.options.getInteger('caras') ?? 6;

        if (caras <= 1) {
            return await interaction.reply({ content: 'El dado debe tener al menos 2 caras.', ephemeral: true });
        }

        // Generamos un número aleatorio entre 1 y el número de caras
        const resultado = Math.floor(Math.random() * caras) + 1;

        await interaction.reply(`🎲 Has tirado un dado de ${caras} caras y salió: **${resultado}**`);
    },
};
