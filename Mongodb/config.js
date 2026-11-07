const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    modRolesIds: { type: [String], default: [] }, // Lista de IDs de roles con permisos de admin/mod del bot
    canalLogsId: { type: String, default: null }
});

module.exports = mongoose.model('ConfigServidor', configSchema);
