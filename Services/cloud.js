const mongoose = require('mongoose');

const conectarDB = async () => {
    try {
        // Asegúrate de tener MONGODB_URI en tu archivo .env
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('📦 Conectado exitosamente a la base de datos en la nube (MongoDB).');
    } catch (error) {
        console.error('❌ Error al conectar a MongoDB:', error);
        process.exit(1); // Sale del proceso si la base de datos falla al iniciar
    }
};

// --- FUNCIÓN DE PURGA GLOBAL POR GUILDID ---
async function purgaGlobalServidor(guildId) {
    try {
        const db = mongoose.connection.db;
        // Obtiene todas las colecciones activas en la base de datos
        const collections = await db.listCollections().toArray();
        
        let totalBorrados = 0;

        for (const colInfo of collections) {
            const collectionName = colInfo.name;
            // Omitir colecciones internas del sistema
            if (collectionName.startsWith('system.')) continue;

            // Borra de forma masiva todos los documentos que tengan este guildId en cualquier colección
            const resultado = await db.collection(collectionName).deleteMany({ guildId: guildId });
            
            if (resultado.deletedCount > 0) {
                console.log(`[BARRIDO] Se eliminaron ${resultado.deletedCount} registros de la colección '${collectionName}' para el servidor ${guildId}`);
                totalBorrados += resultado.deletedCount;
            }
        }

        console.log(`[DB] Protocolo de purga global completado. Total de documentos eliminados: ${totalBorrados} para el servidor ID: ${guildId}`);
    } catch (error) {
        console.error(`Error crítico en la purga global del servidor ${guildId}:`, error);
    }
}

module.exports = { conectarDB, purgaGlobalServidor };
