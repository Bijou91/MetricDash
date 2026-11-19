// Portado del CU-07 (rama implCU07): el reporte de salud se versiona como un corte más en evaluation_cutoffs.

// Bloquea el proyecto: PostgreSQL no admite FOR UPDATE junto con MAX().
async function obtenerSiguienteVersionReporte(proyectoId, tx) {
  await tx.query('SELECT 1 FROM monitored_projects WHERE id = $1 FOR UPDATE', [proyectoId]);
  const { rows } = await tx.query(
    'SELECT COALESCE(MAX(cutoff_number), 0) + 1 AS v FROM evaluation_cutoffs WHERE project_id = $1',
    [proyectoId],
  );
  return Number(rows[0].v);
}

async function guardarCorteReporteSalud(reporte, tx) {
  const { rows } = await tx.query(
    `INSERT INTO evaluation_cutoffs
       (project_id, cutoff_number, cutoff_name, cutoff_date, kloc, planned_sqa_acts, executed_sqa_acts, health_status, notes)
     VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8)
     RETURNING id, cutoff_date`,
    [
      reporte.proyectoId,
      reporte.versionReporte,
      reporte.nombreVersion,
      reporte.klocActual,
      reporte.actividadesPlaneadas,
      reporte.actividadesEjecutadas,
      reporte.estadoSalud,
      reporte.notasEjecutivas,
    ],
  );
  return Object.assign(reporte, { id: rows[0].id, fechaGeneracion: rows[0].cutoff_date });
}

module.exports = { obtenerSiguienteVersionReporte, guardarCorteReporteSalud };
