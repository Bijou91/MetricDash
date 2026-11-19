const crypto = require('crypto');
const pool = require('../data/pool');
const { ReporteSalud } = require('../domain/models');
const { ErrorPersistencia } = require('../domain/errors');

// Los reportes de salud (CU-07) viven en health_reports. NO se usa evaluation_cutoffs: esa tabla contiene
// los cortes oficiales CP1-CP4 que consumen CU-01, CU-03, CU-04 y CU-05. El DDL replica db/init/06_cu07.sql
// para que volúmenes ya existentes funcionen sin recrearse.
const DDL_HEALTH_REPORTS = `
  CREATE TABLE IF NOT EXISTS health_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES monitored_projects(id) ON DELETE CASCADE,
    version INT NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT now(),
    health_status VARCHAR(30) NOT NULL DEFAULT 'SIN_DATOS',
    index_status VARCHAR(20) NOT NULL DEFAULT 'SIN_DATOS'
      CHECK (index_status IN ('CALCULADO', 'INSUFICIENTE', 'SIN_DATOS')),
    health_index DECIMAL,
    executive_notes TEXT,
    breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (project_id, version)
  )`;

function aReporte(row) {
  return new ReporteSalud({
    id: row.id,
    proyectoId: row.project_id,
    versionReporte: row.version,
    nombreVersion: `Reporte de Salud #${row.version}`,
    fechaGeneracion: row.generated_at,
    estadoSalud: row.health_status,
    estadoIndice: row.index_status,
    indiceSaludGeneral: row.health_index !== null && row.health_index !== undefined ? Number(row.health_index) : null,
    notasEjecutivas: row.executive_notes,
    desglose: row.breakdown || []
  });
}

class RepositorioReporteSalud {
  constructor(customPool = pool) {
    this.pool = customPool;
    this.esquemaListo = null;
  }

  asegurarEsquema() {
    if (!this.esquemaListo) {
      this.esquemaListo = this.pool.query(DDL_HEALTH_REPORTS).catch((err) => {
        this.esquemaListo = null;
        throw new ErrorPersistencia('No se pudo preparar la tabla de reportes de salud', 'ENSURE_HEALTH_REPORTS', err);
      });
    }
    return this.esquemaListo;
  }

  // Dentro de una transacción serializa por proyecto con un advisory lock: FOR UPDATE no aplica a MAX()
  // y dos confirmaciones simultáneas obtendrían la misma versión.
  async obtenerSiguienteVersionReporte(proyectoId, tx = null) {
    await this.asegurarEsquema();
    const client = tx ? tx.client : this.pool;
    try {
      if (tx) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`health_reports:${proyectoId}`]);
      }
      const res = await client.query(
        'SELECT COALESCE(MAX(version), 0) + 1 AS siguiente_version FROM health_reports WHERE project_id = $1',
        [proyectoId]
      );
      return parseInt(res.rows[0].siguiente_version, 10);
    } catch (err) {
      throw new ErrorPersistencia(`Error al obtener siguiente versión para proyecto ${proyectoId}`, 'SELECT_NEXT_REPORT_VERSION', err);
    }
  }

  async guardarVersionReporteSalud(reporte, tx = null) {
    await this.asegurarEsquema();
    const client = tx ? tx.client : this.pool;
    try {
      const res = await client.query(
        `INSERT INTO health_reports
           (id, project_id, version, health_status, index_status, health_index, executive_notes, breakdown)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING *`,
        [
          reporte.id || crypto.randomUUID(),
          reporte.proyectoId,
          reporte.versionReporte,
          reporte.estadoSalud,
          reporte.estadoIndice,
          reporte.indiceSaludGeneral,
          reporte.notasEjecutivas,
          JSON.stringify(reporte.desglose || [])
        ]
      );
      return aReporte(res.rows[0]);
    } catch (err) {
      throw new ErrorPersistencia(`Error al guardar versión del reporte de salud para proyecto ${reporte.proyectoId}`, 'INSERT_HEALTH_REPORT', err);
    }
  }

  async listarHistorialReportes(proyectoId) {
    await this.asegurarEsquema();
    try {
      const res = await this.pool.query(
        `SELECT id, project_id, version, generated_at, health_status, index_status, health_index, executive_notes
           FROM health_reports
          WHERE project_id = $1
          ORDER BY version DESC`,
        [proyectoId]
      );
      return res.rows.map((r) => {
        const rep = aReporte(r);
        return {
          id: rep.id,
          version: rep.versionReporte,
          fechaGeneracion: rep.fechaGeneracion,
          estadoSalud: rep.estadoSalud,
          estadoIndice: rep.estadoIndice,
          indiceSalud: rep.indiceSaludGeneral,
          notasEjecutivas: rep.notasEjecutivas
        };
      });
    } catch (err) {
      throw new ErrorPersistencia('Error al listar historial de reportes', 'SELECT_HEALTH_REPORTS', err);
    }
  }

  async obtenerReportePorId(proyectoId, reporteId) {
    await this.asegurarEsquema();
    try {
      const res = await this.pool.query(
        'SELECT * FROM health_reports WHERE project_id = $1 AND id = $2',
        [proyectoId, reporteId]
      );
      return res.rows[0] ? aReporte(res.rows[0]) : null;
    } catch (err) {
      throw new ErrorPersistencia('Error al consultar el reporte de salud', 'SELECT_HEALTH_REPORT', err);
    }
  }
}

module.exports = RepositorioReporteSalud;
