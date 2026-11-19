const { generarPDF } = require('./ExportadorReportePDFCU08');

// Las fechas DATE llegan como 'AAAA-MM-DD'; new Date() las tomaría como medianoche UTC (un día antes en México).
const fecha = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : new Date(f).toLocaleDateString('es-MX');
};

const seccion = (doc, texto, lineas) => {
  doc.moveDown().fontSize(13).fillColor('#1e3a8a').text(texto).fillColor('#0f172a').fontSize(10);
  if (lineas.length === 0) doc.fillColor('#64748b').text('Sin registros.').fillColor('#0f172a');
  for (const l of lineas) doc.text(`• ${l}`);
};

// FN-08: PDF de la bitácora de SQA del periodo.
function compilarPDF(bitacora) {
  return generarPDF(`Bitacora_SQA_${bitacora.periodo ?? 'periodo'}.pdf`, (doc) => {
    doc.fontSize(18).fillColor('#1e3a8a').text('MetricDash — Bitácora de SQA del periodo');
    doc.fontSize(10).fillColor('#475569').text(`Periodo ${bitacora.periodo ?? ''} · ${new Date().toLocaleDateString('es-MX')}`);

    seccion(doc, '1. Actividades SQA', bitacora.actividades.map((a) =>
      `${a.nombre} [${a.tipo}, ${a.fase}] — ${a.estado}${a.fechaEjecucion ? ` (${fecha(a.fechaEjecucion)})` : ''}`));
    seccion(doc, '2. Evidencias', bitacora.evidencias);
    seccion(doc, '3. Defectos', bitacora.defectos.map((d) =>
      `${d.folio ?? d.id} [${d.severidad}] — ${d.estado}: ${d.descripcionDetallada ?? ''}`));
    seccion(doc, '4. Acciones correctivas', bitacora.accionesCorrectivas.map((a) =>
      `${a.tipoMetrica}: ${a.descripcion} — ${a.estado}`));
    seccion(doc, '5. Decisiones', bitacora.decisiones.map((d) =>
      `[${d.origen}] ${d.descripcion}${d.justificacion ? ` — Justificación: ${d.justificacion}` : ''}`));
  });
}

module.exports = { compilarPDF };
