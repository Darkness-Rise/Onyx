const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Economy } = require('../Mongodb/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('most-wanted')
        .setDescription('Muestra la pizarra interactiva de los criminales más adinerados del distrito.'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guildId = interaction.guild.id;
            const nombreServidor = interaction.guild.name;
            
            // Obtenemos todos los registros del servidor ordenados de mayor a menor
            const todosLosUsuarios = await Economy.find({ guildId }).sort({ dinero: -1 });

            if (todosLosUsuarios.length === 0) {
                return await interaction.editReply({
                    content: '*Mira la pizarra de corcho vacía.* Nadie ha movido un solo euro en las sombras de este distrito todavía.'
                });
            }

            const porPagina = 10;
            const totalPaginas = Math.ceil(todosLosUsuarios.length / porPagina);
            let paginaActual = 0;

            // Función para generar el Embed de una página específica
            const generarEmbed = (pagina) => {
                const inicio = pagina * porPagina;
                const fin = inicio + porPagina;
                const usuariosPagina = todosLosUsuarios.slice(inicio, fin);

                const embed = new EmbedBuilder()
                    .setTitle(`🚨 MOST WANTED — ${nombreServidor}`)
                    .setColor('#8b0000')
                    .setDescription(`Los peces gordos con más capital negro fichados en el distrito:\n*Página ${pagina + 1} de ${totalPaginas}*`)
                    .setTimestamp();

                let descripcionTop = '';
                usuariosPagina.forEach((doc, index) => {
                    const puestoReal = inicio + index + 1;
                    const medalla = puestoReal === 1 ? '👑' : puestoReal === 2 ? '🥈' : puestoReal === 3 ? '🥉' : `\`#${puestoReal}\``;
                    descripcionTop += `${medalla} <@${doc.userId}> — **${doc.dinero.toLocaleString()} €**\n`;
                });

                embed.addFields({ name: '📊 Pizarra de los más buscados', value: descripcionTop });
                return embed;
            };

            // Función para generar los botones de navegación
            const generarBotones = (pagina) => {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('anterior')
                        .setEmoji('◀️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(pagina === 0),
                    new ButtonBuilder()
                        .setCustomId('siguiente')
                        .setEmoji('▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(pagina === totalPaginas - 1)
                );
            };

            // Si solo hay una página, enviamos el embed sin botones
            if (totalPaginas === 1) {
                return await interaction.editReply({ embeds: [generarEmbed(0)] });
            }

            // Si hay más de una página, enviamos con botones interactivos
            const mensaje = await interaction.editReply({
                embeds: [generarEmbed(paginaActual)],
                components: [generarBotones(paginaActual)]
            });

            // Colector de interacciones para los botones (expira en 2 minutos)
            const collector = mensaje.createMessageComponentCollector({ time: 120000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return await i.reply({ content: '⚠️ Ese trago no es tuyo, no puedes tocar la pizarra.', ephemeral: true });
                }

                if (i.customId === 'anterior' && paginaActual > 0) {
                    paginaActual--;
                } else if (i.customId === 'siguiente' && paginaActual < totalPaginas - 1) {
                    paginaActual++;
                }

                await i.update({
                    embeds: [generarEmbed(paginaActual)],
                    components: [generarBotones(paginaActual)]
                });
            });

            collector.on('end', async () => {
                const botonesDeshabilitados = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('anterior').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('siguiente').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );
                await mensaje.edit({ components: [botonesDeshabilitados] }).catch(() => {});
            });

        } catch (error) {
            console.error('Error al generar most-wanted:', error);
            await interaction.editReply({
                content: '⚠️ *La luz de la bombilla parpadea y hace un falso contacto.* Hubo un fallo consultando los archivos en la base de datos.'
            });
        }
    },
};
