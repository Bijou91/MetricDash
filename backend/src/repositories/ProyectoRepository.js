const pool = require('../db/pool');

// Un proyecto está activo si pertenece al periodo académico activo (ER: academic_periods.is_active).
async function obtenerActivo(proyectoId) {
  const { rows } = await pool.query(
    `SELECT p.* FROM monitored_projects p
       JOIN academic_periods a ON a.id = p.period_id
      WHERE p.id = $1 AND a.is_active = true`,
    [proyectoId],
  );
  return rows[0] ?? null;
}

module.exports = { obtenerActivo };
