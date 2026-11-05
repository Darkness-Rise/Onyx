const mongoose = require('mongoose');

const economySchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    dinero: { type: Number, default: 100, min: 0 },
    ultimoImpuesto: { type: Date, default: Date.now } // Control de tiempo para la cuota de protección
});

economySchema.index({ userId: 1, guildId: 1 }, { unique: true });

// Esquema para los objetos del Mercado Negro (Tienda) con control de stock
const itemTiendaSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    nombre: { type: String, required: true },
    descripcion: { type: String, required: true },
    precio: { type: Number, required: true, min: 1 },
    stock: { type: Number, required: true, default: 1, min: 0 }, // Cantidad disponible en stock
    roleId: { type: String, default: null } // Opcional: ID del rol de Discord que otorga al comprarlo
});

const Economy = mongoose.model('Economy', economySchema);
const ItemTienda = mongoose.model('ItemTienda', itemTiendaSchema);

async function obtenerBalance(userId, guildId) {
    return await Economy.findOneAndUpdate(
        { userId, guildId },
        { $setOnInsert: { dinero: 100, ultimoImpuesto: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

async function obtenerMasBuscados(guildId, limite = 10) {
    return await Economy.find({ guildId }).sort({ dinero: -1 }).limit(limite);
}

/**
 * Aplica el impuesto de protección del 2% a los usuarios del servidor
 * (Diseñado para ejecutarse periódicamente o mediante un comando cron/intervalo).
 */
async function cobrarImpuestosServidor(guildId) {
    const ahora = new Date();
    // 7 días en milisegundos (1 semana)
    const unaSemana = 7 * 24 * 60 * 60 * 1000; 

    // Buscamos cuentas que no hayan pagado impuesto en los últimos 7 días
    const cuentas = await Economy.find({ guildId, ultimoImpuesto: { $lte: new Date(ahora.getTime() - unaSemana) } });

    let recaudadoTotal = 0;
    for (const cuenta of cuentas) {
        if (cuenta.dinero > 0) {
            const impuesto = Math.ceil(cuenta.dinero * 0.02); // 2% redondeado hacia arriba
            cuenta.dinero = Math.max(0, cuenta.dinero - impuesto);
            cuenta.ultimoImpuesto = ahora;
            recaudadoTotal += impuesto;
            await cuenta.save();
        }
    }
    return recaudadoTotal;
}

module.exports = {
    Economy,
    ItemTienda,
    obtenerBalance,
    obtenerMasBuscados,
    cobrarImpuestosServidor
};
