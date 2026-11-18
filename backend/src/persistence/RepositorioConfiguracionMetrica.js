const pool = require('../data/pool');
const { UmbralMetrica } = require('../domain/models');
const { ErrorPersistencia } = require('../domain/errors');

class RepositorioConfiguracionMetrica {
  constructor(customPool = pool) {
    this.pool = customPool;
  }

  async obtenerUmbralesVigentes(proyectoId) {
    try {
      // 1. Intentar consulta estándar: JOIN metric_thresholds con metric_configurations
      const query = `
        SELECT mt.id, mt.metric_type, mt.target_value, mt.warning_threshold,
               mt.critical_threshold, mt.direction, mt.unit
        FROM metric_thresholds mt
        JOIN metric_configurations mc ON mc.id = mt.configuration_id
        WHERE mc.project_id = $1 AND mc.is_current = TRUE
      `;
      const res = await this.pool.query(query, [proyectoId]);
      if (res.rows && res.rows.length > 0) {
        return res.rows.map(r => new UmbralMetrica({
          id: r.id,
          tipoMetrica: r.metric_type,
          valorMeta: r.target_value,
          umbralAdvertencia: r.warning_threshold,
          umbralCritico: r.critical_threshold,
          sentido: r.direction,
          unidad: r.unit
        }));
      }

      // 2. Si no hay filas con is_current = true, intentar la última configuración creada
      const queryUltima = `
        SELECT mt.id, mt.metric_type, mt.target_value, mt.warning_threshold,
               mt.critical_threshold, mt.direction, mt.unit
        FROM metric_thresholds mt
        JOIN metric_configurations mc ON mc.id = mt.configuration_id
        WHERE mc.project_id = $1
        ORDER BY mc.version DESC, mc.created_at DESC
        LIMIT 4
      `;
      const resUltima = await this.pool.query(queryUltima, [proyectoId]);
      if (resUltima.rows && resUltima.rows.length > 0) {
        return resUltima.rows.map(r => new UmbralMetrica({
          id: r.id,
          tipoMetrica: r.metric_type,
          valorMeta: r.target_value,
          umbralAdvertencia: r.warning_threshold,
          umbralCritico: r.critical_threshold,
          sentido: r.direction,
          unidad: r.unit
        }));
      }

      // Si no hay umbrales registrados para este proyecto, devolver lista vacía en lugar de arrojar error fatal
      return [];
    } catch (err) {
      console.warn(`[RepositorioConfiguracionMetrica] Error consultando umbrales para proyecto ${proyectoId}:`, err.message);
      // Retornar lista vacía para permitir que el tablero despliegue estado SIN_DATOS de forma amigable (FA-04.01)
      return [];
    }
  }
}

module.exports = RepositorioConfiguracionMetrica;
