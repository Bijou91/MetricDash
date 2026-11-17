const pool = require('./pool');
const { ActaRevision } = require('../services/entidades/actividadSqa');

// FN-08: Persiste el registro de la revisión por pares en peer_reviews.
async function guardarRevision(revision, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `INSERT INTO peer_reviews
       (activity_id, work_product, author_id, reviewer_ids, review_date, reviewer_role, verdict, checklist_results)
     VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6, $7, $8::jsonb)
     ON CONFLICT (activity_id) DO UPDATE
       SET work_product = EXCLUDED.work_product,
           author_id = EXCLUDED.author_id,
           reviewer_ids = EXCLUDED.reviewer_ids,
           review_date = EXCLUDED.review_date,
           reviewer_role = EXCLUDED.reviewer_role,
           verdict = EXCLUDED.verdict,
           checklist_results = EXCLUDED.checklist_results
     RETURNING *`,
    [
      revision.actividadId,
      revision.tipoArtefacto || 'VISION',
      revision.autorId || null,
      revision.revisoresIds || [],
      revision.fechaRevision || null,
      revision.rolRevisor || 'QA',
      revision.dictamen || 'APROBADO',
      JSON.stringify(revision.resultados || []),
    ],
  );
  if (rows[0]) {
    revision.id = rows[0].id;
  }
  return revision;
}

// FN-08b: Actualiza el acta formal emitida (resumen de hallazgos, folios de defectos, dictamen y URL del acta)
// y vincula los defectos generados a la revisión (defects.review_id).
async function guardarActa(acta, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const minutesUrl = acta.minutesUrl || `acta://peer-review/${acta.actividadId}`;
  const { rows } = await client.query(
    `UPDATE peer_reviews
        SET verdict = COALESCE($1, verdict),
            findings_summary = $2,
            defect_folios = $3,
            minutes_url = $4
      WHERE activity_id = $5
      RETURNING *`,
    [
      acta.dictamen,
      acta.resumenHallazgos,
      acta.foliosDefectos || [],
      minutesUrl,
      acta.actividadId,
    ],
  );
  if (rows[0]) {
    acta.id = rows[0].id;
    acta.revisionId = rows[0].id;
    acta.minutesUrl = rows[0].minutes_url;
    if (Array.isArray(acta.defectosIds) && acta.defectosIds.length > 0) {
      await client.query(
        'UPDATE defects SET review_id = $1 WHERE id = ANY($2::uuid[])',
        [rows[0].id, acta.defectosIds],
      );
    }
  }
  return acta;
}

// Consulta el acta de revisión emitida para una actividad SQA.
async function obtenerActaPorActividad(actividadId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT pr.*,
            sa.title AS activity_title,
            sa.phase AS activity_phase,
            sa.artifact_name,
            aut.member_name AS author_name,
            resp.member_name AS responsible_name
       FROM peer_reviews pr
       JOIN sqa_activities sa ON sa.id = pr.activity_id
       LEFT JOIN project_members aut ON aut.id = pr.author_id
       LEFT JOIN project_members resp ON resp.id = sa.responsible_id
      WHERE pr.activity_id = $1`,
    [actividadId],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  const resultados = Array.isArray(r.checklist_results) ? r.checklist_results : [];
  const itemsNoCumple = resultados.filter((it) => it && it.cumple === false).length;
  return new ActaRevision({
    id: r.id,
    actividadId: r.activity_id,
    revisionId: r.id,
    fechaEmision: r.review_date,
    dictamen: r.verdict,
    resumenHallazgos: r.findings_summary,
    foliosDefectos: r.defect_folios || [],
    minutesUrl: r.minutes_url,
    totalItems: resultados.length,
    itemsCumple: resultados.length - itemsNoCumple,
    itemsNoCumple,
  });
}

module.exports = {
  guardarRevision,
  guardarActa,
  obtenerActaPorActividad,
};

