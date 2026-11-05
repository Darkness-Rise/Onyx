const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { obtenerBalance, Economy } = require('../Mongodb/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botin')
        .setDescription('Gestión de fondos y capital negro en Fallen Ash Realm (FAR).')
        
        // Subcomando: SALDO (Antes pestaña)
        .addSubcommand(subcommand =>
            subcommand
                .setName('saldo')
                .setDescription('Consulta los Euros (€) en tu bolsillo o en la cuenta de un cliente.')
                .addUserOption(option => 
                    option.setName('cliente')
                        .setDescription('Cliente a auditar (opcional)')
                        .setRequired(false)
                )
        )

        // Subcomando: TRANSFER (Nuevo - Para usuarios)
        .addSubcommand(subcommand =>
            subcommand
                .setName('transfer')
                .setDescription('Transfiere Euros (€) de tu bolsillo a otro cliente bajo la mesa.')
                .addUserOption(option => 
                    option.setName('destinatario')
                        .setDescription('El gángster que recibe los fondos')
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option.setName('cantidad')
                        .setDescription('Cantidad en Euros (€) a transferir')
                        .setRequired(true)
                )
        )
        
        // Subcomando: DEBITAR (Antes inyectar - Admin)
        .addSubcommand(subcommand =>
            subcommand
                .setName('debitar')
                .setDescription('[ADMIN] Inyecta o suma capital en Euros (€) a un cliente.')
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
        
        // Subcomando: COBRAR (Admin)
        .addSubcommand(subcommand =>
            subcommand
                .setName('cobrar')
                .setDescription('[ADMIN] Pasa a cobrar y confisca Euros (€) a un cliente.')
                .addUserOption(option => 
                    option.setName('cliente')
                        .setDescription('Cliente al que se le recortará el dinero')
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

        // --- SEGURIDAD DE PERMISOS PARA DEBITAR / COBRAR ---
        if ((subcommand === 'debitar' || subcommand === 'cobrar') && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '*Pule la barra con un trapo sucio y te mira de reojo.* Las cuentas gordas solo las mueven los jefes.',
                ephemeral: true
            });
        }

        try {
            // --- SALDO (Status) ---
            if (subcommand === 'saldo') {
                await interaction.deferReply({ ephemeral: true });
                const targetUser = interaction.options.getUser('cliente') || interaction.user;
                
                if (targetUser.bot) {
                    return await interaction.editReply({ content: '⚠️ Los bots no manejan efectivo en la barra, solo sirven tragos.' });
                }

                const cuenta = await obtenerBalance(targetUser.id, guildId);

                const embed = new EmbedBuilder()
                    .setTitle('🥃 Balance en el Bajo Mundo — FAR')
                    .setColor('#1a1a1a')
                    .setDescription(`*Consulta el registro clandestino.* Fondos de <@${targetUser.id}>:`)
                    .addFields(
                        { name: 'Efectivo en mano', value: `**${cuenta.dinero.toLocaleString()} €**`, inline: true }
                    )
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            // --- TRANSFER (Envío entre usuarios) ---
            else if (subcommand === 'transfer') {
                await interaction.deferReply({ ephemeral: true });
                const emisorUser = interaction.user;
                const receptorUser = interaction.options.getUser('destinatario');
                const cantidad = interaction.options.getInteger('cantidad');

                if (receptorUser.bot) {
                    return await interaction.editReply({ content: '⚠️ No puedes transferirle fondos a un bot.' });
                }

                if (emisorUser.id === receptorUser.id) {
                    return await interaction.editReply({ content: '⚠️ Intentas mover dinero de un bolsillo al otro... qué absurdo. Elige a otra persona.' });
                }

                if (cantidad <= 0) {
                    return await interaction.editReply({ content: '⚠️ La cantidad a transferir debe ser mayor a cero.' });
                }

                // Obtenemos cuentas de ambos
                const cuentaEmisor = await obtenerBalance(emisorUser.id, guildId);

                if (cuentaEmisor.dinero < cantidad) {
                    return await interaction.editReply({
                        content: `*Te revisas los bolsillos y frunces el ceño.* No tienes suficiente efectivo. Tu saldo actual es de **${cuentaEmisor.dinero.toLocaleString()} €**.`
                    });
                }

                const cuentaReceptor = await obtenerBalance(receptorUser.id, guildId);

                // Realizamos la transferencia de forma atómica/segura
                cuentaEmisor.dinero -= cantidad;
                cuentaReceptor.dinero += cantidad;

                await cuentaEmisor.save();
                await cuentaReceptor.save();

                return await interaction.editReply({
                    content: `*Deslizas un sobre con dinero por debajo de la mesa con total sigilo.* Has transferido **${cantidad.toLocaleString()} €** a <@${receptorUser.id}>. Tu saldo restante: **${cuentaEmisor.dinero.toLocaleString()} €**.`
                });
            }

            // --- DEBITAR (Add - Admin) ---
            else if (subcommand === 'debitar') {
                await interaction.deferReply({ ephemeral: true });
                const targetUser = interaction.options.getUser('cliente');
                const cantidad = interaction.options.getInteger('cantidad');

                if (targetUser.bot) {
                    return await interaction.editReply({ content: '⚠️ No puedes debitarle capital a un bot.' });
                }

                if (cantidad <= 0) {
                    return await interaction.editReply({ content: '⚠️ No puedes mover una cifra menor o igual a cero.' });
                }

                let cuenta = await obtenerBalance(targetUser.id, guildId);
                cuenta.dinero += cantidad;
                await cuenta.save();

                await interaction.editReply({
                    content: `*Empuja un maletín sobre la mesa.* Se han debitado y sumado **${cantidad.toLocaleString()} €** al balance de <@${targetUser.id}>. Total actual: **${cuenta.dinero.toLocaleString()} €**.`
                });
            }

            // --- COBRAR (Remove - Admin) ---
            else if (subcommand === 'cobrar') {
                await interaction.deferReply({ ephemeral: true });
                const targetUser = interaction.options.getUser('cliente');
                const cantidad = interaction.options.getInteger('cantidad');

                if (targetUser.bot) {
                    return await interaction.editReply({ content: '⚠️ Los bots no tienen deudas que cobrar.' });
                }

                if (cantidad <= 0) {
                    return await interaction.editReply({ content: '⚠️ La cantidad a recortar debe ser mayor a 0.' });
                }

                let cuenta = await obtenerBalance(targetUser.id, guildId);
                
                cuenta.dinero = Math.max(0, cuenta.dinero - cantidad);
                await cuenta.save();

                await interaction.editReply({
                    content: `*Se guarda la parte correspondiente en el chaleco.* Se han cobrado y retirado **${cantidad.toLocaleString()} €** a <@${targetUser.id}>. Capital restante: **${cuenta.dinero.toLocaleString()} €**.`
                });
            }

        } catch (error) {
            console.error('Error en el comando botin:', error);
            
            const mensajeError = {
                content: '⚠️ *La caja registradora se traba.* Ocurrió un error inesperado al procesar los fondos en la base de datos.',
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(mensajeError).catch(() => {});
            } else {
                await interaction.reply(mensajeError).catch(() => {});
            }
        }
    },
};
