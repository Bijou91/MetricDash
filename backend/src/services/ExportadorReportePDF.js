const PDFDocument = require('pdfkit');
const { ArchivoPDFDTO } = require('../domain/dtos');
const { ErrorGeneracionPDF } = require('../domain/errors');
const { NOMBRES_METRICA, ETIQUETA_NIVEL, ETIQUETA_IMPACTO, textoIndice } = require('../domain/etiquetas');

class ExportadorReportePDF {
  compilarPDF(reporte, desglose = []) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];

        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          const nombreArchivo = `Reporte_Salud_${reporte.proyectoId.substring(0, 8)}_v${reporte.versionReporte}.pdf`;
          
          const archivoDTO = new ArchivoPDFDTO({
            nombreArchivo,
            mimeType: 'application/pdf',
            contenidoBytes: pdfData,
            tamanoBytes: pdfData.length,
            base64: pdfData.toString('base64')
          });

          if (!this.validarIntegridadPDF(archivoDTO)) {
            return reject(new ErrorGeneracionPDF('El archivo PDF generado está corrupto o vacío'));
          }

          resolve(archivoDTO);
        });

        doc.on('error', (err) => {
          reject(new ErrorGeneracionPDF('Error al compilar documento PDF con PDFKit', err.message));
        });

        // Contenido del PDF
        // Encabezado
        doc.rect(40, 40, 515, 60).fill('#1e3a8a');
        doc.fillColor('#ffffff').fontSize(18).text('METRICDASH SQA - REPORTE DE SALUD', 55, 55);
        doc.fontSize(10).text(`Versión: #${reporte.versionReporte} | Fecha: ${new Date(reporte.fechaGeneracion).toLocaleDateString('es-ES')}`, 55, 80);

        doc.moveDown(3);
        doc.fillColor('#1e293b');

        // Resumen General
        doc.fontSize(14).text('1. Resumen Ejecutivo del Estado de Salud', { underline: true });
        doc.moveDown(0.5);

        const indiceTexto = textoIndice(reporte.estadoIndice, reporte.indiceSaludGeneral);

        doc.fontSize(11)
          .text(`• Proyecto ID: ${reporte.proyectoId}`)
          .text(`• Estado Consolidado: ${ETIQUETA_NIVEL[reporte.estadoSalud] || reporte.estadoSalud}`)
          .text(`• Índice de Salud Calculado: ${indiceTexto}`);

        doc.moveDown(1);

        // Desglose de Impacto por Métrica
        doc.fontSize(14).text('2. Desglose del Impacto por Métrica de Calidad', { underline: true });
        doc.moveDown(0.5);

        if (desglose && desglose.length > 0) {
          desglose.forEach((item, idx) => {
            let colorBadge = '#10b981'; // verde
            if (item.nivelSemaforo === 'ROJO_CRITICO') colorBadge = '#ef4444';
            if (item.nivelSemaforo === 'AMARILLO_ADVERTENCIA') colorBadge = '#f59e0b';
            if (item.nivelSemaforo === 'SIN_DATOS') colorBadge = '#94a3b8';

            doc.fontSize(11).fillColor('#0f172a').text(`${idx + 1}. ${NOMBRES_METRICA[item.tipoMetrica] || item.tipoMetrica}`, { bold: true });
            doc.fontSize(10).fillColor('#334155')
              .text(`   - Valor Medido: ${item.valorMedido !== null ? item.valorMedido : 'N/A'} | Meta: ${item.valorMeta !== null ? item.valorMeta : 'N/A'}`)
              .text(`   - Semáforo: ${ETIQUETA_NIVEL[item.nivelSemaforo] || item.nivelSemaforo} | Impacto: ${ETIQUETA_IMPACTO[item.impacto] || item.impacto}`)
              .text(`   - Puntaje aportado al índice: ${item.puntajeAportado}% (de 25%)`)
              .text(`   - Justificación: ${item.justificacionImpacto}`);
            doc.moveDown(0.5);
          });
        } else {
          doc.fontSize(10).fillColor('#64748b').text('No se registraron métricas vigentes para este reporte.');
        }

        doc.moveDown(1);

        // Notas Ejecutivas
        doc.fontSize(14).fillColor('#1e293b').text('3. Notas Ejecutivas del Equipo', { underline: true });
        doc.moveDown(0.5);

        if (reporte.notasEjecutivas && reporte.notasEjecutivas.trim().length > 0) {
          doc.fontSize(10).fillColor('#1e293b').text(reporte.notasEjecutivas, {
            align: 'justify',
            indent: 10
          });
        } else {
          doc.fontSize(10).fillColor('#64748b').text('(No se agregaron notas ejecutivas para este reporte. Generado de forma automatizada).');
        }

        // Pie de página
        doc.fontSize(8).fillColor('#94a3b8').text(
          'Documento formal emitido por MetricDash SQA Framework. Constancia de salud y calidad de software.',
          40,
          780,
          { align: 'center', width: 515 }
        );

        doc.end();
      } catch (err) {
        reject(new ErrorGeneracionPDF('Excepción al estructurar PDF', err.message));
      }
    });
  }

  validarIntegridadPDF(archivo) {
    return (
      archivo &&
      archivo.contenidoBytes &&
      archivo.tamanoBytes > 100 &&
      archivo.contenidoBytes.subarray(0, 4).toString() === '%PDF'
    );
  }
}

module.exports = ExportadorReportePDF;
