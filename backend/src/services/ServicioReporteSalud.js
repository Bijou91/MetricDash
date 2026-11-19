const crypto = require('crypto');
const ServicioTableroSalud = require('./ServicioTableroSalud');
const CalculadorIndiceSalud = require('./CalculadorIndiceSalud');
const ExportadorReportePDF = require('./ExportadorReportePDF');
const RepositorioReporteSalud = require('../persistence/RepositorioReporteSalud');
const GestorTransacciones = require('../persistence/GestorTransacciones');
const { ReporteSalud, NivelSemaforo, EstadoIndice } = require('../domain/models');
const { PrevisualizacionReporteDTO, ResultadoReporteSaludDTO } = require('../domain/dtos');

class ServicioReporteSalud {
  constructor(
    servicioTablero = new ServicioTableroSalud(),
    calculadorSalud = new CalculadorIndiceSalud(),
    exportadorPDF = new ExportadorReportePDF(),
    repoReporte = new RepositorioReporteSalud(),
    gestorTx = new GestorTransacciones()
  ) {
    this.servicioTablero = servicioTablero;
    this.calculadorSalud = calculadorSalud;
    this.exportadorPDF = exportadorPDF;
    this.repoReporte = repoReporte;
    this.gestorTx = gestorTx;
  }

  async generarPrevisualizacion(proyectoId) {
    const umbrales = await this.servicioTablero.obtenerUmbralesVigentes(proyectoId);
    const mediciones = await this.servicioTablero.obtenerMedicionesVigentes(proyectoId, umbrales);
    const estadoIndice = this.calculadorSalud.determinarEstadoIndice(mediciones);
    const medicionesCompletas = estadoIndice === EstadoIndice.CALCULADO;

    const siguienteVersion = await this.repoReporte.obtenerSiguienteVersionReporte(proyectoId);
    // El desglose siempre trae las 4 métricas; la que no tiene medición queda como SIN_DATOS.
    const desglose = this.calculadorSalud.generarDesgloseImpacto(mediciones, umbrales);

    return new PrevisualizacionReporteDTO({
      proyectoId,
      versionReporteSiguiente: siguienteVersion,
      estadoSaludGlobal: medicionesCompletas
        ? this.calculadorSalud.determinarEstadoSaludGlobal(mediciones)
        : NivelSemaforo.SIN_DATOS,
      estadoIndice,
      indiceSaludGeneral_nullable: medicionesCompletas
        ? this.calculadorSalud.calcularIndiceSaludDeterminista(mediciones)
        : null,
      medicionesCompletas,
      desgloseImpacto: desglose,
      habilitarEspacioNotas: true
    });
  }

  async previsualizarReporte(proyectoId) {
    return this.generarPrevisualizacion(proyectoId);
  }

  async confirmarYGuardarReporte(solicitudDTO) {
    const { proyectoId } = solicitudDTO;
    const notasEjecutivas = solicitudDTO.normalizarNotasEjecutivas ? solicitudDTO.normalizarNotasEjecutivas() : solicitudDTO.notasEjecutivas_nullable;

    const umbrales = await this.servicioTablero.obtenerUmbralesVigentes(proyectoId);
    const mediciones = await this.servicioTablero.obtenerMedicionesVigentes(proyectoId, umbrales);

    const estadoIndice = this.calculadorSalud.determinarEstadoIndice(mediciones);
    const medicionesCompletas = estadoIndice === EstadoIndice.CALCULADO;
    const indiceSalud = medicionesCompletas ? this.calculadorSalud.calcularIndiceSaludDeterminista(mediciones) : null;
    const estadoSalud = medicionesCompletas ? this.calculadorSalud.determinarEstadoSaludGlobal(mediciones) : NivelSemaforo.SIN_DATOS;
    const desglose = this.calculadorSalud.generarDesgloseImpacto(mediciones, umbrales);

    // Iniciar transacción atómica (FE-01)
    const tx = await this.gestorTx.iniciarTransaccion();

    try {
      const siguienteVersion = await this.repoReporte.obtenerSiguienteVersionReporte(proyectoId, tx);

      const reporte = new ReporteSalud({
        id: crypto.randomUUID(),
        proyectoId,
        versionReporte: siguienteVersion,
        nombreVersion: `Reporte de Salud #${siguienteVersion}`,
        estadoSalud,
        estadoIndice,
        indiceSaludGeneral: indiceSalud,
        notasEjecutivas,
        desglose
      });

      // Guardar en el historial propio de reportes (health_reports); los cortes CP1-CP4 no se tocan
      const reporteGuardado = await this.repoReporte.guardarVersionReporteSalud(reporte, tx);

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

  // Vuelve a compilar el PDF de un reporte ya guardado a partir de su desglose almacenado.
  async regenerarPDF(proyectoId, reporteId) {
    const reporte = await this.repoReporte.obtenerReportePorId(proyectoId, reporteId);
    if (!reporte) return null;
    return this.exportadorPDF.compilarPDF(reporte, reporte.desglose);
  }

  async generarYGuardarReporte(proyectoId, dto) {
    return this.confirmarYGuardarReporte(dto);
  }
}

module.exports = ServicioReporteSalud;
