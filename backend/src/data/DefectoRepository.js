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
  return rows.map((r) => Object.assign(aDefecto(r), {
    asignadoNombre: r.asignado_nombre,
    reportadoNombre: r.reportado_nombre,
    notasResolucion: r.resolution_notes,
    fechaResolucion: r.resolved_date,
  }));
}

async function obtenerPorId(defectoId, tx = pool) {
  const { rows } = await tx.query(
    `SELECT d.*, a.member_name AS asignado_nombre, r.member_name AS reportado_nombre
       FROM defects d
       JOIN evaluation_cutoffs c ON c.id = d.cutoff_id
       LEFT JOIN project_members a ON a.id = d.assigned_to
       LEFT JOIN project_members r ON r.id = d.reported_by
      WHERE d.id = $1`,
    [defectoId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return Object.assign(aDefecto(r), {
    asignadoNombre: r.asignado_nombre,
    reportadoNombre: r.reportado_nombre,
    cutoffId: r.cutoff_id,
    notasResolucion: r.resolution_notes,
    fechaResolucion: r.resolved_date,
  });
}

async function actualizar(defectoId, datos, tx = pool) {
  const { rows } = await tx.query(
    `UPDATE defects
        SET description = COALESCE($1, description),
            title = COALESCE(SUBSTRING($1 FROM 1 FOR 200), title),
            severity = COALESCE($2, severity),
            priority = COALESCE($3, priority),
            detection_phase = COALESCE($4, detection_phase),
            origin_phase = COALESCE($5, origin_phase),
            status = COALESCE($6::VARCHAR, status),
            assigned_to = COALESCE($7, assigned_to),
            resolution_notes = COALESCE($8, resolution_notes),
            resolved_date = CASE 
              WHEN $6::VARCHAR IN ('CERRADO', 'DESCARTADO') AND resolved_date IS NULL THEN CURRENT_DATE 
              WHEN $6::VARCHAR IS NOT NULL AND $6::VARCHAR NOT IN ('CERRADO', 'DESCARTADO') THEN NULL
              ELSE resolved_date 
            END
      WHERE id = $9
      RETURNING *`,
    [
      datos.descripcionDetallada ?? null,
      datos.severidad ?? null,
      datos.prioridad ?? null,
      datos.faseDeteccion ?? null,
      datos.faseOrigen ?? null,
      datos.estado ?? null,
      datos.asignadoAId ?? null,
      datos.notasResolucion ?? null,
      defectoId,
    ],
  );
  if (rows.length === 0) return null;
  return aDefecto(rows[0]);
}

async function actualizarEstado(defectoId, nuevoEstado, notasResolucion = null, tx = pool) {
  const { rows } = await tx.query(
    `UPDATE defects
        SET status = $1::VARCHAR,
            resolution_notes = COALESCE($2, resolution_notes),
            resolved_date = CASE 
              WHEN $1::VARCHAR IN ('CERRADO', 'DESCARTADO') AND resolved_date IS NULL THEN CURRENT_DATE 
              WHEN $1::VARCHAR NOT IN ('CERRADO', 'DESCARTADO') THEN NULL
              ELSE resolved_date 
            END
      WHERE id = $3
      RETURNING *`,
    [nuevoEstado, notasResolucion, defectoId],
  );
  if (rows.length === 0) return null;
  return aDefecto(rows[0]);
}

module.exports = {
  guardar,
  buscarSimilaresPorProyecto,
  contarDefectosProyecto,
  listarPorProyecto,
  obtenerPorId,
  actualizar,
  actualizarEstado,
};
