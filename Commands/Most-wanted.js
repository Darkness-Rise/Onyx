const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { obtenerMasBuscados } = require('../Mongodb/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('most-wanted')
        .setDescription('Muestra la pizarra de los criminales más adinerados de Fallen Ash Realm.'),

    async execute(interaction) {
        await interaction.deferReply();

        const guildId = interaction.guild.id;
        const topUsuarios = await obtenerMasBuscados(guildId, 10);

        if (topUsuarios.length === 0) {
            return await interaction.editReply({
                content: '*Mira la pizarra de corcho vacía.* Nadie ha movido un solo euro en las sombras de FAR todavía.'
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🚨 MOST WANTED — Fallen Ash Realm')
            .setColor('#8b0000') // Rojo sangre / mafia
            .setDescription('Los peces gordos con más capital negro fichados en el distrito:')
            .setTimestamp();

        let descripcionTop = '';
        topUsuarios.forEach((doc, index) => {
            const medalla = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
            descripcionTop += `${medalla} <@${doc.userId}> — **${doc.dinero.toLocaleString()} €**\n`;
        });

        embed.addFields({ name: '📊 Pizarra de los más buscados', value: descripcionTop });

        await interaction.editReply({ embeds: [embed] });
    },
};
