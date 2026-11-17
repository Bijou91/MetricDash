const crypto = require('crypto');
const { pool } = require('../db/pool');
const { ReporteSalud } = require('../domain/models');
const { ErrorPersistencia } = require('../domain/errors');

class RepositorioCorteEvaluacion {
  constructor(customPool = pool) {
    this.pool = customPool;
  }

  async obtenerSiguienteVersionReporte(proyectoId, tx = null) {
    const client = tx ? tx.client : this.pool;
    try {
      // Bloqueo FOR UPDATE para atomicidad en la versión si hay transacción
      let query = 'SELECT COALESCE(MAX(cutoff_number), 0) + 1 AS siguiente_version FROM evaluation_cutoffs WHERE project_id = $1';
      if (tx) {
        query += ' FOR UPDATE';
      }
      const res = await client.query(query, [proyectoId]);
      return parseInt(res.rows[0].siguiente_version, 10);
    } catch (err) {
      throw new ErrorPersistencia(`Error al obtener siguiente versión para proyecto ${proyectoId}`, 'SELECT_NEXT_CUTOFF_NUMBER', err);
    }
  }

  async guardarVersionReporteSalud(reporte, tx = null) {
    const client = tx ? tx.client : this.pool;
    try {
      const id = reporte.id || crypto.randomUUID();
      const cutoffName = reporte.nombreVersion || `Reporte de Salud #${reporte.versionReporte}`;
      
      const query = `
        INSERT INTO evaluation_cutoffs
        (id, project_id, cutoff_number, cutoff_name, cutoff_date, kloc, planned_sqa_acts, executed_sqa_acts, health_status, notes)
        VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9)
        RETURNING id, project_id, cutoff_number, cutoff_name, cutoff_date, health_status, notes, created_at;
      `;
      const values = [
        id,
        reporte.proyectoId,
        reporte.versionReporte,
        cutoffName,
        reporte.klocActual,
        reporte.actividadesPlaneadas,
        reporte.actividadesEjecutadas,
        reporte.estadoSalud,
        reporte.notasEjecutivas
      ];

      const res = await client.query(query, values);
      const inserted = res.rows[0];

      return new ReporteSalud({
        id: inserted.id,
        proyectoId: inserted.project_id,
        versionReporte: inserted.cutoff_number,
        nombreVersion: inserted.cutoff_name,
        fechaGeneracion: inserted.created_at,
        estadoSalud: inserted.health_status,
        indiceSaludGeneral: reporte.indiceSaludGeneral,
        notasEjecutivas: inserted.notes,
        desglose: reporte.desglose
      });
    } catch (err) {
      throw new ErrorPersistencia(`Error al guardar versión del reporte de salud para proyecto ${reporte.proyectoId}`, 'INSERT_EVALUATION_CUTOFF', err);
    }
  }

  async guardarCorteReporteSalud(reporte, tx = null) {
    return this.guardarVersionReporteSalud(reporte, tx);
  }

  async listarHistorialReportes(proyectoId) {
    try {
      const query = `
        SELECT id, project_id, cutoff_number, cutoff_name, cutoff_date, kloc, planned_sqa_acts, executed_sqa_acts, health_status, notes, created_at
        FROM evaluation_cutoffs
        WHERE project_id = $1
        ORDER BY cutoff_number DESC
      `;
      const res = await this.pool.query(query, [proyectoId]);
      return res.rows;
    } catch (err) {
      throw new ErrorPersistencia('Error al listar historial de reportes', 'SELECT_CUTOFFS_HISTORY', err);
    }
  }
}

module.exports = RepositorioCorteEvaluacion;
