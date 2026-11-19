const pool = require('./pool');

async function guardar(review, tx = pool) {
  const { rows } = await tx.query(
    `INSERT INTO peer_reviews (
       id, activity_id, work_product, author_id, review_date,
       reviewer_role, reviewers, verdict, findings_summary, minutes_url, checklist_results
     ) VALUES (
       COALESCE($1, gen_random_uuid()), $2, $3, $4, COALESCE($5, CURRENT_DATE),
       $6, $7::jsonb, $8, $9, $10, $11::jsonb
     )
     ON CONFLICT (activity_id) DO UPDATE SET
       work_product = EXCLUDED.work_product,
       author_id = EXCLUDED.author_id,
       review_date = EXCLUDED.review_date,
       reviewer_role = EXCLUDED.reviewer_role,
       reviewers = EXCLUDED.reviewers,
       verdict = EXCLUDED.verdict,
       findings_summary = EXCLUDED.findings_summary,
       minutes_url = EXCLUDED.minutes_url,
       checklist_results = EXCLUDED.checklist_results
     RETURNING *`,
    [
      review.id || null,
      review.activityId,
      review.workProduct,
      review.authorId || null,
      review.reviewDate || null,
      review.reviewerRole || null,
      JSON.stringify(review.reviewers || []),
      review.verdict,
      review.findingsSummary,
      review.minutesUrl || null,
      JSON.stringify(review.checklistResults || []),
    ],
  );
  return rows[0];
}

async function obtenerPorActividadId(activityId, tx = pool) {
  const { rows } = await tx.query(
    `SELECT pr.*, 
            pm.member_name as author_name,
            pm.role as author_role
       FROM peer_reviews pr
  LEFT JOIN project_members pm ON pm.id = pr.author_id
      WHERE pr.activity_id = $1`,
    [activityId],
  );
  return rows[0] || null;
}

async function obtenerPorId(id, tx = pool) {
  const { rows } = await tx.query(
    `SELECT * FROM peer_reviews WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function listarPorProyecto(proyectoId, tx = pool) {
  const { rows } = await tx.query(
    `SELECT pr.*, sa.title as activity_title, sa.phase as activity_phase
       FROM peer_reviews pr
       JOIN sqa_activities sa ON sa.id = pr.activity_id
      WHERE sa.project_id = $1
      ORDER BY pr.review_date DESC`,
    [proyectoId],
  );
  return rows;
}

module.exports = {
  guardar,
  obtenerPorActividadId,
  obtenerPorId,
  listarPorProyecto,
};
