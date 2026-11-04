const { obtenerConfigServidor, registrarPatrullaDB } = require('../Mongodb/patrol_log');
const { consultarOpenRouter } = require('./openrouter');

function iniciarSistemaAutonomo(client) {
    // Estados dinámicos enfocados en patrullaje, vigilancia y consumo sobrio
    const estadosDinamicos = [
        { name: 'vigilando los accesos del cártel', type: 3 }, // Watching
        { name: 'el perímetro en completo silencio', type: 3 }, // Watching
        { name: 'un vaso de bourbon añejo', type: 2 },           // Listening
        { name: 'limpiando el cañón de su rifle', type: 0 },    // Playing
        { name: 'revisando las cámaras de seguridad', type: 3 }, // Watching
        { name: 'la frecuencia de radio del sector', type: 2 },  // Listening
        { name: 'masticando un trozo de carne seca', type: 0 }   // Playing
    ];

    const actualizarPresencia = () => {
        const estadoAleatorio = estadosDinamicos[Math.floor(Math.random() * estadosDinamicos.length)];
        client.user.setPresence({
            activities: [estadoAleatorio],
            status: 'dnd',
        });
    };

    actualizarPresencia();
    setInterval(actualizarPresencia, 30 * 60 * 1000); // Rota cada 30 min

    // Tiempo de patrullaje autónomo: Entre 5 y 30 minutos aleatorios
    const obtenerTiempoAleatorio = () => {
        const minMinutos = 5;
        const maxMinutos = 30;
        return (Math.random() * (maxMinutos - minMinutos) + minMinutos) * 60 * 1000;
    };

    const ejecutarRondas = async () => {
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const configDoc = await obtenerConfigServidor(guildId);
                const canalesMap = configDoc.canales;

                if (!canalesMap || canalesMap.size === 0) continue;

                for (const channelId of canalesMap.keys()) {
                    try {
                        const canal = await guild.channels.fetch(channelId);
                        if (canal) {
                            console.log(`[PATRULLAJE] Ejecutando ronda en ${canal.name} (${guild.name})...`);
                            
                            // VARIABLE DE CONTROL: Probabilidad baja (15%) para mencionar a alguien de forma muy esporádica
                            let miembroMencionadoTexto = "";
                            const probabilidadMencion = Math.random(); // Número entre 0 y 1
                            
                            if (probabilidadMencion < 0.15) { // Solo un 15% de probabilidad por ronda
                                try {
                                    await guild.members.fetch();
                                    const usuariosValidos = guild.members.cache.filter(member => !member.user.bot && member.id !== client.user.id);
                                    
                                    if (usuariosValidos.size > 0) {
                                        const miembroAleatorio = usuariosValidos.random();
                                        miembroMencionadoTexto = ` Dirígete directamente a <@${miembroAleatorio.id}> mencionándolo de la nada para cuestionar brevemente qué anda haciendo o exigirle atención.`;
                                    }
                                } catch (memberErr) {
                                    console.error("No se pudo obtener miembros aleatorios para mención:", memberErr);
                                }
                            }

                            const promptAccion = `Realiza una acción táctica breve (en tercera persona con asteriscos, ej: *apoya la espalda contra la pared, bebe un trago de su cantimplora o recarga su arma*) y acompáñala de una frase corta, cínica y calculadora sobre el estado de la zona.${miembroMencionadoTexto} Mantén una personalidad fría, de ex-militar.`;
                            
                            const accionGenerada = await consultarOpenRouter(promptAccion, `sistema-autonomo-${guildId}`);
                            if (accionGenerada) {
                                await canal.send(accionGenerada);
                                await registrarPatrullaDB(guildId, channelId, accionGenerada);
                                console.log("[PATRULLAJE] ¡Patrulla enviada y registrada con éxito!");
                            }
                        }
                    } catch (err) {
                        console.error(`Error enviando patrulla en canal ${channelId}:`, err);
                    }
                }
            } catch (err) {
                console.error(`Error procesando servidor ${guildId}:`, err);
            }
        }

        setTimeout(ejecutarRondas, obtenerTiempoAleatorio());
    };

    setTimeout(ejecutarRondas, 15000);
}

module.exports = { iniciarSistemaAutonomo };
