const pool = require('./pool');
const { TableroControl } = require('../services/entidades/pruebas');
const { NivelSemaforo } = require('../services/entidades/proyecto');

// Obtiene el tablero del proyecto desde dashboards; si aún no existe fila, devuelve una instancia inicial.
async function obtenerPorProyecto(proyectoId, tx = pool) {
  const { rows } = await tx.query(
    'SELECT * FROM dashboards WHERE project_id = $1',
    [proyectoId],
  );
  if (rows.length === 0) {
    return new TableroControl({
      proyectoId,
      healthStatus: NivelSemaforo.SIN_DATOS,
    });
  }
  const r = rows[0];
  return new TableroControl({
    proyectoId: r.project_id,
    healthStatus: r.health_status,
    ultimaAlerta: r.last_alert_message,
    ultimaActualizacion: r.updated_at,
  });
}

// FN-06: Persiste el estado global del tablero mediante upsert en dashboards y sincroniza evaluation_cutoffs.
async function guardar(tablero, tx = pool) {
  await tx.query(
    `INSERT INTO dashboards (project_id, health_status, last_alert_message, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (project_id) DO UPDATE
       SET health_status = EXCLUDED.health_status,
           last_alert_message = EXCLUDED.last_alert_message,
           updated_at = now()`,
    [tablero.proyectoId, tablero.healthStatus, tablero.ultimaAlerta ?? null],
  );
}

module.exports = { obtenerPorProyecto, guardar };

