const pool = require('./pool');
const { RondaPruebas } = require('../services/entidades/pruebas');

function aRonda(r) {
  return new RondaPruebas({
    id: r.id,
    corteId: r.cutoff_id,
    version: r.version,
    pruebasPlaneadas: Number(r.planned_cases),
    pruebasEjecutadas: Number(r.executed_cases),
    pruebasExitosas: Number(r.passed_cases),
    pruebasFallidas: Number(r.failed_cases),
    notaExplicativa: r.explanatory_note,
    registradoEn: r.executed_at,
  });
}

// FN-06: Inserta una nueva ronda de pruebas en test_suites dentro de la transacción activa.
async function guardar(ronda, tx = pool) {
  const cobertura = ronda.calcularCobertura();
  const tasaExito = ronda.calcularTasaExito();
  const { rows } = await tx.query(
    `INSERT INTO test_suites
       (cutoff_id, version, planned_cases, executed_cases, passed_cases, failed_cases, coverage_pct, pass_rate_pct, explanatory_note, executed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     RETURNING *`,
    [
      ronda.corteId,
      ronda.version || 'CP1-Baseline',
      ronda.pruebasPlaneadas,
      ronda.pruebasEjecutadas,
      ronda.pruebasExitosas,
      ronda.pruebasFallidas,
      cobertura,
      tasaExito,
      ronda.notaExplicativa,
    ],
  );
  const fila = rows[0];
  ronda.id = fila.id;
  ronda.registradoEn = fila.executed_at;
  return ronda;
}

// Lista el historial de rondas de pruebas del proyecto (para mostrar en el tablero o seleccionar en CU-04 / CU-06).
async function listarPorProyecto(proyectoId, tx = pool) {
  const { rows } = await tx.query(
    `SELECT ts.*, ec.cutoff_name, ec.cutoff_number
       FROM test_suites ts
       JOIN evaluation_cutoffs ec ON ec.id = ts.cutoff_id
      WHERE ec.project_id = $1
      ORDER BY ts.executed_at DESC`,
    [proyectoId],
  );
  return rows.map((r) => ({
    ...aRonda(r),
    coberturaPruebas: Number(r.coverage_pct),
    tasaExitoPruebas: Number(r.pass_rate_pct),
    nombreCorte: r.cutoff_name,
    numeroCorte: r.cutoff_number,
  }));
}

module.exports = { guardar, listarPorProyecto };

