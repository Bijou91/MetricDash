const pool = require('./pool');
const { AccionCorrectiva, HistorialVerificacion } = require('../services/entidades/accionCorrectiva');

function mapearAccion(r) {
  if (!r) return null;
  return new AccionCorrectiva({
    id: r.id,
    alertaId: r.alert_id,
    proyectoId: r.project_id,
    tipoMetrica: r.metric_type,
    descripcion: r.description,
    causaAtendida: r.cause_addressed,
    responsableId: r.assigned_to,
    responsableNombre: r.member_name || r.responsable_nombre || null,
    fechaCompromiso: r.commitment_date ? (r.commitment_date instanceof Date ? r.commitment_date.toISOString().split('T')[0] : String(r.commitment_date).split('T')[0]) : null,
    estado: r.status,
    esEficaz: r.is_effective,
    creadoEn: r.created_at,
    actualizadoEn: r.updated_at,
  });
}

function mapearHistorial(r) {
  if (!r) return null;
  return new HistorialVerificacion({
    id: r.id,
    accionId: r.action_id,
    valorMedido: Number(r.measured_value),
    valorBase: Number(r.baseline_value),
    esEficaz: Boolean(r.is_effective),
    notas: r.notes,
    fechaVerificacion: r.verified_at,
  });
}

async function buscarAbiertaPorMetrica(proyectoId, tipoMetrica, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT ca.*, pm.member_name
       FROM corrective_actions ca
       LEFT JOIN project_members pm ON pm.id = ca.assigned_to
      WHERE ca.project_id = $1 AND ca.metric_type = $2 AND ca.status = 'abierta'
      ORDER BY ca.created_at DESC
      LIMIT 1`,
    [proyectoId, tipoMetrica],
  );
  return mapearAccion(rows[0]);
}

async function obtenerPorId(accionId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT ca.*, pm.member_name
       FROM corrective_actions ca
       LEFT JOIN project_members pm ON pm.id = ca.assigned_to
      WHERE ca.id = $1`,
    [accionId],
  );
  return mapearAccion(rows[0]);
}

async function listarPorProyecto(proyectoId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT ca.*, pm.member_name,
            qa.severity_status as alerta_nivel_semaforo,
            qa.message as alerta_mensaje,
            qa.initial_value as alerta_valor_inicial
       FROM corrective_actions ca
       LEFT JOIN project_members pm ON pm.id = ca.assigned_to
       LEFT JOIN quality_alerts qa ON qa.id = ca.alert_id
      WHERE ca.project_id = $1
      ORDER BY ca.created_at DESC`,
    [proyectoId],
  );

  const acciones = rows.map((r) => {
    const accion = mapearAccion(r);
    accion.alerta = {
      id: r.alert_id,
      nivelSemaforo: r.alerta_nivel_semaforo,
      mensaje: r.alerta_mensaje,
      valorInicial: r.alerta_valor_inicial != null ? Number(r.alerta_valor_inicial) : null,
    };
    return accion;
  });

  // Cargar historial de verificaciones para cada acción
  for (const acc of acciones) {
    acc.historialVerificaciones = await obtenerHistorialVerificaciones(acc.id, client);
  }

  return acciones;
}

async function guardar(dto, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `INSERT INTO corrective_actions
       (alert_id, project_id, metric_type, description, cause_addressed, assigned_to, commitment_date, status, is_effective)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      dto.alertaId || null,
      dto.proyectoId,
      dto.tipoMetrica,
      dto.descripcion,
      dto.causaAtendida || dto.causa,
      dto.responsableId,
      dto.fechaCompromiso,
      dto.estado || 'abierta',
      dto.esEficaz ?? null,
    ],
  );
  return mapearAccion(rows[0]);
}

async function actualizar(accionId, dto = {}, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const asignaciones = [];
  const valores = [accionId];

  if (dto.descripcion !== undefined) {
    valores.push(dto.descripcion);
    asignaciones.push(`description = $${valores.length}`);
  }
  if (dto.causaAtendida !== undefined || dto.causa !== undefined) {
    valores.push(dto.causaAtendida || dto.causa);
    asignaciones.push(`cause_addressed = $${valores.length}`);
  }
  if (dto.responsableId !== undefined) {
    valores.push(dto.responsableId);
    asignaciones.push(`assigned_to = $${valores.length}`);
  }
  if (dto.fechaCompromiso !== undefined) {
    valores.push(dto.fechaCompromiso);
    asignaciones.push(`commitment_date = $${valores.length}`);
  }
  if (dto.estado !== undefined) {
    valores.push(dto.estado);
    asignaciones.push(`status = $${valores.length}`);
  }
  if (dto.esEficaz !== undefined) {
    valores.push(dto.esEficaz);
    asignaciones.push(`is_effective = $${valores.length}`);
  }

  asignaciones.push('updated_at = now()');

  const { rows } = await client.query(
    `UPDATE corrective_actions
        SET ${asignaciones.join(', ')}
      WHERE id = $1
      RETURNING *`,
    valores,
  );
  return mapearAccion(rows[0]);
}

async function registrarVerificacion(historial, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `INSERT INTO verification_history
       (action_id, measured_value, baseline_value, is_effective, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      historial.accionId,
      historial.valorMedido,
      historial.valorBase,
      historial.esEficaz,
      historial.notes || historial.notas || null,
    ],
  );
  return mapearHistorial(rows[0]);
}

async function obtenerHistorialVerificaciones(accionId, tx = pool) {
  const client = tx && typeof tx.query === 'function' ? tx : pool;
  const { rows } = await client.query(
    `SELECT * FROM verification_history
      WHERE action_id = $1
      ORDER BY verified_at DESC`,
    [accionId],
  );
  return rows.map(mapearHistorial);
}

module.exports = {
  buscarAbiertaPorMetrica,
  obtenerPorId,
  listarPorProyecto,
  guardar,
  actualizar,
  registrarVerificacion,
  obtenerHistorialVerificaciones,
};

