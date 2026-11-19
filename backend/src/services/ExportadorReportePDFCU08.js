// Portado del CU-07 (rama implCU07): PDF del reporte de salud con pdfkit.
const PDFDocument = require('pdfkit');

const NOMBRE_METRICA = Object.freeze({
  DENSIDAD_DEFECTOS: 'Densidad de defectos',
  COBERTURA_PRUEBAS: 'Cobertura de pruebas',
  TASA_EXITO_PRUEBAS: 'Tasa de éxito de pruebas',
  CUMPLIMIENTO_SQA: 'Cumplimiento de actividades SQA',
});

// Compila el documento en memoria y devuelve un ArchivoPDFDTO; cualquier error rechaza la promesa (FE-01).
function generarPDF(nombreArchivo, dibujar) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('error', reject);
    doc.on('end', () => {
      const contenidoBytes = Buffer.concat(partes);
      if (contenidoBytes.subarray(0, 4).toString() !== '%PDF') {
        reject(new Error('El PDF generado está vacío o corrupto.'));
        return;
      }
      resolve({ nombreArchivo, mimeType: 'application/pdf', contenidoBytes });
    });
    try {
      dibujar(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

const titulo = (doc, texto) => doc.moveDown().fontSize(13).fillColor('#1e3a8a').text(texto).fillColor('#0f172a').fontSize(10);

function compilarPDF(reporte, desglose = []) {
  return generarPDF(`Reporte_Final_Salud_v${reporte.versionReporte}.pdf`, (doc) => {
    doc.fontSize(18).fillColor('#1e3a8a').text('MetricDash — Reporte final de salud');
    doc.fontSize(10).fillColor('#475569')
      .text(`${reporte.nombreVersion} · Versión ${reporte.versionReporte} · ${new Date(reporte.fechaGeneracion ?? Date.now()).toLocaleDateString('es-MX')}`);

    titulo(doc, '1. Estado de salud');
    doc.text(`Índice de salud: ${reporte.indiceSaludGeneral != null ? `${reporte.indiceSaludGeneral}%` : reporte.leyendaIndice}`)
      .text(`Estado consolidado: ${reporte.estadoSalud}`)
      .text(`Tamaño del producto: ${reporte.klocActual} KLOC`)
      .text(`Actividades SQA: ${reporte.actividadesEjecutadas} realizadas de ${reporte.actividadesPlaneadas} exigibles`);

    titulo(doc, '2. Desglose del impacto por métrica');
    for (const d of desglose) {
      doc.text(`• ${NOMBRE_METRICA[d.tipoMetrica] ?? d.tipoMetrica}: ${d.valorMedido ?? 'sin valor'} ${d.valorMedido != null ? d.unidad : ''}`
        + ` (meta ${d.valorMeta ?? 'N/A'}) — ${d.nivelSemaforo}, impacto ${d.impacto}`);
    }

    titulo(doc, '3. Notas ejecutivas');
    doc.text(reporte.notasEjecutivas || 'Sin notas ejecutivas.');
  });
}

module.exports = { compilarPDF, generarPDF, NOMBRE_METRICA };
