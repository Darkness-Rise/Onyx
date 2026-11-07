const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { consultarOpenRouter } = require('../Services/openrouter');

module.exports = {
    adminOnly: true, // Protegido por tu sistema de roles de mod/admin globales
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('[ADMIN] Ejecuta y expulsa a un elemento indeseable del distrito con estilo.')
        .addUserOption(option =>
            option.setName('objetivo')
                .setDescription('El usuario que va a recibir la ejecución/expulsión')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Razón de la expulsión')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        await interaction.deferReply();

        const objetivo = interaction.options.getUser('objetivo');
        const motivo = interaction.options.getString('motivo') || 'Violación de los protocolos del distrito.';
        const miembro = await interaction.guild.members.fetch(objetivo.id).catch(() => null);
        const nombreServidor = interaction.guild.name;

        // Validaciones básicas
        if (!miembro) {
            return await interaction.editReply({ content: '⚠️ No encuentro a ese individuo en los registros del servidor.', ephemeral: true });
        }

        if (!miembro.kickable) {
            return await interaction.editReply({ content: '❌ Mis rangos no tienen suficiente jerarquía para expulsar a este objetivo (es inmune o superior).', ephemeral: true });
        }

        try {
            // 1. Prompt dinámico tomando el nombre real del servidor y manteniendo la vibra de gángster
            const promptIA = `Genera una única frase corta, fría, intimidante y de gángster (máximo 15 palabras) dirigida a un traidor o desertor al que van a ejecutar y echar del distrito en ${nombreServidor}. No pongas comillas ni explicaciones, solo la frase.`;
            
            let dialogoFrio = await consultarOpenRouter(promptIA, interaction.user.id);
            // Limpieza de comillas por si la IA las incluye
            dialogoFrio = dialogoFrio ? dialogoFrio.replace(/["«»]/g, '').trim() : "Se acabó el juego para ti.";

            // 2. Cinemática de ejecución inmersiva
            const embedEjecucion = new EmbedBuilder()
                .setTitle('⚖️ EJECUCIÓN Y EXPULSIÓN DEL DISTRITO')
                .setColor('#8b0000') // Tono rojo sangre / oscuro
                .setDescription(
                    `> *«${dialogoFrio}»* — **Onyx**\n\n` +
                    `*Da un paso al frente con su gabardina oscura, recarga el carro de su arma con un chasquido metálico, apunta directo a la cabeza de <@${objetivo.id}> y aprieta el gatillo sin vacilar.*\n\n` +
                    `💥 **[PACTO ROTO]** El objetivo ha sido limpiado de las calles de ${nombreServidor}.\n` +
                    `📋 **Razón:** \`${motivo}\``
                )
                .setTimestamp();

            // 3. Ejecución real del baneo/kick en Discord
            await miembro.kick(motivo);

            // 4. Envío del reporte final al canal
            await interaction.editReply({ embeds: [embedEjecucion] });

        } catch (error) {
            console.error('Error al ejecutar el comando /kick:', error);
            await interaction.editReply({ 
                content: '*Cruza los brazos con molestia.* Hubo una falla en el mecanismo de ejecución. El objetivo se salvó por ahora.', 
                ephemeral: true 
            });
        }
    },
};
