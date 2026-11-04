const mongoose = require('mongoose');

const patrolConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    canales: { type: Map, of: Number, default: {} } // { channelId: contador }
});

const patrolLogEntrySchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    actionText: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const PatrolConfig = mongoose.model('PatrolConfig', patrolConfigSchema);
const PatrolLogEntry = mongoose.model('PatrolLogEntry', patrolLogEntrySchema);

// --- Funciones de Configuración de Canales ---
async function obtenerConfigServidor(guildId) {
    let config = await PatrolConfig.findOne({ guildId });
    if (!config) {
        config = new PatrolConfig({ guildId, canales: {} });
        await config.save();
    }
    return config;
}

async function guardarConfigServidor(guildId, canalesMap) {
    await PatrolConfig.findOneAndUpdate(
        { guildId },
        { canales: canalesMap },
        { upsert: true, new: true }
    );
}

// --- Funciones de Historial (Logs de Patrulla) ---
async function registrarPatrullaDB(guildId, channelId, actionText) {
    try {
        const nuevaPatrulla = new PatrolLogEntry({ guildId, channelId, actionText });
        await nuevaPatrulla.save();
        
        // Incrementar el contador en la config del servidor
        const config = await obtenerConfigServidor(guildId);
        const actual = config.canales.get(channelId) || 0;
        config.canales.set(channelId, actual + 1);
        await config.save();
    } catch (error) {
        console.error("Error al registrar patrulla en MongoDB:", error);
    }
}

async function escanearPatrullasDB(guildId, limite = 10) {
    try {
        return await PatrolLogEntry.find({ guildId })
            .sort({ timestamp: -1 })
            .limit(limite);
    } catch (error) {
        console.error("Error al escanear patrullas:", error);
        return [];
    }
}

async function limpiarPatrullasDB(guildId) {
    try {
        const resultado = await PatrolLogEntry.deleteMany({ guildId });
        // Opcional: resetear contadores en la config si deseas
        const config = await obtenerConfigServidor(guildId);
        for (const channelId of config.canales.keys()) {
            config.canales.set(channelId, 0);
        }
        await config.save();
        return resultado.deletedCount;
    } catch (error) {
        console.error("Error al limpiar patrullas:", error);
        return 0;
    }
}

module.exports = {
    obtenerConfigServidor,
    guardarConfigServidor,
    registrarPatrullaDB,
    escanearPatrullasDB,
    limpiarPatrullasDB
};
