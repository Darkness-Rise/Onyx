const { obtenerPromptSistema } = require('../Config/personality');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function consultarOpenRouter(prompt, userId) {
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const systemPrompt = obtenerPromptSistema(userId);

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://github.com/Darkness-Rise/Onyx", 
            "X-Title": "Onyx Bot",             
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "google/gemini-2.5-flash",
            "max_tokens": 500,
            "messages": [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": prompt }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("Respuesta completa de OpenRouter:", JSON.stringify(data));

    let textoRespuesta = data.choices?.[0]?.message?.content;

    if (!textoRespuesta || textoRespuesta.trim() === "") {
        const respaldos = [
            "*Asiente en silencio y ajusta con calma las correas de su equipo táctico.* Comandante, la señal oscila un momento.",
            "*Da un trago pausado a su vaso de vino añejado y te mira fijamente.* Lo escucho, jefe, adelante.",
            "*Revisa el cierre de sus guantes tácticos con total seriedad.* Las comunicaciones satelitales fluctúan, comandante.",
            "*Inclina levemente la cabeza en señal de respeto.* Estoy a la espera de sus órdenes directas, jefe."
        ];
        textoRespuesta = respaldos[Math.floor(Math.random() * respaldos.length)];
    }

    return textoRespuesta;
}

module.exports = { consultarOpenRouter };
