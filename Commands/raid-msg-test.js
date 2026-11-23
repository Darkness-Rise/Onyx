const { SlashCommandBuilder } = require('discord.js');

const AUTHORIZED_IDS = new Set([
    '1535030930534568088',
    '1573052133031416022',
]);

// Estado en memoria por servidor (sin MongoDB)
const activeMessageRaids = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildPayload(customMessage, modoLongitud, counter) {
    if (customMessage) {
        const suffix = ` [${counter}]`;
        const maxCustomLen = 2000 - suffix.length;
        return `${customMessage.slice(0, Math.max(0, maxCustomLen))}${suffix}`;
    }

    const targetLength = modoLongitud === 'maximo' ? 2000 : 1000;
    const prefix = `[TEST-PAYLOAD #${counter}] `;
    const unit = 'AB12-PRUEBA-CARGA-';
    const body = unit.repeat(Math.ceil((targetLength - prefix.length) / unit.length));

    return `${prefix}${body}`.slice(0, targetLength);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raid-msg-test')
        .setDescription('[PRUEBAS] Enciende o apaga una ráfaga de mensajes de prueba en el canal.')
        .addStringOption((opt) =>
            opt
                .setName('estado')
                .setDescription('Elige encender o apagar la ráfaga de mensajes')
                .setRequired(true)
                .addChoices(
                    { name: 'Encender', value: 'on' },
                    { name: 'Apagar', value: 'off' }
                )
        )
        .addStringOption((opt) =>
            opt
                .setName('mensaje')
                .setDescription('Texto opcional; si queda vacío se genera un bloque largo de prueba')
                .setRequired(false)
        )
        .addStringOption((opt) =>
            opt
                .setName('longitud')
                .setDescription('Tamaño del bloque cuando no escribes mensaje (por defecto: mitad)')
                .setRequired(false)
                .addChoices(
                    { name: 'Mitad (1000 caracteres)', value: 'mitad' },
                    { name: 'Máximo (2000 caracteres)', value: 'maximo' }
                )
        ),

    async execute(interaction) {
        if (!AUTHORIZED_IDS.has(interaction.user.id)) {
            return interaction.reply({
                content: '❌ No tienes autorización para usar este comando.',
                ephemeral: true,
            });
        }

        if (!interaction.guild || !interaction.channel) {
            return interaction.reply({
                content: '❌ Este comando solo funciona dentro de un canal de servidor.',
                ephemeral: true,
            });
        }

        const estado = interaction.options.getString('estado');
        const customMessage = interaction.options.getString('mensaje');
        const modoLongitud = interaction.options.getString('longitud') || 'mitad';
        const guildId = interaction.guild.id;
        const channel = interaction.channel;

        if (estado === 'off') {
            if (!activeMessageRaids.get(guildId)) {
                return interaction.reply({
                    content: 'ℹ️ La ráfaga de mensajes ya estaba apagada.',
                    ephemeral: true,
                });
            }

            activeMessageRaids.set(guildId, false);
            return interaction.reply({
                content: '🛑 Ráfaga de mensajes apagada.',
                ephemeral: true,
            });
        }

        if (activeMessageRaids.get(guildId)) {
            return interaction.reply({
                content: '⚠️ La ráfaga de mensajes ya está encendida.',
                ephemeral: true,
            });
        }

        activeMessageRaids.set(guildId, true);
        const infoModo = customMessage
            ? 'mensaje personalizado'
            : `bloque de ${modoLongitud === 'maximo' ? '2000' : '1000'} caracteres`;

        await interaction.reply({
            content: `🟢 Ráfaga encendida en este canal (${infoModo}).`,
            ephemeral: true,
        });

        let counter = 1;
        while (activeMessageRaids.get(guildId)) {
            try {
                const targetChannel = channel.send ? channel : await interaction.guild.channels.fetch(channel.id);

                if (!targetChannel || typeof targetChannel.send !== 'function') {
                    activeMessageRaids.set(guildId, false);
                    await interaction.followUp({
                        content: '❌ Se detuvo la ráfaga: este canal no permite enviar mensajes.',
                        ephemeral: true,
                    }).catch(() => {});
                    break;
                }

                const text = buildPayload(customMessage, modoLongitud, counter);
                await targetChannel.send(text);
                counter++;
                await sleep(1200);
            } catch (err) {
                console.error('Error enviando mensaje de prueba:', err);
                activeMessageRaids.set(guildId, false);
                await interaction.followUp({
                    content: `❌ Se detuvo la ráfaga por un error: ${err.message}`,
                    ephemeral: true,
                }).catch(() => {});
                break;
            }
        }
    },
};
