// Arranca primero el servidor web para cumplir con el puerto de Render
require('./Config/server.js');

// Arranca inmediatamente después el bot de Discord
require('./index.js');
