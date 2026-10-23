const fetch = require('node-fetch');

async function consultarIA(promptUsuario) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return "*Ajusta su máscara en silencio.* Las comunicaciones fallan, jefe: falta configurar la llave de la IA.";
    }

    const url = "https://openrouter.ai/api/v1/chat/completions";
    const maxIntentos = 3;
    let intento = 0;

    while (intento < maxIntentos) {
        try {
            intento++;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/onyx-bot", // Opcional para OpenRouter
                    "X-Title": "Onyx Bot FAR"
                },
                body: JSON.stringify({
                    model: "deepseek/deepseek-chat", // O el modelo que prefieras usar
                    messages: [
                        {
                            role: "system",
                            content: "Eres Onyx, el ejecutor silencioso, frío y calculador de la mafia Fallen Ash Realm (FAR). Respondes de forma breve, intimidante y leal al jefe."
                        },
                        {
                            role: "content",
                            content: promptUsuario
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error) {
            console.error(`⚠️ [IA Warning]: Intento ${intento} fallido:`, error.message);
            if (intento >= maxIntentos) {
                return "*Ajusta su máscara en silencio, analizando la situación con frialdad.* - Las comunicaciones fallan, jefe. Repítame la orden.";
            }
            // Esperar 2 segundos antes de reintentar
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

module.exports = { consultarIA };
