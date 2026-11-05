const mongoose = require('mongoose');

const economySchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true,
        index: true 
    },
    guildId: { 
        type: String, 
        required: true,
        index: true 
    },
    dinero: { 
        type: Number, 
        default: 100, 
        min: 0 // Blindaje total: el dinero nunca baja de 0
    }
});

// Índice compuesto único por usuario y servidor
economySchema.index({ userId: 1, guildId: 1 }, { unique: true });

const Economy = mongoose.model('Economy', economySchema);

/**
 * Obtiene o crea el balance del usuario en un servidor específico de forma atómica.
 */
async function obtenerBalance(userId, guildId) {
    return await Economy.findOneAndUpdate(
        { userId, guildId },
        { $setOnInsert: { dinero: 100 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

/**
 * Obtiene el ranking de "Los más buscados" de un servidor específico.
 */
async function obtenerMasBuscados(guildId, limite = 10) {
    return await Economy.find({ guildId })
        .sort({ dinero: -1 })
        .limit(limite);
}

module.exports = {
    Economy,
    obtenerBalance,
    obtenerMasBuscados
};
