const crypto = require('crypto');
const ServicioTableroSalud = require('./ServicioTableroSalud');
const CalculadorIndiceSalud = require('./CalculadorIndiceSalud');
const ExportadorReportePDF = require('./ExportadorReportePDF');
const RepositorioCorteEvaluacion = require('../persistence/RepositorioCorteEvaluacion');
const GestorTransacciones = require('../persistence/GestorTransacciones');
const { ReporteSalud, NivelSemaforo } = require('../domain/models');
const { PrevisualizacionReporteDTO, ResultadoReporteSaludDTO } = require('../domain/dtos');

class ServicioReporteSalud {
  constructor(
    servicioTablero = new ServicioTableroSalud(),
    calculadorSalud = new CalculadorIndiceSalud(),
    exportadorPDF = new ExportadorReportePDF(),
    repoCorte = new RepositorioCorteEvaluacion(),
    gestorTx = new GestorTransacciones()
  ) {
    this.servicioTablero = servicioTablero;
    this.calculadorSalud = calculadorSalud;
    this.exportadorPDF = exportadorPDF;
    this.repoCorte = repoCorte;
    this.gestorTx = gestorTx;
  }

  async generarPrevisualizacion(proyectoId) {
    const umbrales = await this.servicioTablero.obtenerUmbralesVigentes(proyectoId);
    const mediciones = await this.servicioTablero.obtenerMedicionesVigentes(proyectoId);
    const medicionesCompletas = this.calculadorSalud.verificarMedicionesCompletas(mediciones);

    const siguienteVersion = await this.repoCorte.obtenerSiguienteVersionReporte(proyectoId);
    const desglose = this.calculadorSalud.generarDesgloseImpacto(mediciones, umbrales);

    if (medicionesCompletas) {
      // FN-04: Cálculo determinista exitoso
      const indiceSalud = this.calculadorSalud.calcularIndiceSaludDeterminista(mediciones);
      const estadoGlobal = this.calculadorSalud.determinarEstadoSaludGlobal(mediciones);

      return new PrevisualizacionReporteDTO({
        proyectoId,
        versionReporteSiguiente: siguienteVersion,
        estadoSaludGlobal: estadoGlobal,
        estadoIndice: 'CALCULADO',
        indiceSaludGeneral_nullable: indiceSalud,
        medicionesCompletas: true,
        desgloseImpacto: desglose,
        habilitarEspacioNotas: true
      });
    } else {
      // FA-04.01: Ausencia de datos para el cálculo
      return new PrevisualizacionReporteDTO({
        proyectoId,
        versionReporteSiguiente: siguienteVersion,
        estadoSaludGlobal: NivelSemaforo.SIN_DATOS,
        estadoIndice: 'SIN_DATOS',
        indiceSaludGeneral_nullable: null,
        medicionesCompletas: false,
        desgloseImpacto: desglose,
        habilitarEspacioNotas: true
      });
    }
  }

  async previsualizarReporte(proyectoId) {
    return this.generarPrevisualizacion(proyectoId);
  }

  async confirmarYGuardarReporte(solicitudDTO) {
    const { proyectoId } = solicitudDTO;
    const notasEjecutivas = solicitudDTO.normalizarNotasEjecutivas ? solicitudDTO.normalizarNotasEjecutivas() : solicitudDTO.notasEjecutivas_nullable;

    const umbrales = await this.servicioTablero.obtenerUmbralesVigentes(proyectoId);
    const mediciones = await this.servicioTablero.obtenerMedicionesVigentes(proyectoId);

    const medicionesCompletas = this.calculadorSalud.verificarMedicionesCompletas(mediciones);
    const indiceSalud = medicionesCompletas ? this.calculadorSalud.calcularIndiceSaludDeterminista(mediciones) : null;
    const estadoSalud = medicionesCompletas ? this.calculadorSalud.determinarEstadoSaludGlobal(mediciones) : NivelSemaforo.SIN_DATOS;
    const desglose = this.calculadorSalud.generarDesgloseImpacto(mediciones, umbrales);

    // Iniciar transacción atómica (FE-01)
    const tx = await this.gestorTx.iniciarTransaccion();

    try {
      const siguienteVersion = await this.repoCorte.obtenerSiguienteVersionReporte(proyectoId, tx);

      const reporte = new ReporteSalud({
        id: crypto.randomUUID(),
        proyectoId,
        versionReporte: siguienteVersion,
        nombreVersion: `Corte de Evaluación SQA v${siguienteVersion}`,
        estadoSalud,
        indiceSaludGeneral: indiceSalud,
        notasEjecutivas,
        desglose
      });

      // Guardar en evaluation_cutoffs
      const reporteGuardado = await this.repoCorte.guardarVersionReporteSalud(reporte, tx);

      // Compilar PDF antes de COMMIT (si falla, detona rollback en catch)
      const archivoPDF = await this.exportadorPDF.compilarPDF(reporteGuardado, desglose);

      // Si todo va bien, confirmar transacción
      await this.gestorTx.confirmarTransaccion(tx);

      return new ResultadoReporteSaludDTO({
        exito: true,
        reporteRegistrado: reporteGuardado,
        archivoPDF,
        mensaje: 'Reporte de salud generado, versionado y exportado a PDF exitosamente.',
        urlDescargaPDF: `/api/proyectos/${proyectoId}/reportes-salud/${reporteGuardado.id}/pdf`
      });
    } catch (err) {
      // FE-01: Rollback ante fallos de persistencia o compilación PDF
      console.error('[ServicioReporteSalud] Error en transacción. Ejecutando ROLLBACK:', err.message);
      await this.gestorTx.revertirTransaccion(tx);
      throw err;
    }
  }

  async generarYGuardarReporte(proyectoId, dto) {
    return this.confirmarYGuardarReporte(dto);
  }
}

module.exports = ServicioReporteSalud;
