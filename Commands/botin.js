const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { obtenerBalance } = require('../Mongodb/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botin')
        .setDescription('Gestión de fondos y capital negro en Fallen Ash Realm (FAR).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // Subcomando: PESTAÑA (Status)
        .addSubcommand(subcommand =>
            subcommand
                .setName('pestaña')
                .setDescription('Revisa los Euros (€) en la pestaña de un cliente.')
                .addUserOption(option => 
                    option.setName('cliente')
                        .setDescription('Cliente a auditar (opcional)')
                        .setRequired(false)
                )
        )
        
        // Subcomando: INYECTAR (Add - Admin)
        .addSubcommand(subcommand =>
            subcommand
                .setName('inyectar')
                .setDescription('[ADMIN] Inyecta capital en Euros (€) a un cliente.')
                .addUserOption(option => 
                    option.setName('cliente')
                        .setDescription('Cliente que recibe los fondos')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option.setName('cantidad')
                        .setDescription('Cantidad en Euros (€) a sumar')
                        .setRequired(true)
                )
        )
        
        // Subcomando: COBRAR (Remove - Admin)
        .addSubcommand(subcommand =>
            subcommand
                .setName('cobrar')
                .setDescription('[ADMIN] Pasa a cobrar y retira Euros (€) a un cliente.')
                .addUserOption(option => 
                    option.setName('cliente')
                        .setDescription('Cliente al que se le confiscará el dinero')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option.setName('cantidad')
                        .setDescription('Cantidad en Euros (€) a restar')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // --- SEGURIDAD PARA INYECTAR / COBRAR ---
        if ((subcommand === 'inyectar' || subcommand === 'cobrar') && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '*Pule la barra con un trapo sucio y te mira de reojo.* Las cuentas gordas solo las mueven los jefes.',
                ephemeral: true
            });
        }

        // --- PESTAÑA (Status) ---
        if (subcommand === 'pestaña') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('cliente') || interaction.user;
            
            const cuenta = await obtenerBalance(targetUser.id, guildId);

            const embed = new EmbedBuilder()
                .setTitle('🥃 Pestaña en el Bajo Mundo — FAR')
                .setColor('#1a1a1a')
                .setDescription(`*Consulta el registro clandestino.* Balance de <@${targetUser.id}>:`)
                .addFields(
                    { name: 'Efectivo en mano', value: `**${cuenta.dinero.toLocaleString()} €**`, inline: true }
                )
                .setTimestamp();

            return await interaction.editReply({ embeds: [embed] });
        }

        // --- INYECTAR (Add) ---
        else if (subcommand === 'inyectar') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('cliente');
            const cantidad = interaction.options.getInteger('cantidad');

            if (cantidad <= 0) {
                return await interaction.editReply({ content: '⚠️ No puedes mover una cifra menor o igual a cero.' });
            }

            let cuenta = await obtenerBalance(targetUser.id, guildId);
            cuenta.dinero += cantidad;
            await cuenta.save();

            await interaction.editReply({
                content: `*Empuja un maletín sobre la mesa.* Se han inyectado **${cantidad.toLocaleString()} €** al balance de <@${targetUser.id}>. Total actual: **${cuenta.dinero.toLocaleString()} €**.`
            });
        }

        // --- COBRAR (Remove) ---
        else if (subcommand === 'cobrar') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('cliente');
            const cantidad = interaction.options.getInteger('cantidad');

            if (cantidad <= 0) {
                return await interaction.editReply({ content: '⚠️ La cantidad a recortar debe ser mayor a 0.' });
            }

            let cuenta = await obtenerBalance(targetUser.id, guildId);
            cuenta.dinero = Math.max(0, cuenta.dinero - cantidad);
            await cuenta.save();

            await interaction.editReply({
                content: `*Se guarda la parte correspondiente en el chaleco.* Se han cobrado **${cantidad.toLocaleString()} €** a <@${targetUser.id}>. Capital restante: **${cuenta.dinero.toLocaleString()} €**.`
            });
        }
    },
};
