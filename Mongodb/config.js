const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    modRolesIds: { type: [String], default: [] }, // Lista de IDs de roles con permisos de admin/mod del bot
    canalLogsId: { type: String, default: null },
    // Campo dinámico para amarrar cualquier comando a canales específicos (ej. tu Dark-Market)
    restriccionesCanales: [
        {
            comando: { type: String, required: true },
            canalId: { type: String, required: true }
        }
    ]
});

module.exports = mongoose.model('ConfigServidor', configSchema);
