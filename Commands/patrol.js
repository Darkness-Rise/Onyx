const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { 
    obtenerConfigServidor, 
    guardarConfigServidor, 
    escanearPatrullasDB, 
    limpiarPatrullasDB 
} = require('../Services/Mongodb/patrol_log');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('patrol')
        .setDescription('Sistema de patrullaje autónomo de Onyx respaldado en MongoDB.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Subcomando: SET
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Añade uno o varios canales a la ruta de patrullaje.')
                .addChannelOption(option => option.setName('canal_1').setDescription('Primer canal').setRequired(true))
                .addChannelOption(option => option.setName('canal_2').setDescription('Segundo canal opcional').setRequired(false))
                .addChannelOption(option => option.setName('canal_3').setDescription('Tercer canal opcional').setRequired(false))
        )
        // Subcomando: UNSET
        .addSubcommand(subcommand =>
            subcommand
                .setName('unset')
                .setDescription('Remueve un canal de la lista de patrullaje.')
                .addChannelOption(option => option.setName('canal').setDescription('Canal a retirar').setRequired(true))
        )
        // Subcomando: LOG (Muestra canales activos y últimas acciones)
        .addSubcommand(subcommand =>
            subcommand
                .setName('log')
                .setDescription('Muestra el estado actual y los últimos registros de patrulla en MongoDB.')
        )
        // Subcomando: CLEAN (Limpia los registros innecesarios)
        .addSubcommand(subcommand =>
            subcommand
                .setName('clean')
                .setDescription('Elimina el historial de patrullaje antiguo y resetea contadores.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        
        let configDoc = await obtenerConfigServidor(guildId);
        let canalesMap = configDoc.canales; // Es un Map de Mongoose

        // --- SUBCOMANDO: SET ---
        if (subcommand === 'set') {
            const canalesNuevos = [
                interaction.options.getChannel('canal_1'),
                interaction.options.getChannel('canal_2'),
                interaction.options.getChannel('canal_3')
            ].filter(Boolean);

            let agregados = [];

            for (const canal of canalesNuevos) {
                if (canal.type !== 0) continue; // Solo texto

                if (!canalesMap.has(canal.id)) {
                    canalesMap.set(canal.id, 0);
                    agregados.push(`<#${canal.id}>`);
                }
            }

            await guardarConfigServidor(guildId, canalesMap);

            if (agregados.length === 0) {
                return await interaction.editReply({
                    content: 'Los canales seleccionados ya estaban en la ruta de patrulla o no son válidos.'
                });
            }

            await interaction.editReply({
                content: `*Ajusta sus guantes tácticos con firmeza.* Perímetro ampliado en MongoDB. Nuevos puntos: ${agregados.join(', ')}.`
            });
        }

        // --- SUBCOMANDO: UNSET ---
        else if (subcommand === 'unset') {
            const canalAQuitar = interaction.options.getChannel('canal');

            if (!canalesMap.has(canalAQuitar.id)) {
                return await interaction.editReply({
                    content: `Ese canal no se encuentra registrado en el sistema de patrullaje.`
                });
            }

            canalesMap.delete(canalAQuitar.id);
            await guardarConfigServidor(guildId, canalesMap);

            await interaction.editReply({
                content: `*Retira la mirada del mapa táctico.* Canal <#${canalAQuitar.id}> removido de la base de datos.`
            });
        }

        // --- SUBCOMANDO: LOG ---
        else if (subcommand === 'log') {
            if (canalesMap.size === 0) {
                return await interaction.editReply({
                    content: '*Cruza los brazos con seriedad.* No hay ningún canal asignado para patrullar actualmente.'
                });
            }

            const ultimosLogs = await escanearPatrullasDB(guildId, 5); // Últimas 5 acciones

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Registro de Patrullaje Táctico (MongoDB)')
                .setColor('#2b2d31')
                .setDescription('Estado actual y actividad reciente del cártel:')
                .setTimestamp();

            let descripcionCanales = '';
            for (const [canalId, contador] of canalesMap.entries()) {
                descripcionCanales += `• <#${canalId}> — **${contador}** patrullajes realizados\n`;
            }
            embed.addFields({ name: 'Canales Activos', value: descripcionCanales });

            if (ultimosLogs.length > 0) {
                let textoLogs = '';
                for (const log of ultimosLogs) {
                    const hora = new Date(log.timestamp).toLocaleTimeString();
                    textoLogs += `\`[${hora}] <#${log.channelId}>\`: ${log.actionText}\n`;
                }
                embed.addFields({ name: 'Ultimas Acciones Registradas', value: textoLogs });
            }

            await interaction.editReply({ embeds: [embed] });
        }

        // --- SUBCOMANDO: CLEAN ---
        else if (subcommand === 'clean') {
            const borrados = await limpiarPatrullasDB(guildId);
            await interaction.editReply({
                content: `*Limpia el historial del servidor.* Se han purgado **${borrados}** registros antiguos de la base de datos y reseteado los contadores.`
            });
        }
    },
};
