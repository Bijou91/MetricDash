const pool = require('./pool');
const { TipoMetrica } = require('../services/entidades/metricas');

async function obtenerPosiblesCausas(proyectoId, tipoMetrica, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const causas = [];

  if (tipoMetrica === TipoMetrica.DENSIDAD_DEFECTOS) {
    // CU-03: defectos con estado distinto de CERRADO o DESCARTADO, con los críticos primero
    const { rows } = await client.query(
      `SELECT d.id, d.folio, d.title, d.severity, d.priority, d.status, d.detection_phase,
              pm.member_name as asignado_nombre
         FROM defects d
         JOIN evaluation_cutoffs ec ON ec.id = d.cutoff_id
         LEFT JOIN project_members pm ON pm.id = d.assigned_to
        WHERE ec.project_id = $1
          AND d.status NOT IN ('CERRADO', 'DESCARTADO')
        ORDER BY CASE d.severity
                   WHEN 'CRITICA' THEN 1
                   WHEN 'ALTA' THEN 2
                   WHEN 'MEDIA' THEN 3
                   ELSE 4
                 END ASC,
                 d.created_at DESC`,
      [proyectoId],
    );

    for (const d of rows) {
      causas.push({
        tipo: 'DEFECTO',
        id: d.id,
        folio: d.folio,
        titulo: d.title,
        severidad: d.severity,
        prioridad: d.priority,
        estado: d.status,
        fase: d.detection_phase,
        asignadoA: d.asignado_nombre || 'Sin asignar',
        descripcion: `${d.folio} [${d.severity}]: ${d.title} (Estado: ${d.status}, Asignado: ${d.asignado_nombre || 'Sin asignar'})`,
      });
    }
  } else if (tipoMetrica === TipoMetrica.COBERTURA_PRUEBAS || tipoMetrica === TipoMetrica.TASA_EXITO_PRUEBAS) {
    // CU-05: pruebas fallidas o no ejecutadas de la ronda de resultados más reciente
    const { rows } = await client.query(
      `SELECT ts.*
         FROM test_suites ts
         JOIN evaluation_cutoffs ec ON ec.id = ts.cutoff_id
        WHERE ec.project_id = $1
        ORDER BY ts.executed_at DESC
        LIMIT 1`,
      [proyectoId],
    );

    if (rows.length > 0) {
      const r = rows[0];
      const noEjecutadas = Math.max(0, Number(r.planned_cases) - Number(r.executed_cases));
      const fallidas = Number(r.failed_cases);

      if (fallidas > 0) {
        causas.push({
          tipo: 'PRUEBAS_FALLIDAS',
          id: r.id,
          descripcion: `${fallidas} prueba(s) fallida(s) en la ronda ${r.version} (tasa de éxito: ${r.pass_rate_pct}%).`,
          cantidad: fallidas,
          version: r.version,
        });
      }
      if (noEjecutadas > 0) {
        causas.push({
          tipo: 'PRUEBAS_NO_EJECUTADAS',
          id: r.id,
          descripcion: `${noEjecutadas} prueba(s) no ejecutada(s) de ${r.planned_cases} planificadas en la versión ${r.version} (cobertura: ${r.coverage_pct}%).`,
          cantidad: noEjecutadas,
          version: r.version,
        });
      }
      if (fallidas === 0 && noEjecutadas === 0) {
        causas.push({
          tipo: 'PRUEBAS_RECIENTES',
          id: r.id,
          descripcion: `Ronda ${r.version}: ${r.executed_cases} ejecutadas, cobertura ${r.coverage_pct}%, tasa de éxito ${r.pass_rate_pct}%.`,
          version: r.version,
        });
      }
    }
  } else if (tipoMetrica === TipoMetrica.CUMPLIMIENTO_SQA) {
    // CU-04: actividades exigibles aún no realizadas
    const { rows } = await client.query(
      `SELECT sa.id, sa.title, sa.phase, sa.category, sa.responsible_role, sa.status, sa.planned_date
         FROM sqa_activities sa
        WHERE sa.project_id = $1
          AND sa.status NOT IN ('DONE', 'REALIZADA')
        ORDER BY sa.planned_date ASC NULLS LAST, sa.created_at ASC`,
      [proyectoId],
    );

    for (const a of rows) {
      causas.push({
        tipo: 'ACTIVIDAD_SQA',
        id: a.id,
        titulo: a.title,
        fase: a.phase,
        categoria: a.category,
        rolResponsable: a.responsible_role,
        estado: a.status,
        fechaPlanificada: a.planned_date,
        descripcion: `Actividad SQA "${a.title}" [${a.phase}] pendiente (Estado: ${a.status}, Responsable: ${a.responsible_role}).`,
      });
    }
  }

  return causas;
}

module.exports = {
  obtenerPosiblesCausas,
};

