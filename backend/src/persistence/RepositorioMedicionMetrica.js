const { pool } = require('../db/pool');
const { MedicionMetrica } = require('../domain/models');
const { ErrorPersistencia } = require('../domain/errors');

class RepositorioMedicionMetrica {
  constructor(customPool = pool) {
    this.pool = customPool;
  }

  async obtenerUltimasMediciones(proyectoId) {
    try {
      const query = `
        SELECT DISTINCT ON (metric_type) id, project_id, metric_type, calculated_value, semaphore_level, measured_at
        FROM metric_measurements
        WHERE project_id = $1
        ORDER BY metric_type, measured_at DESC
      `;
      const res = await this.pool.query(query, [proyectoId]);
      return res.rows.map(r => new MedicionMetrica({
        id: r.id,
        proyectoId: r.project_id,
        tipoMetrica: r.metric_type,
        valorCalculado: r.calculated_value,
        nivelSemaforo: r.semaphore_level,
        fechaMedicion: r.measured_at
      }));
    } catch (err) {
      throw new ErrorPersistencia(`Error al obtener últimas mediciones del proyecto ${proyectoId}`, 'SELECT_MEASUREMENTS', err);
    }
  }

  async obtenerUltimasMedicionesDeLas4Metricas(proyectoId) {
    return this.obtenerUltimasMediciones(proyectoId);
  }
}

module.exports = RepositorioMedicionMetrica;
