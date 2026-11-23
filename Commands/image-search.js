const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
      .setName('imagen')
      .setDescription('Busca una imagen en Google y la muestra.')
      .addStringOption(option => 
          option.setName('busqueda')
            .setDescription('Lo que quieres buscar')
            .setRequired(true)),
            
    async execute(interaction) {
        await interaction.deferReply();
        const query = interaction.options.getString('busqueda');

        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_CX;
        
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=1`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                return interaction.editReply("*Ajusta los visores.* No encontré ningún resultado para esa búsqueda, colega.");
            }

            const imageUrl = data.items[0].link;

            // Envía la imagen directamente al canal de Discord
            await interaction.editReply({ content: `Resultado para: **${query}**`, files: [imageUrl] });
        } catch (error) {
            console.error("Error al buscar la imagen:", error);
            await interaction.editReply("*Se trabó el sistema.* Hubo un fallo al conectar con el buscador.");
        }
    }
};
