const pool = require('../db/pool');
const { ErrorPersistencia } = require('../domain/metricas');

// FE-01: cualquier fallo dentro de la operación hace ROLLBACK y se reporta como ErrorPersistencia.
async function ejecutar(operacion) {
  let tx;
  try {
    tx = await pool.connect();
    await tx.query('BEGIN');
    const resultado = await operacion(tx);
    await tx.query('COMMIT');
    return resultado;
  } catch (err) {
    if (tx) await rollback(tx);
    console.error('[TransaccionManager]', err);
    throw new ErrorPersistencia(err.message || 'No se pudo guardar la información. Intente de nuevo.');
  } finally {
    tx?.release();
  }
}

async function rollback(tx) {
  try {
    await tx.query('ROLLBACK');
  } catch (err) {
    console.error('[TransaccionManager] rollback falló', err);
  }
}

module.exports = { ejecutar, rollback };
