const { pool } = require('../db/pool');
const { UmbralMetrica } = require('../domain/models');
const { ErrorPersistencia } = require('../domain/errors');

class RepositorioConfiguracionMetrica {
  constructor(customPool = pool) {
    this.pool = customPool;
  }

  async obtenerUmbralesVigentes(proyectoId) {
    try {
      const query = `
        SELECT mt.id, mt.metric_type, mt.target_value, mt.warning_threshold,
               mt.critical_threshold, mt.direction, mt.unit
        FROM metric_thresholds mt
        JOIN metric_configurations mc ON mc.id = mt.configuration_id
        WHERE mc.project_id = $1 AND mc.is_current = TRUE
      `;
      const res = await this.pool.query(query, [proyectoId]);
      return res.rows.map(r => new UmbralMetrica({
        id: r.id,
        tipoMetrica: r.metric_type,
        valorMeta: r.target_value,
        umbralAdvertencia: r.warning_threshold,
        umbralCritico: r.critical_threshold,
        sentido: r.direction,
        unidad: r.unit
      }));
    } catch (err) {
      throw new ErrorPersistencia(`Error al obtener umbrales vigentes para proyecto ${proyectoId}`, 'SELECT_THRESHOLDS', err);
    }
  }
}

module.exports = RepositorioConfiguracionMetrica;
