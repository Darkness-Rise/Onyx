const { AsyncQueue } = require('@sapphire/async-queue');

// Instancias separadas para no bloquear procesos distintos entre sí
const colaIA = new AsyncQueue();
const colaEconomia = new AsyncQueue();
const colaComandos = new AsyncQueue();

/**
 * Encapsula la ejecución de una función asíncrona dentro de una cola.
 * Garantiza que siempre se libere el turno (.shift()) incluso si la tarea falla.
 * 
 * @param {AsyncQueue} queue - La instancia de AsyncQueue a utilizar.
 * @param {Function} task - La función asíncrona a ejecutar.
 * @returns {Promise<any>} El resultado de la función task.
 */
async function ejecutarEnCola(queue, task) {
    await queue.wait();
    try {
        return await task();
    } finally {
        queue.shift();
    }
}

module.exports = {
    colaIA,
    colaEconomia,
    colaComandos,
    ejecutarEnCola
};
