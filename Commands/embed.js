const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Crea un embed personalizado con orden estructurado.')
        .addStringOption(option =>
            option.setName('titulo')
                .setDescription('Título principal del embed')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('descripcion')
                .setDescription('Texto o contenido principal del embed')
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
        // 1. Capturamos los datos
        const titulo = interaction.options.getString('titulo');
        const descripcion = interaction.options.getString('descripcion');
        const colorInput = interaction.options.getString('color') || '#2b2d31'; // Color por defecto
        
        // Autor / Remitente (automático de quien envía o personalizado)
        const nombreRemitente = interaction.options.getString('remitente') || interaction.user.globalName || interaction.user.username;
        const fotoRemitente = interaction.options.getString('foto_remitente') || interaction.user.displayAvatarURL({ dynamic: true });

        const imagenUrl = interaction.options.getString('imagen');
        const footerTexto = interaction.options.getString('footer');

        // 2. Construimos el Embed respetando el orden visual exacto:
        const embed = new EmbedBuilder();

        // [1] AUTOR (Arriba del todo)
        embed.setAuthor({
            name: nombreRemitente,
            iconURL: fotoRemitente
        });

        // [2] TÍTULO y [3] DESCRIPCIÓN
        embed.setTitle(titulo)
             .setDescription(descripcion);

        // [4] IMAGEN
        if (imagenUrl) {
            embed.setImage(imagenUrl);
        }

        // [5] COLOR
        embed.setColor(colorInput);

        // [6] FOOTER
        if (footerTexto) {
            embed.setFooter({ 
                text: footerTexto, 
                iconURL: interaction.user.displayAvatarURL() 
            });
        }

        // [7] HORA (Timestamp global adaptado a la zona horaria del lector en Discord)
        embed.setTimestamp();

        // 3. Enviamos el resultado
        await interaction.reply({ embeds: [embed] });
    },
};
