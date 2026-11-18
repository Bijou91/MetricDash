const pool = require('./pool');

// FN-09: persiste el cierre completo dentro de la transacción del controlador.
async function guardar(cierre, tx) {
  const { rows: [{ id }] } = await tx.query(
    `INSERT INTO period_closures
       (project_id, period_id, closed_at, closed_by, report_cutoff_id, health_index, index_legend, final_report_filename, final_report_pdf)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      cierre.proyectoId,
      cierre.periodoId,
      cierre.fechaCierre,
      cierre.cerradoPor,
      cierre.reporte.id,
      cierre.reporte.indiceSaludGeneral,
      cierre.reporte.leyendaIndice,
      cierre.reporteFinalPdf.nombreArchivo,
      cierre.reporteFinalPdf.contenidoBytes,
    ],
  );

  for (const r of cierre.resoluciones) {
    await tx.query(
      `INSERT INTO pending_resolutions
         (closure_id, pending_type, record_id, description, resolution, justification, origin_period_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, r.tipo, r.registroId, r.descripcion, r.opcion, r.justificacion, r.periodoOrigenId],
    );
  }

  const retro = cierre.retrospectiva;
  await tx.query(
    `INSERT INTO retrospectives (closure_id, went_well, to_improve, lessons_learned, agreements)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, retro.queFuncionoBien, retro.queDebeMejorar, retro.leccionesAprendidas, retro.acuerdos],
  );

  for (const m of cierre.metricasCongeladas) {
    await tx.query(
      `INSERT INTO frozen_metrics (closure_id, metric_type, final_value, health_status, source_measurement_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, m.tipoMetrica, m.valorFinal, m.estadoSemaforo, m.medicionOrigenId],
    );
  }

  const { archivoPdf, ...contenido } = cierre.bitacora;
  await tx.query(
    `INSERT INTO sqa_logbooks (closure_id, content, filename, pdf) VALUES ($1, $2::jsonb, $3, $4)`,
    [id, JSON.stringify(contenido), archivoPdf.nombreArchivo, archivoPdf.contenidoBytes],
  );
  return id;
}

// FN-09: descargas del reporte final y de la bitácora.
async function obtenerPorId(cierreId) {
  const { rows } = await pool.query(
    `SELECT pc.id, pc.final_report_filename, pc.final_report_pdf, sl.filename AS logbook_filename, sl.pdf AS logbook_pdf
       FROM period_closures pc
       JOIN sqa_logbooks sl ON sl.closure_id = pc.id
      WHERE pc.id = $1`,
    [cierreId],
  );
  const r = rows[0];
  if (!r) return null;
  const pdf = (nombreArchivo, contenidoBytes) => ({ nombreArchivo, mimeType: 'application/pdf', contenidoBytes });
  return {
    id: r.id,
    reporteFinalPdf: pdf(r.final_report_filename, r.final_report_pdf),
    bitacora: { archivoPdf: pdf(r.logbook_filename, r.logbook_pdf) },
  };
}

module.exports = { guardar, obtenerPorId };
