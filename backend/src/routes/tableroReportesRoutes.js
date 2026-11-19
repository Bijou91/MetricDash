const express = require('express');
const ControladorTableroReporte = require('../controllers/ControladorTableroReporte');
const RepositorioProyecto = require('../persistence/RepositorioProyecto');
const RepositorioReporteSalud = require('../persistence/RepositorioReporteSalud');

const router = express.Router();
const controlador = new ControladorTableroReporte();
const repoProyecto = new RepositorioProyecto();
const repoReportes = new RepositorioReporteSalud();

// Listado de proyectos disponibles (para facilitar navegación en frontend)
router.get('/proyectos', async (req, res) => {
  try {
    const proyectos = await repoProyecto.listarProyectos();
    res.json(proyectos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// FN-01 & FN-02: Consulta del tablero consolidado
router.get('/proyectos/:proyectoId/tablero-salud', (req, res) => {
  controlador.obtenerTablero(req, res);
});

// FN-03, FN-04, FA-04.01, FN-05: Previsualización de reporte
router.get('/proyectos/:proyectoId/reportes-salud/previsualizacion', (req, res) => {
  controlador.previsualizarReporteSalud(req, res);
});

// FN-06, FA-06.01, FN-07, FE-01: Confirmar y guardar reporte + exportar PDF
router.post('/proyectos/:proyectoId/reportes-salud', (req, res) => {
  controlador.generarReporteSaludPDF(req, res);
});

// Endpoint complementario: Historial de reportes versionados del proyecto
router.get('/proyectos/:proyectoId/reportes-salud/historial', async (req, res) => {
  try {
    const { proyectoId } = req.params;
    const historial = await repoReportes.listarHistorialReportes(proyectoId);
    res.json(historial);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Descarga del PDF de un reporte previo
router.get('/proyectos/:proyectoId/reportes-salud/:reporteId/pdf', (req, res) => {
  controlador.descargarPDFReporte(req, res);
});

module.exports = router;
