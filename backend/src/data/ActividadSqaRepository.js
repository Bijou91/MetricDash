const pool = require('./pool');
const {
  ActividadSQA,
  ESTADO_DB_A_DOMINIO,
  normalizarFechaISO,
} = require('../services/entidades/actividadSqa');

const ESTADO_DOMINIO_A_DB = Object.freeze({
  PLANIFICADA: 'PLANNED',
  PLANNED: 'PLANNED',
  EN_CURSO: 'IN_PROGRESS',
  IN_PROGRESS: 'IN_PROGRESS',
  REALIZADA: 'DONE',
  DONE: 'DONE',
});

const FASE_A_NUMERO_CORTE = Object.freeze({
  ANALISIS_REQUERIMIENTOS: 1,
  DISENO_COMPONENTES: 2,
  CONSTRUCCION_SOFTWARE: 3,
  INTEGRACION_Y_PRUEBAS: 4,
});

function mapRow(r) {
  return new ActividadSQA({
    id: r.id,
    proyectoId: r.project_id,
    nombre: r.title,
    categoria: r.category,
    fase: r.phase,
    practicaIso: r.iso_practice_ref,
    rolResponsable: r.responsible_role,
    artefacto: r.artifact_name,
    tipoArtefacto: r.artifact_type,
    responsableId: r.responsible_id,
    responsableNombre: r.responsable_nombre || null,
    autorId: r.author_id,
    autorNombre: r.autor_nombre || null,
    revisoresIds: r.reviewer_ids || [],
    fechaPlanificada: r.planned_date,
    fechaEjecucion: r.execution_date,
    estado: ESTADO_DB_A_DOMINIO[r.status] || r.status,
    evidenciaUrl: r.evidence_url,
    evidenciaRef: r.evidence_ref || r.evidence_url,
    actaId: r.review_id || null,
    dictamenActa: r.review_verdict || null,
  });
}

// FN-01: Obtiene todas las actividades SQA del plan base del proyecto con sus responsables, autores y actas.
async function obtenerPlan(proyectoId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT sa.*,
            resp.member_name AS responsable_nombre,
            aut.member_name AS autor_nombre,
            pr.id AS review_id,
            pr.verdict AS review_verdict
       FROM sqa_activities sa
       LEFT JOIN project_members resp ON resp.id = sa.responsible_id
       LEFT JOIN project_members aut ON aut.id = sa.author_id
       LEFT JOIN peer_reviews pr ON pr.activity_id = sa.id
      WHERE sa.project_id = $1
      ORDER BY CASE sa.phase
        WHEN 'ANALISIS_REQUERIMIENTOS' THEN 1
        WHEN 'DISENO_COMPONENTES' THEN 2
        WHEN 'CONSTRUCCION_SOFTWARE' THEN 3
        WHEN 'INTEGRACION_Y_PRUEBAS' THEN 4
        ELSE 5
      END, sa.created_at ASC, sa.title ASC`,
    [proyectoId],
  );
  return rows.map(mapRow);
}

// Obtiene una actividad SQA por su identificador.
async function obtenerPorId(actividadId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT sa.*,
            resp.member_name AS responsable_nombre,
            aut.member_name AS autor_nombre,
            pr.id AS review_id,
            pr.verdict AS review_verdict
       FROM sqa_activities sa
       LEFT JOIN project_members resp ON resp.id = sa.responsible_id
       LEFT JOIN project_members aut ON aut.id = sa.author_id
       LEFT JOIN peer_reviews pr ON pr.activity_id = sa.id
      WHERE sa.id = $1`,
    [actividadId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

// FN-03: Guarda la planificación de la actividad (responsable, fecha, artefacto, tipoArtefacto, autor y revisores).
async function guardarPlanificacion(actividad, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const statusDb = ESTADO_DOMINIO_A_DB[actividad.estado] || 'PLANNED';
  const { rows } = await client.query(
    `UPDATE sqa_activities
        SET responsible_id = $1,
            planned_date = $2,
            artifact_name = $3,
            artifact_type = $4,
            author_id = $5,
            reviewer_ids = $6,
            status = $7
      WHERE id = $8
      RETURNING *`,
    [
      actividad.responsableId,
      actividad.fechaPlanificada,
      actividad.artefacto,
      actividad.tipoArtefacto,
      actividad.autorId || null,
      actividad.revisoresIds || [],
      statusDb,
      actividad.id,
    ],
  );
  return rows[0] ? mapRow(rows[0]) : actividad;
}

// Cambia estado a EN_CURSO al iniciar la ejecución (FN-04).
async function marcarEnCurso(actividadId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  await client.query(
    `UPDATE sqa_activities
        SET status = CASE WHEN status = 'DONE' THEN 'DONE' ELSE 'IN_PROGRESS' END
      WHERE id = $1`,
    [actividadId],
  );
}

// FN-08 / FA-04.01: Marca la actividad como realizada con su evidencia y fecha de ejecución.
async function marcarRealizada(actividad, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const evidencia = actividad.evidenciaRef || actividad.evidenciaUrl || null;
  const fechaEjec = actividad.fechaEjecucion || normalizarFechaISO(new Date());
  const { rows } = await client.query(
    `UPDATE sqa_activities
        SET status = 'DONE',
            execution_date = COALESCE($1::date, CURRENT_DATE),
            evidence_url = COALESCE($2, evidence_url),
            evidence_ref = COALESCE($2, evidence_ref)
      WHERE id = $3
      RETURNING *`,
    [fechaEjec, evidencia, actividad.id],
  );
  const actGuardada = rows[0] ? mapRow(rows[0]) : actividad;

  // Sincronizar contadores por fase en evaluation_cutoffs si estamos en conexión real
  if (rows[0]) {
    const proyectoId = rows[0].project_id;
    const fase = rows[0].phase;
    const cutoffNumber = FASE_A_NUMERO_CORTE[fase] || 1;
    const { rows: [conteoFase] } = await client.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status IN ('DONE', 'REALIZADA'))::int AS ejecutadas
         FROM sqa_activities
        WHERE project_id = $1 AND phase = $2`,
      [proyectoId, fase],
    );
    await client.query(
      `UPDATE evaluation_cutoffs
          SET planned_sqa_acts = $3,
              executed_sqa_acts = $4
        WHERE project_id = $1 AND cutoff_number = $2`,
      [proyectoId, cutoffNumber, conteoFase?.total ?? 0, conteoFase?.ejecutadas ?? 0],
    );
  }

  return actGuardada;
}

// Cuando el dictamen de una revisión por pares es RECHAZADO, la actividad permanece EN_CURSO (IN_PROGRESS)
// con su acta vinculada para que deba volver a ejecutarse tras el retrabajo del autor.
async function marcarEnRetrabajo(actividad, evidencia, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `UPDATE sqa_activities
        SET status = 'IN_PROGRESS',
            evidence_url = COALESCE($1, evidence_url),
            evidence_ref = COALESCE($1, evidence_ref)
      WHERE id = $2
      RETURNING *`,
    [evidencia, actividad.id],
  );
  const actGuardada = rows[0] ? mapRow(rows[0]) : actividad;
  if (rows[0]) {
    const proyectoId = rows[0].project_id;
    const fase = rows[0].phase;
    const cutoffNumber = FASE_A_NUMERO_CORTE[fase] || 1;
    const { rows: [conteoFase] } = await client.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status IN ('DONE', 'REALIZADA'))::int AS ejecutadas
         FROM sqa_activities
        WHERE project_id = $1 AND phase = $2`,
      [proyectoId, fase],
    );
    await client.query(
      `UPDATE evaluation_cutoffs
          SET planned_sqa_acts = $3,
              executed_sqa_acts = $4
        WHERE project_id = $1 AND cutoff_number = $2`,
      [proyectoId, cutoffNumber, conteoFase?.total ?? 0, conteoFase?.ejecutadas ?? 0],
    );
  }
  return actGuardada;
}

// FN-08: Cuenta el total de actividades exigibles del plan base del proyecto.
async function contarExigibles(proyectoId, _fecha = new Date(), tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT count(*)::int AS n
       FROM sqa_activities
      WHERE project_id = $1`,
    [proyectoId],
  );
  return rows[0]?.n ?? 0;
}

// Cuenta las actividades totales y realizadas de una fase específica del proyecto (para el corte correspondiente).
async function contarPorFase(proyectoId, fase, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status IN ('DONE', 'REALIZADA'))::int AS realizadas
       FROM sqa_activities
      WHERE project_id = $1 AND phase = $2`,
    [proyectoId, fase],
  );
  return {
    total: rows[0]?.total ?? 0,
    realizadas: rows[0]?.realizadas ?? 0,
  };
}

// FN-08: Cuenta las actividades SQA realizadas en el proyecto.
async function contarRealizadas(proyectoId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT count(*)::int AS n
       FROM sqa_activities
      WHERE project_id = $1
        AND status IN ('DONE', 'REALIZADA')`,
    [proyectoId],
  );
  return rows[0]?.n ?? 0;
}

module.exports = {
  obtenerPlan,
  obtenerPorId,
  guardarPlanificacion,
  marcarEnCurso,
  marcarRealizada,
  marcarEnRetrabajo,
  contarExigibles,
  contarRealizadas,
  contarPorFase,
};

