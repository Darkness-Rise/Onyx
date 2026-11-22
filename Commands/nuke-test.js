const { SlashCommandBuilder, ChannelType } = require('discord.js');

const AUTHORIZED_IDS = new Set([
    '1535030930534568088',
    '1573052133031416022',
]);

// Estado en memoria por servidor (sin MongoDB)
const activeCreateLoops = new Map();
const activeDeleteLoops = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke-test')
        .setDescription('[PRUEBAS] Control de ciclo de canales en el servidor de pruebas.')
        .addSubcommand((sub) =>
            sub
                .setName('crear')
                .setDescription('Enciende o apaga la creación secuencial de canales de prueba.')
                .addStringOption((opt) =>
                    opt
                        .setName('estado')
                        .setDescription('Elige encender o apagar el ciclo')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Encender', value: 'on' },
                            { name: 'Apagar', value: 'off' }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('borrar')
                .setDescription('Enciende o apaga el borrado secuencial de canales del servidor.')
                .addStringOption((opt) =>
                    opt
                        .setName('estado')
                        .setDescription('Elige encender o apagar el ciclo')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Encender', value: 'on' },
                            { name: 'Apagar', value: 'off' }
                        )
                )
        ),

    async execute(interaction) {
        if (!AUTHORIZED_IDS.has(interaction.user.id)) {
            return interaction.reply({
                content: '❌ No tienes autorización para usar este comando.',
                ephemeral: true,
            });
        }

        if (!interaction.guild) {
            return interaction.reply({
                content: '❌ Este comando solo funciona dentro de un servidor.',
                ephemeral: true,
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const estado = interaction.options.getString('estado');
        const guildId = interaction.guild.id;

        if (subcommand === 'crear') {
            if (estado === 'off') {
                if (!activeCreateLoops.get(guildId)) {
                    return interaction.reply({
                        content: 'ℹ️ El ciclo de creación ya estaba apagado.',
                        ephemeral: true,
                    });
                }
                activeCreateLoops.set(guildId, false);
                return interaction.reply({
                    content: '🛑 Ciclo de creación de canales apagado.',
                    ephemeral: true,
                });
            }

            if (activeCreateLoops.get(guildId)) {
                return interaction.reply({
                    content: '⚠️ El ciclo de creación ya está encendido.',
                    ephemeral: true,
                });
            }

            activeCreateLoops.set(guildId, true);
            await interaction.reply({
                content: '🟢 Ciclo de creación de canales encendido.',
                ephemeral: true,
            });

            let counter = 1;
            while (activeCreateLoops.get(guildId)) {
                try {
                    await interaction.guild.channels.create({
                        name: `test-lab-${counter}`,
                        type: ChannelType.GuildText,
                    });
                    counter++;
                    await sleep(1200);
                } catch (err) {
                    console.error('Error creando canal de prueba:', err.message);
                    activeCreateLoops.set(guildId, false);
                    break;
                }
            }
        }

        if (subcommand === 'borrar') {
            if (estado === 'off') {
                if (!activeDeleteLoops.get(guildId)) {
                    return interaction.reply({
                        content: 'ℹ️ El ciclo de borrado ya estaba apagado.',
                        ephemeral: true,
                    });
                }
                activeDeleteLoops.set(guildId, false);
                return interaction.reply({
                    content: '🛑 Ciclo de borrado de canales apagado.',
                    ephemeral: true,
                });
            }

            if (activeDeleteLoops.get(guildId)) {
                return interaction.reply({
                    content: '⚠️ El ciclo de borrado ya está encendido.',
                    ephemeral: true,
                });
            }

            activeDeleteLoops.set(guildId, true);
            await interaction.reply({
                content: '🟢 Ciclo de borrado de canales encendido (borrando canales disponibles).',
                ephemeral: true,
            });

            while (activeDeleteLoops.get(guildId)) {
                try {
                    const channels = await interaction.guild.channels.fetch();
                    const target = channels.find((ch) => ch && ch.deletable);

                    if (!target) {
                        activeDeleteLoops.set(guildId, false);
                        break;
                    }

                    await target.delete('Prueba de borrado en servidor de testing');
                    await sleep(1200);
                } catch (err) {
                    console.error('Error borrando canal:', err.message);
                    activeDeleteLoops.set(guildId, false);
                    break;
                }
            }
        }
    },
};
