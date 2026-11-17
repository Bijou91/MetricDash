const { pool } = require('../db/pool');
const { AlertaCalidad } = require('../domain/models');
const { ErrorPersistencia } = require('../domain/errors');

class RepositorioAlertaCalidad {
  constructor(customPool = pool) {
    this.pool = customPool;
  }

  async listarAlertasActivasPorProyecto(proyectoId) {
    try {
      const query = `
        SELECT id, project_id, metric_type, nivel_semaforo, mensaje, resuelta, activa, fecha_deteccion
        FROM quality_alerts
        WHERE project_id = $1 AND activa = TRUE
        ORDER BY fecha_deteccion DESC
      `;
      const res = await this.pool.query(query, [proyectoId]);
      return res.rows.map(r => new AlertaCalidad({
        id: r.id,
        proyectoId: r.project_id,
        tipoMetrica: r.metric_type,
        nivelSemaforo: r.nivel_semaforo,
        mensaje: r.mensaje,
        resuelta: r.resuelta,
        activa: r.activa,
        fechaDeteccion: r.fecha_deteccion
      }));
    } catch (err) {
      throw new ErrorPersistencia(`Error al listar alertas de calidad del proyecto ${proyectoId}`, 'SELECT_ALERTS', err);
    }
  }

  async listarAlertasActivas(proyectoId) {
    return this.listarAlertasActivasPorProyecto(proyectoId);
  }
}

module.exports = RepositorioAlertaCalidad;
