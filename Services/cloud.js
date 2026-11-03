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

module.exports = { conectarDB };
