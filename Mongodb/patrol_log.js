const mongoose = require('mongoose');

const patrolConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    canales: { type: Map, of: Number, default: {} }
});

const patrolLogEntrySchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    actionText: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const PatrolConfig = mongoose.model('PatrolConfig', patrolConfigSchema);
const PatrolLogEntry = mongoose.model('PatrolLogEntry', patrolLogEntrySchema);

async function obtenerConfigServidor(guildId) {
    let config = await PatrolConfig.findOne({ guildId });
    if (!config) {
        config = new PatrolConfig({ guildId, canales: {} });
        await config.save();
    }
    return config;
}

async function guardarConfigServidor(guildId, canalesMap) {
    // Convertimos a Map o aseguramos que sea un objeto plano operable
    const mapaCanales = canalesMap instanceof Map ? canalesMap : new Map(Object.entries(canalesMap || {}));
    
    // Si la configuración se guarda con 0 canales o vacía, purgamos automáticamente el historial de patrullas
    if (mapaCanales.size === 0) {
        await PatrolLogEntry.deleteMany({ guildId });
        console.log(`[DB] Canales de patrullaje vacíos para el servidor ${guildId}. Historial purgado automáticamente.`);
    }

    await PatrolConfig.findOneAndUpdate(
        { guildId },
        { canales: mapaCanales },
        { upsert: true, new: true }
    );
}

async function registrarPatrullaDB(guildId, channelId, actionText) {
    try {
        const nuevaPatrulla = new PatrolLogEntry({ guildId, channelId, actionText });
        await nuevaPatrulla.save();
        
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
