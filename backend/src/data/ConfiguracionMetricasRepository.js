const pool = require('./pool');
const { ConfiguracionMetricas, TipoMetrica } = require('../services/entidades/metricas');

const COLUMNAS_MEDICION = Object.freeze({
  [TipoMetrica.DENSIDAD_DEFECTOS]: 'defect_density',
  [TipoMetrica.COBERTURA_PRUEBAS]: 'test_coverage_pct',
  [TipoMetrica.TASA_EXITO_PRUEBAS]: 'test_pass_rate_pct',
  [TipoMetrica.CUMPLIMIENTO_SQA]: 'sqa_compliance_pct',
});

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

// CU-03 FN-06 / CU-05 FN-05: umbral vigente de una métrica, o null si el proyecto no tiene configuración (precondición 3).
async function obtenerUmbralVigente(proyectoId, tipo) {
  const config = await obtenerVigente(proyectoId);
  return config?.metricas.find((m) => m.tipo === tipo) ?? null;
}

// CU-03 FN-05 / CU-05 FN-06: una medición por corte (ER: quality_metrics 1 a 1 con evaluation_cutoffs).
// Actualiza únicamente la columna asociada al tipo de métrica (o defect_density por defecto para compatibilidad con CU-03).
async function guardarMedicion(corteId, medicion, tx = pool) {
  const columna = COLUMNAS_MEDICION[medicion?.tipoMetrica] || 'defect_density';
  await tx.query(
    `INSERT INTO quality_metrics (cutoff_id, ${columna}, health_status, calculated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (cutoff_id) DO UPDATE
       SET ${columna} = EXCLUDED.${columna}, health_status = EXCLUDED.health_status, calculated_at = now()`,
    [corteId, medicion.valorCalculado, medicion.estadoSemaforo],
  );
}

async function obtenerMedicion(corteId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query('SELECT * FROM quality_metrics WHERE cutoff_id = $1', [corteId]);
  return rows[0] ?? null;
}

// CU-06: Guarda una medición en la tabla histórica metric_measurements
async function guardarMedicionHistorica({ proyectoId, corteId = null, tipoMetrica, valor, estadoSemaforo = 'SIN_DATOS' }, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  try {
    const { rows } = await client.query(
      `INSERT INTO metric_measurements (project_id, cutoff_id, metric_type, value, health_status, recorded_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING *`,
      [proyectoId, corteId, tipoMetrica, valor, estadoSemaforo],
    );
    return rows[0];
  } catch (err) {
    console.warn('[ConfiguracionMetricasRepository] No se pudo guardar en metric_measurements:', err.message);
    return null;
  }
}

// CU-06: Obtiene las últimas N mediciones históricas de una métrica para calcular la tendencia
async function obtenerMedicionesHistoricas(proyectoId, tipoMetrica, limite = 3, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  try {
    const { rows } = await client.query(
      `SELECT mm.*, ec.cutoff_name, ec.cutoff_number
         FROM metric_measurements mm
         LEFT JOIN evaluation_cutoffs ec ON ec.id = mm.cutoff_id
        WHERE mm.project_id = $1 AND mm.metric_type = $2
        ORDER BY mm.recorded_at DESC
        LIMIT $3`,
      [proyectoId, tipoMetrica, limite],
    );
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        valor: Number(r.value),
        estadoSemaforo: r.health_status,
        fecha: r.recorded_at,
        nombreCorte: r.cutoff_name || (r.cutoff_number ? `CP${r.cutoff_number}` : 'Medición'),
      }));
    }
  } catch (_) {
    // Fallback a quality_metrics abajo
  }

  // Fallback a quality_metrics por corte si metric_measurements no existe o está vacía
  const columna = COLUMNAS_MEDICION[tipoMetrica];
  if (!columna) return [];
  const { rows: rowsQM } = await client.query(
    `SELECT qm.${columna} as valor, qm.health_status, qm.calculated_at as fecha,
            ec.cutoff_name, ec.cutoff_number
       FROM quality_metrics qm
       JOIN evaluation_cutoffs ec ON ec.id = qm.cutoff_id
      WHERE ec.project_id = $1 AND qm.${columna} IS NOT NULL
      ORDER BY ec.cutoff_number DESC, qm.calculated_at DESC
      LIMIT $2`,
    [proyectoId, limite],
  );
  return rowsQM.map((r) => ({
    valor: Number(r.valor),
    estadoSemaforo: r.health_status,
    fecha: r.fecha,
    nombreCorte: r.cutoff_name || `CP${r.cutoff_number}`,
  }));
}

// CU-06: Obtiene la medición inmediata anterior (Vn-1) de la métrica
async function obtenerMedicionAnterior(proyectoId, tipoMetrica, tx = pool) {
  const historial = await obtenerMedicionesHistoricas(proyectoId, tipoMetrica, 2, tx);
  return historial[0] || null;
}

module.exports = {
  COLUMNAS_MEDICION,
  obtenerVigente,
  obtenerUltimaVersion,
  desactivarVigente,
  insertarVersion,
  obtenerUmbralVigente,
  guardarMedicion,
  obtenerMedicion,
  guardarMedicionHistorica,
  obtenerMedicionesHistoricas,
  obtenerMedicionAnterior,
};
