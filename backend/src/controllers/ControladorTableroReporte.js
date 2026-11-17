const ServicioTableroSalud = require('../services/ServicioTableroSalud');
const ServicioReporteSalud = require('../services/ServicioReporteSalud');
const { SolicitudReporteSaludDTO } = require('../domain/dtos');

class ControladorTableroReporte {
  constructor(
    servicioTablero = new ServicioTableroSalud(),
    servicioReporte = new ServicioReporteSalud()
  ) {
    this.servicioTablero = servicioTablero;
    this.servicioReporte = servicioReporte;
  }

  // FN-01 & FN-02: Consulta del tablero principal
  async obtenerTablero(req, res) {
    try {
      const { proyectoId } = req.params;
      if (!proyectoId) {
        return res.status(400).json({ error: 'El parámetro proyectoId es requerido' });
      }

      const tablero = await this.servicioTablero.consultarTableroConsolidado(proyectoId);
      return res.status(200).json(tablero);
    } catch (err) {
      console.error('[ControladorTableroReporte] Error en obtenerTablero:', err);
      return res.status(err.message.includes('no encontrado') ? 404 : 500).json({
        error: err.message || 'Error interno al consultar el tablero principal'
      });
    }
  }

  // FN-03, FN-04, FA-04.01, FN-05: Previsualización del reporte
  async previsualizarReporteSalud(req, res) {
    try {
      const { proyectoId } = req.params;
      if (!proyectoId) {
        return res.status(400).json({ error: 'El parámetro proyectoId es requerido' });
      }

      const previsualizacion = await this.servicioReporte.generarPrevisualizacion(proyectoId);
      return res.status(200).json(previsualizacion);
    } catch (err) {
      console.error('[ControladorTableroReporte] Error en previsualizarReporteSalud:', err);
      return res.status(500).json({
        error: err.message || 'Error interno al generar la previsualización del reporte'
      });
    }
  }

  // FN-06, FA-06.01, FN-07, FE-01: Confirmar y generar reporte versionado + PDF
  async generarReporteSaludPDF(req, res) {
    try {
      const { proyectoId } = req.params;
      const { notasEjecutivas } = req.body || {};

      if (!proyectoId) {
        return res.status(400).json({ error: 'El parámetro proyectoId es requerido' });
      }

      const dto = new SolicitudReporteSaludDTO(proyectoId, notasEjecutivas);
      const resultado = await this.servicioReporte.confirmarYGuardarReporte(dto);

      return res.status(201).json(resultado);
    } catch (err) {
      console.error('[ControladorTableroReporte] Error en generarReporteSaludPDF (FE-01):', err);
      return res.status(500).json({
        error: 'Error al generar o guardar el reporte de salud. Por favor, reintente.',
        detalleTecnico: err.message,
        codigoError: err.codigoError || 'ERR_INTERNAL'
      });
    }
  }
}

module.exports = ControladorTableroReporte;
