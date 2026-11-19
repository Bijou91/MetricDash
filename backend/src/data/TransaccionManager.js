const pool = require('./pool');
const { ErrorValidacion } = require('../services/entidades/proyecto');

class ErrorPersistencia extends Error {}

// FE-01: cualquier fallo dentro de la operación hace ROLLBACK y se reporta como ErrorPersistencia.
// CU-08 FE-02: un ErrorValidacion es una regla de negocio y se propaga sin convertir.
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
    if (err instanceof ErrorValidacion) throw err;
    console.error('[TransaccionManager]', err);
    throw new ErrorPersistencia('No se pudo guardar la información. Intente de nuevo.');
  } finally {
    tx?.release();
  }
}

// CU-08 FN-05: ejecuta la operación y siempre hace ROLLBACK (simulación sin persistir).
async function simular(operacion) {
  let tx;
  try {
    tx = await pool.connect();
    await tx.query('BEGIN');
    return await operacion(tx);
  } catch (err) {
    if (err instanceof ErrorValidacion) throw err;
    console.error('[TransaccionManager] simulación', err);
    throw new ErrorPersistencia('No se pudo calcular el resumen. Intente de nuevo.');
  } finally {
    if (tx) {
      await rollback(tx);
      tx.release();
    }
  }
}

async function rollback(tx) {
  try {
    await tx.query('ROLLBACK');
  } catch (err) {
    console.error('[TransaccionManager] rollback falló', err);
  }
}

module.exports = { ejecutar, ejecutarEnTransaccion: ejecutar, simular, rollback, ErrorPersistencia };
