const mongoose = require('mongoose');

// Esquema de economía vinculado al servidor (guildId)
const economySchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true 
    },
    guildId: { 
        type: String, 
        required: true // Clave para que tu función de purga global lo detecte y limpie si hace falta
    },
    dinero: { 
        type: Number, 
        default: 100 // Bono inicial de 100 €
    }
});

// Índice compuesto: un usuario solo tiene un registro de dinero por servidor
economySchema.index({ userId: 1, guildId: 1 }, { unique: true });

const Economy = mongoose.model('Economy', economySchema);

/**
 * Obtiene o crea el balance del usuario en un servidor específico.
 */
async function obtenerBalance(userId, guildId) {
    let cuenta = await Economy.findOne({ userId, guildId });
    if (!cuenta) {
        cuenta = await Economy.create({ userId, guildId, dinero: 100 });
    }
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
