const pool = require('./pool');
const { Defecto, EstadoDefecto } = require('../services/entidades/defecto');

const aDefecto = (r) => new Defecto({
  id: r.id,
  folio: r.folio,
  fechaRegistro: r.created_at,
  severidad: r.severity,
  prioridad: r.priority,
  faseDeteccion: r.detection_phase,
  faseOrigen: r.origin_phase,
  descripcionDetallada: r.description,
  estado: r.status,
  confirmadoNoDuplicado: r.confirmed_not_duplicate,
  reportadoPorId: r.reported_by,
  asignadoAId: r.assigned_to,
});

// El folio se calcula con el proyecto bloqueado para que dos registros simultáneos no repitan número.
async function guardar(defecto, corte, tx) {
  await tx.query('SELECT 1 FROM monitored_projects WHERE id = $1 FOR UPDATE', [corte.project_id]);
  const { rows: [{ n }] } = await tx.query(
    `SELECT count(*)::int AS n FROM defects d JOIN evaluation_cutoffs c ON c.id = d.cutoff_id WHERE c.project_id = $1`,
    [corte.project_id],
  );
  const folio = `DEF-${String(n + 1).padStart(3, '0')}`;
  const { rows } = await tx.query(
    `INSERT INTO defects (cutoff_id, folio, title, description, severity, priority, detection_phase, origin_phase,
                          status, assigned_to, reported_by, confirmed_not_duplicate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [corte.id, folio, defecto.descripcionDetallada.slice(0, 200), defecto.descripcionDetallada, defecto.severidad,
      defecto.prioridad, defecto.faseDeteccion, defecto.faseOrigen, defecto.estado, defecto.asignadoAId,
      defecto.reportadoPorId, defecto.confirmadoNoDuplicado],
  );
  return aDefecto(rows[0]);
}

async function buscarSimilaresPorProyecto(proyectoId, faseOrigen) {
  const { rows } = await pool.query(
    `SELECT d.* FROM defects d JOIN evaluation_cutoffs c ON c.id = d.cutoff_id
      WHERE c.project_id = $1 AND d.origin_phase = $2 AND d.status <> $3`,
    [proyectoId, faseOrigen, EstadoDefecto.DESCARTADO],
  );
  return rows.map(aDefecto);
}

async function contarDefectosProyecto(proyectoId, tx = pool) {
  const { rows: [{ n }] } = await tx.query(
    `SELECT count(*)::int AS n FROM defects d JOIN evaluation_cutoffs c ON c.id = d.cutoff_id
      WHERE c.project_id = $1 AND d.status <> $2`,
    [proyectoId, EstadoDefecto.DESCARTADO],
  );
  return n;
}

async function listarPorProyecto(proyectoId) {
  const { rows } = await pool.query(
    `SELECT d.*, a.member_name AS asignado_nombre, r.member_name AS reportado_nombre
       FROM defects d
       JOIN evaluation_cutoffs c ON c.id = d.cutoff_id
       LEFT JOIN project_members a ON a.id = d.assigned_to
       LEFT JOIN project_members r ON r.id = d.reported_by
      WHERE c.project_id = $1
      ORDER BY d.created_at DESC`,
    [proyectoId],
  );
  return rows.map((r) => Object.assign(aDefecto(r), { asignadoNombre: r.asignado_nombre, reportadoNombre: r.reportado_nombre }));
}

module.exports = { guardar, buscarSimilaresPorProyecto, contarDefectosProyecto, listarPorProyecto };
