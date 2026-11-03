const pool = require('./pool');
const { AlertaDeterioro } = require('../services/entidades/accionCorrectiva');

function mapearFila(r) {
  if (!r) return null;
  return new AlertaDeterioro({
    id: r.id,
    proyectoId: r.project_id,
    tipoMetrica: r.metric_type,
    corteId: r.cutoff_id,
    valorInicial: r.initial_value != null ? Number(r.initial_value) : null,
    valorAnterior: r.previous_value != null ? Number(r.previous_value) : null,
    valorActual: r.current_value != null ? Number(r.current_value) : null,
    nivelSemaforo: r.severity_status,
    mensaje: r.message,
    tendencia: Array.isArray(r.trend) ? r.trend : (typeof r.trend === 'string' ? JSON.parse(r.trend) : []),
    posiblesCausas: Array.isArray(r.possible_causes) ? r.possible_causes : (typeof r.possible_causes === 'string' ? JSON.parse(r.possible_causes) : []),
    estado: r.status,
    creadoEn: r.created_at,
    actualizadoEn: r.updated_at,
  });
}

async function guardar(alerta, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `INSERT INTO quality_alerts
       (project_id, metric_type, cutoff_id, initial_value, previous_value, current_value, severity_status, message, trend, possible_causes, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
     RETURNING *`,
    [
      alerta.proyectoId,
      alerta.tipoMetrica,
      alerta.corteId,
      alerta.valorInicial,
      alerta.valorAnterior,
      alerta.valorActual,
      alerta.nivelSemaforo,
      alerta.mensaje,
      JSON.stringify(alerta.tendencia || []),
      JSON.stringify(alerta.posiblesCausas || []),
      alerta.estado || 'ACTIVA',
    ],
  );
  return mapearFila(rows[0]);
}

async function obtenerPorId(alertaId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    'SELECT * FROM quality_alerts WHERE id = $1',
    [alertaId],
  );
  return mapearFila(rows[0]);
}

async function listarPorProyecto(proyectoId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    'SELECT * FROM quality_alerts WHERE project_id = $1 ORDER BY created_at DESC',
    [proyectoId],
  );
  return rows.map(mapearFila);
}

async function obtenerAlertaActivaPorMetrica(proyectoId, tipoMetrica, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT * FROM quality_alerts
      WHERE project_id = $1 AND metric_type = $2 AND status IN ('ACTIVA', 'EN_PROCESO')
      ORDER BY created_at DESC
      LIMIT 1`,
    [proyectoId, tipoMetrica],
  );
  return mapearFila(rows[0]);
}

async function actualizar(alertaId, campos = {}, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const asignaciones = [];
  const valores = [alertaId];

  if (campos.estado !== undefined) {
    valores.push(campos.estado);
    asignaciones.push(`status = $${valores.length}`);
  }
  if (campos.tendencia !== undefined) {
    valores.push(JSON.stringify(campos.tendencia));
    asignaciones.push(`trend = $${valores.length}::jsonb`);
  }
  if (campos.mensaje !== undefined) {
    valores.push(campos.mensaje);
    asignaciones.push(`message = $${valores.length}`);
  }
  if (campos.valorActual !== undefined) {
    valores.push(campos.valorActual);
    asignaciones.push(`current_value = $${valores.length}`);
  }
  if (campos.nivelSemaforo !== undefined) {
    valores.push(campos.nivelSemaforo);
    asignaciones.push(`severity_status = $${valores.length}`);
  }

  asignaciones.push('updated_at = now()');

  const { rows } = await client.query(
    `UPDATE quality_alerts
        SET ${asignaciones.join(', ')}
      WHERE id = $1
      RETURNING *`,
    valores,
  );
  return mapearFila(rows[0]);
}

module.exports = {
  guardar,
  obtenerPorId,
  listarPorProyecto,
  obtenerAlertaActivaPorMetrica,
  actualizar,
};

