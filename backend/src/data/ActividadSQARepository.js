const pool = require('./pool');

async function obtenerPorId(actividadId, tx = pool) {
  const { rows } = await tx.query(
    `SELECT a.*,
            p.name as project_name,
            p.period_id,
            ap.code as period_code,
            ap.start_date as period_start_date,
            ap.end_date as period_end_date,
            rm.member_name as responsible_name,
            rm.role as responsible_role_name,
            am.member_name as author_name
       FROM sqa_activities a
       JOIN monitored_projects p ON p.id = a.project_id
       JOIN academic_periods ap ON ap.id = p.period_id
  LEFT JOIN project_members rm ON rm.id = a.responsible_member_id
  LEFT JOIN project_members am ON am.id = a.author_id
      WHERE a.id = $1`,
    [actividadId],
  );
  return rows[0] || null;
}

async function listarPorProyecto(proyectoId, tx = pool) {
  const { rows } = await tx.query(
    `SELECT a.*,
            rm.member_name as responsible_name,
            rm.role as responsible_role_name,
            am.member_name as author_name,
            pr.id as review_id,
            pr.verdict as review_verdict,
            pr.findings_summary as review_findings
       FROM sqa_activities a
  LEFT JOIN project_members rm ON rm.id = a.responsible_member_id
  LEFT JOIN project_members am ON am.id = a.author_id
  LEFT JOIN peer_reviews pr ON pr.activity_id = a.id
      WHERE a.project_id = $1
      ORDER BY a.created_at ASC`,
    [proyectoId],
  );
  return rows;
}

async function guardarPlanificacion(actividadId, datosPlan, tx = pool) {
  const { rows } = await tx.query(
    `UPDATE sqa_activities
        SET planned_date = $1,
            responsible_member_id = $2,
            artifact = $3,
            author_id = $4,
            reviewer_ids = $5::jsonb,
            status = 'PLANNED'
      WHERE id = $6
      RETURNING *`,
    [
      datosPlan.plannedDate,
      datosPlan.responsibleMemberId,
      datosPlan.artifact,
      datosPlan.authorId || null,
      JSON.stringify(datosPlan.reviewerIds || []),
      actividadId,
    ],
  );
  return rows[0] || null;
}

async function marcarEnCurso(actividadId, tx = pool) {
  const { rows } = await tx.query(
    `UPDATE sqa_activities
        SET status = 'IN_PROGRESS'
      WHERE id = $1
      RETURNING *`,
    [actividadId],
  );
  return rows[0] || null;
}

async function marcarRealizada(actividadId, evidenceUrl, tx = pool) {
  const { rows } = await tx.query(
    `UPDATE sqa_activities
        SET status = 'DONE',
            execution_date = CURRENT_DATE,
            evidence_url = $1
      WHERE id = $2
      RETURNING *`,
    [evidenceUrl || null, actividadId],
  );
  return rows[0] || null;
}

// FN-08: Exigibles = cuya fecha planificada ya llegó (planned_date <= CURRENT_DATE) o que ya fueron realizadas (status = 'DONE')
async function obtenerMetricasCumplimiento(proyectoId, tx = pool) {
  const { rows } = await tx.query(
    `SELECT 
       count(*) as total_actividades,
       count(*) FILTER (WHERE status = 'DONE') as realizadas,
       count(*) FILTER (
         WHERE (planned_date IS NOT NULL AND planned_date <= CURRENT_DATE)
            OR status = 'DONE'
       ) as exigibles
     FROM sqa_activities
    WHERE project_id = $1`,
    [proyectoId],
  );

  const fila = rows[0] || {};
  return {
    totalActividades: Number(fila.total_actividades || 0),
    realizadas: Number(fila.realizadas || 0),
    exigibles: Number(fila.exigibles || 0),
  };
}

module.exports = {
  obtenerPorId,
  listarPorProyecto,
  guardarPlanificacion,
  marcarEnCurso,
  marcarRealizada,
  obtenerMetricasCumplimiento,
};
