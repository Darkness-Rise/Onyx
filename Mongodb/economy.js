const mongoose = require('mongoose');

// Esquema de economía vinculado al servidor (guildId)
const economySchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true,
        index: true // Indexado para búsquedas ultra rápidas por usuario
    },
    guildId: { 
        type: String, 
        required: true,
        index: true // Indexado para que la purga y filtros por servidor vuelen
    },
    dinero: { 
        type: Number, 
        default: 100, // Bono inicial de 100 €
        min: 0        // Seguridad: El dinero jamás puede bajar de 0 por error lógico
    }
});

// Índice compuesto único: un usuario solo tiene un registro por servidor
economySchema.index({ userId: 1, guildId: 1 }, { unique: true });

const Economy = mongoose.model('Economy', economySchema);

/**
 * Obtiene o crea el balance del usuario en un servidor específico de forma atómica.
 * Usa upsert para evitar condiciones de carrera si hay peticiones simultáneas.
 */
async function obtenerBalance(userId, guildId) {
    let cuenta = await Economy.findOneAndUpdate(
        { userId, guildId },
        { $setOnInsert: { dinero: 100 } }, // Si se crea nuevo, arranca con 100 €
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return cuenta;
}

/**
 * Obtiene el ranking de "Los más buscados" de un servidor específico.
 */
async function obtenerMasBuscados(guildId, limite = 10) {
    return await Economy.find({ guildId })
        .sort({ dinero: -1 }) // Ordena de mayor a menor dinero
        .limit(limite);
}

module.exports = {
    Economy,
    obtenerBalance,
    obtenerMasBuscados
};
