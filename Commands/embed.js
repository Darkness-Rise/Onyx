const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Crea un embed personalizado con orden estructurado.')
        .addStringOption(option =>
            option.setName('titulo')
                .setDescription('Título principal del embed (máx. 256 caracteres)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('descripcion')
                .setDescription('Texto o contenido principal del embed (máx. 4096 caracteres)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Color en formato Hex (ej. #0099ff)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('remitente')
                .setDescription('Nombre personalizado para el Autor (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('foto_remitente')
                .setDescription('URL de imagen personalizada para el Autor (opcional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('imagen')
                .setDescription('URL de la imagen grande para el embed')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('footer')
                .setDescription('Texto pequeño que aparece al pie de página')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true }); // Ocultamos la confirmación inicial por seguridad

        const titulo = interaction.options.getString('titulo');
        const descripcion = interaction.options.getString('descripcion');
        const colorInput = interaction.options.getString('color') || '#2b2d31';
        
        // Validaciones de límites de Discord
        if (titulo.length > 256) {
            return await interaction.editReply({ content: '⚠️ *El tintero se desborda.* El título no puede superar los 256 caracteres.' });
        }
        if (descripcion.length > 4096) {
            return await interaction.editReply({ content: '⚠️ *El pergamino es demasiado largo.* La descripción no puede superar los 4096 caracteres.' });
        }

        // Validación estricta de formato Hex para el color
        const hexRegex = /^#([0-9A-F]{3}){1,2}$/i;
        const colorFinal = hexRegex.test(colorInput) ? colorInput : '#2b2d31';

        const nombreRemitente = interaction.options.getString('remitente') || interaction.user.globalName || interaction.user.username;
        const fotoRemitente = interaction.options.getString('foto_remitente') || interaction.user.displayAvatarURL({ dynamic: true });

        const imagenUrl = interaction.options.getString('imagen');
        const footerTexto = interaction.options.getString('footer');

        try {
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: nombreRemitente,
                    iconURL: fotoRemitente
                })
                .setTitle(titulo)
                .setDescription(descripcion)
                .setColor(colorFinal)
                .setTimestamp();

            if (imagenUrl) {
                embed.setImage(imagenUrl);
            }

            if (footerTexto) {
                embed.setFooter({ 
                    text: footerTexto, 
                    iconURL: interaction.user.displayAvatarURL() 
                });
            }

            // Enviamos el embed al canal público y damos aviso efímero de éxito
            await interaction.channel.send({ embeds: [embed] });
            await interaction.editReply({ content: '✨ *El documento ha sido sellado y publicado con éxito en el mostrador.*' });

        } catch (error) {
            console.error('Error al generar el embed personalizado:', error);
            await interaction.editReply({ content: '⚠️ *La pluma se rompe contra el papel.* Asegúrate de que las URLs de las imágenes sean válidas.' });
        }
    },
};
