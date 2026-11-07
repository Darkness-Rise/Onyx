const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    modRolesIds: { type: [String], default: [] }, // Lista de IDs de roles con permisos de admin/mod del bot
    canalLogsId: { type: String, default: null },
    // Nuevo campo: Diccionario de canales permitidos por comando (ej. { tienda: ["id_canal_dark_market"] })
    canalesComandos: {
        tienda: { type: [String], default: [] },
        botin: { type: [String], default: [] }
    }
});

module.exports = mongoose.model('ConfigServidor', configSchema);
