const pool = require('../data/pool');
const { AlertaCalidad } = require('../domain/models');
const { ErrorPersistencia } = require('../domain/errors');

class RepositorioAlertaCalidad {
  constructor(customPool = pool) {
    this.pool = customPool;
  }

  async listarAlertasActivasPorProyecto(proyectoId) {
    try {
      // quality_alerts en el schema de origin/main usa status ('ACTIVA', 'EN_PROCESO', 'RESUELTA')
      const query = `
        SELECT id, project_id, metric_type, severity_status, message, status, created_at
        FROM quality_alerts
        WHERE project_id = $1 AND status IN ('ACTIVA', 'EN_PROCESO')
        ORDER BY created_at DESC
      `;
      const res = await this.pool.query(query, [proyectoId]);
      return res.rows.map(r => new AlertaCalidad({
        id: r.id,
        proyectoId: r.project_id,
        tipoMetrica: r.metric_type,
        nivelSemaforo: r.severity_status,
        mensaje: r.message,
        resuelta: r.status === 'RESUELTA',
        activa: r.status === 'ACTIVA' || r.status === 'EN_PROCESO',
        fechaDeteccion: r.created_at
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
