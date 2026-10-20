const pool = require('./pool');
const { ConfiguracionMetricas } = require('../services/entidades/metricas');

async function obtenerVigente(proyectoId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.project_id, c.version, c.is_current, c.created_by, c.created_at,
            t.metric_type, t.target_value, t.warning_threshold, t.critical_threshold
       FROM metric_configurations c
       JOIN metric_thresholds t ON t.configuration_id = c.id
      WHERE c.project_id = $1 AND c.is_current = true`,
    [proyectoId],
  );
  if (rows.length === 0) return null;
  const c = rows[0];
  return new ConfiguracionMetricas({
    id: c.id,
    proyectoId: c.project_id,
    version: c.version,
    vigente: c.is_current,
    creadoPor: c.created_by,
    fechaCreacion: c.created_at,
    // pg devuelve DECIMAL como string.
    metricas: rows.map((r) => ({
      tipo: r.metric_type,
      meta: Number(r.target_value),
      umbralAdvertencia: Number(r.warning_threshold),
      umbralCritico: Number(r.critical_threshold),
    })),
  });
}

// Bloquea la fila del proyecto para que dos guardados simultáneos no calculen la misma versión.
async function obtenerUltimaVersion(proyectoId, tx) {
  await tx.query('SELECT 1 FROM monitored_projects WHERE id = $1 FOR UPDATE', [proyectoId]);
  const { rows } = await tx.query(
    'SELECT COALESCE(MAX(version), 0) AS v FROM metric_configurations WHERE project_id = $1',
    [proyectoId],
  );
  return rows[0].v;
}

async function desactivarVigente(proyectoId, tx) {
  await tx.query(
    'UPDATE metric_configurations SET is_current = false WHERE project_id = $1 AND is_current = true',
    [proyectoId],
  );
}

async function insertarVersion(config, tx) {
  const { rows } = await tx.query(
    `INSERT INTO metric_configurations (project_id, version, is_current, created_by)
     VALUES ($1, $2, true, $3) RETURNING id, created_at`,
    [config.proyectoId, config.version, config.creadoPor],
  );
  config.id = rows[0].id;
  config.fechaCreacion = rows[0].created_at;

  const valores = [];
  const params = config.metricas.map((m, i) => {
    valores.push(config.id, m.tipo, m.meta, m.umbralAdvertencia, m.umbralCritico, m.sentido, m.unidad);
    const b = i * 7;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`;
  });
  await tx.query(
    `INSERT INTO metric_thresholds
       (configuration_id, metric_type, target_value, warning_threshold, critical_threshold, direction, unit)
     VALUES ${params.join(', ')}`,
    valores,
  );
}

module.exports = { obtenerVigente, obtenerUltimaVersion, desactivarVigente, insertarVersion };
