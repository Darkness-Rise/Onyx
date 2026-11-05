const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { obtenerBalance, obtenerMasBuscados, Economy } = require('../Mongodb/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bar')
        .setDescription('Sistema financiero y de deudas clandestinas de FAR (Fallen Ash Realm).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        
        // Subcomando: CUENTA (Status)
        .addSubcommand(subcommand =>
            subcommand
                .setName('cuenta')
                .setDescription('Consulta los Euros (€) en la pestaña de un cliente.')
                .addUserOption(option => 
                    option.setName('cliente')
                        .setDescription('Cliente a auditar (opcional)')
                        .setRequired(false)
                )
        )
        
        // Subcomando: PAGAR (Add)
        .addSubcommand(subcommand =>
            subcommand
                .setName('pagar')
                .setDescription('[ADMIN] Añade Euros (€) a la pestaña o bolsillo de un cliente.')
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
        
        // Subcomando: COBRAR (Remove)
        .addSubcommand(subcommand =>
            subcommand
                .setName('cobrar')
                .setDescription('[ADMIN] Retira Euros (€) del bolsillo de un cliente.')
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
        )

        // Subcomando: MOST-WANTED (La pizarra de los más buscados)
        .addSubcommand(subcommand =>
            subcommand
                .setName('most-wanted')
                .setDescription('Muestra la tabla de clasificación "Most Wanted" de Fallen Ash Realm.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // --- VALIDACIÓN DE SEGURIDAD PARA PAGAR / COBRAR ---
        if ((subcommand === 'pagar' || subcommand === 'cobrar') && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '*Apoya un vaso sucio en la barra y te mira con frialdad.* Esa caja fuerte solo la tocan los jefes de FAR.',
                ephemeral: true
            });
        }

        // --- SUBCOMANDO: CUENTA (Status) ---
        if (subcommand === 'cuenta') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('cliente') || interaction.user;
            
            const cuenta = await obtenerBalance(targetUser.id, guildId);

            const embed = new EmbedBuilder()
                .setTitle('🥃 Pestaña en la Barra — FAR')
                .setColor('#1a1a1a')
                .setDescription(`*Revisa el libro de cuentas bajo la luz tenue.* Balance de <@${targetUser.id}>:`)
                .addFields(
                    { name: 'Efectivo en mano', value: `**${cuenta.dinero.toLocaleString()} €**`, inline: true }
                )
                .setTimestamp();

            return await interaction.editReply({ embeds: [embed] });
        }

        // --- SUBCOMANDO: PAGAR (Add) ---
        else if (subcommand === 'pagar') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('cliente');
            const cantidad = interaction.options.getInteger('cantidad');

            if (cantidad <= 0) {
                return await interaction.editReply({ content: '⚠️ No puedes entregar una suma menor o igual a cero.' });
            }

            let cuenta = await obtenerBalance(targetUser.id, guildId);
            cuenta.dinero += cantidad;
            await cuenta.save();

            await interaction.editReply({
                content: `*Desliza unos billetes sobre la caoba.* Se han acreditado **${cantidad.toLocaleString()} €** a la cuenta de <@${targetUser.id}>. Total actual: **${cuenta.dinero.toLocaleString()} €**.`
            });
        }

        // --- SUBCOMANDO: COBRAR (Remove) ---
        else if (subcommand === 'cobrar') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.options.getUser('cliente');
            const cantidad = interaction.options.getInteger('cantidad');

            if (cantidad <= 0) {
                return await interaction.editReply({ content: '⚠️ La cantidad a confiscar debe ser mayor a 0.' });
            }

            let cuenta = await obtenerBalance(targetUser.id, guildId);
            cuenta.dinero = Math.max(0, cuenta.dinero - cantidad);
            await cuenta.save();

            await interaction.editReply({
                content: `*Recoge su parte con severidad.* Se han retirado **${cantidad.toLocaleString()} €** a <@${targetUser.id}>. Capital restante: **${cuenta.dinero.toLocaleString()} €**.`
            });
        }

        // --- SUBCOMANDO: MOST-WANTED (Top) ---
        else if (subcommand === 'most-wanted') {
            await interaction.deferReply();

            const topUsuarios = await obtenerMasBuscados(guildId, 10);

            if (topUsuarios.length === 0) {
                return await interaction.editReply({
                    content: '*Mira la pizarra vacía.* Aún no hay movimientos registrados en las sombras de FAR.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🚨 MOST WANTED — Fallen Ash Realm')
                .setColor('#8b0000') // Rojo sangre mafia
                .setDescription('Los peces gordo y mayores fortunas fichados en el bar:')
                .setTimestamp();

            let descripcionTop = '';
            topUsuarios.forEach((doc, index) => {
                const medalla = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
                descripcionTop += `${medalla} <@${doc.userId}> — **${doc.dinero.toLocaleString()} €**\n`;
            });

            embed.addFields({ name: '📊 Pizarra del Bajo Mundo', value: descripcionTop });

            await interaction.editReply({ embeds: [embed] });
        }
    },
};
