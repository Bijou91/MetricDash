const pool = require('../data/pool');
const { MedicionMetrica } = require('../domain/models');
const { ErrorPersistencia } = require('../domain/errors');

class RepositorioMedicionMetrica {
  constructor(customPool = pool) {
    this.pool = customPool;
  }

  async obtenerUltimasMediciones(proyectoId) {
    try {
      // 1. Intentar desde metric_measurements (creada y alimentada por CU-06, CU-03, CU-04, CU-05)
      const query = `
        SELECT DISTINCT ON (metric_type) id, project_id, metric_type, value, health_status, recorded_at
        FROM metric_measurements
        WHERE project_id = $1
        ORDER BY metric_type, recorded_at DESC
      `;
      const res = await this.pool.query(query, [proyectoId]);
      if (res.rows && res.rows.length > 0) {
        return res.rows.map(r => new MedicionMetrica({
          id: r.id,
          proyectoId: r.project_id,
          tipoMetrica: r.metric_type,
          valorCalculado: r.value,
          nivelSemaforo: r.health_status,
          fechaMedicion: r.recorded_at
        }));
      }

      // 2. Fallback: Si no hay mediciones en metric_measurements, consultar quality_metrics vinculada a evaluation_cutoffs
      const fallbackQuery = `
        SELECT qm.*, ec.project_id
        FROM quality_metrics qm
        JOIN evaluation_cutoffs ec ON ec.id = qm.cutoff_id
        WHERE ec.project_id = $1
        ORDER BY ec.cutoff_number DESC, qm.calculated_at DESC
        LIMIT 1
      `;
      const resFallback = await this.pool.query(fallbackQuery, [proyectoId]);
      if (resFallback.rows.length === 0) {
        return [];
      }
      const q = resFallback.rows[0];
      const mediciones = [];
      if (q.defect_density !== null && q.defect_density !== undefined) {
        mediciones.push(new MedicionMetrica({
          id: q.id,
          proyectoId: q.project_id,
          tipoMetrica: 'DENSIDAD_DEFECTOS',
          valorCalculado: q.defect_density,
          nivelSemaforo: q.health_status || 'VERDE_OPTIMO',
          fechaMedicion: q.calculated_at
        }));
      }
      if (q.test_coverage_pct !== null && q.test_coverage_pct !== undefined) {
        mediciones.push(new MedicionMetrica({
          id: q.id,
          proyectoId: q.project_id,
          tipoMetrica: 'COBERTURA_PRUEBAS',
          valorCalculado: q.test_coverage_pct,
          nivelSemaforo: q.health_status || 'AMARILLO_ADVERTENCIA',
          fechaMedicion: q.calculated_at
        }));
      }
      if (q.test_pass_rate_pct !== null && q.test_pass_rate_pct !== undefined) {
        mediciones.push(new MedicionMetrica({
          id: q.id,
          proyectoId: q.project_id,
          tipoMetrica: 'TASA_EXITO_PRUEBAS',
          valorCalculado: q.test_pass_rate_pct,
          nivelSemaforo: q.health_status || 'VERDE_OPTIMO',
          fechaMedicion: q.calculated_at
        }));
      }
      if (q.sqa_compliance_pct !== null && q.sqa_compliance_pct !== undefined) {
        mediciones.push(new MedicionMetrica({
          id: q.id,
          proyectoId: q.project_id,
          tipoMetrica: 'CUMPLIMIENTO_SQA',
          valorCalculado: q.sqa_compliance_pct,
          nivelSemaforo: q.health_status || 'ROJO_CRITICO',
          fechaMedicion: q.calculated_at
        }));
      }
      return mediciones;
    } catch (err) {
      throw new ErrorPersistencia(`Error al obtener últimas mediciones del proyecto ${proyectoId}`, 'SELECT_MEASUREMENTS', err);
    }
  }

  async obtenerUltimasMedicionesDeLas4Metricas(proyectoId) {
    return this.obtenerUltimasMediciones(proyectoId);
  }
}

module.exports = RepositorioMedicionMetrica;
