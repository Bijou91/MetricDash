const pool = require('../data/pool');
const { ErrorPersistencia } = require('../domain/errors');

class GestorTransacciones {
  constructor(customPool = pool) {
    this.pool = customPool;
    this.conexionActiva = false;
  }

  async iniciarTransaccion() {
    try {
      const client = await this.pool.connect();
      await client.query('BEGIN');
      this.conexionActiva = true;
      return { client };
    } catch (err) {
      throw new ErrorPersistencia('No se pudo iniciar la transacción en base de datos', 'BEGIN_TRANSACTION', err);
    }
  }

  async confirmarTransaccion(tx) {
    if (!tx || !tx.client) return;
    try {
      await tx.client.query('COMMIT');
    } catch (err) {
      throw new ErrorPersistencia('Error al confirmar la transacción', 'COMMIT_TRANSACTION', err);
    } finally {
      this.conexionActiva = false;
      tx.client.release();
    }
  }

  async revertirTransaccion(tx) {
    if (!tx || !tx.client) return;
    try {
      await tx.client.query('ROLLBACK');
    } catch (err) {
      console.error('[GestorTransacciones] Error durante ROLLBACK:', err.message);
    } finally {
      this.conexionActiva = false;
      try {
        tx.client.release();
      } catch (e) {
        // Ignorar si ya fue liberado
      }
    }
  }
}

module.exports = GestorTransacciones;
