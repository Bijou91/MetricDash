const express = require('express');
const servicioActividades = require('../services/ServicioActividadesSQA');
const { ErrorPersistencia } = require('../data/TransaccionManager');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function manejarError(res, err) {
  if (err.status) {
    return res.status(err.status).json({
      mensaje: err.message,
      errores: err.errores || undefined,
    });
  }
  if (err instanceof ErrorPersistencia) {
    return res.status(500).json({ mensaje: err.message });
  }
  console.error('[ActividadSQAController]', err);
  return res.status(500).json({ mensaje: 'Error interno del servidor.' });
}

// FN-01: Cargar actividades SQA, miembros, umbrales y estado de cumplimiento
async function obtenerContexto(req, res) {
  try {
    const contexto = await servicioActividades.cargarContexto(req.params.proyectoId);
    return res.status(200).json(contexto);
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-02 / FN-03 / FA-02.01 / FA-03.01: Planificar actividad SQA
async function planificarActividad(req, res) {
  try {
    const { proyectoId, actividadId } = req.params;
    const resultado = await servicioActividades.planificar(proyectoId, actividadId, req.body);
    return res.status(200).json(resultado);
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-04: Obtener checklist del artefacto para la actividad
async function obtenerChecklist(req, res) {
  try {
    const { actividadId } = req.params;
    const resultado = await servicioActividades.obtenerChecklist(actividadId);
    return res.status(200).json(resultado);
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-06 / FA-06.01: Analizar posibles duplicados en hallazgos
async function buscarDuplicados(req, res) {
  try {
    const { proyectoId, actividadId } = req.params;
    const { hallazgos } = req.body;
    const resultado = await servicioActividades.buscarDuplicadosHallazgos(proyectoId, actividadId, hallazgos || []);
    return res.status(200).json({ hallazgos: resultado });
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-07 / FN-08 / FN-09 / FA-06.01 / FA-09.01 / FE-01: Cerrar revisión por pares
async function cerrarRevision(req, res) {
  try {
    const { proyectoId, actividadId } = req.params;
    const resultado = await servicioActividades.cerrarRevision(proyectoId, actividadId, req.body);
    return res.status(201).json(resultado);
  } catch (err) {
    return manejarError(res, err);
  }
}

// FA-04.01 / FN-08 / FN-09: Cerrar actividad de pruebas o auditoría con evidencia
async function cerrarEvidencia(req, res) {
  try {
    const { proyectoId, actividadId } = req.params;
    const resultado = await servicioActividades.cerrarEvidencia(proyectoId, actividadId, req.body);
    return res.status(200).json(resultado);
  } catch (err) {
    return manejarError(res, err);
  }
}

const router = express.Router();

router.param('proyectoId', (req, res, next, id) =>
  (UUID.test(id) ? next() : res.status(400).json({ mensaje: 'proyectoId inválido.' })));

router.param('actividadId', (req, res, next, id) =>
  (UUID.test(id) ? next() : res.status(400).json({ mensaje: 'actividadId inválido.' })));

router.get('/proyectos/:proyectoId/actividades-sqa', obtenerContexto);
router.put('/proyectos/:proyectoId/actividades-sqa/:actividadId/planificar', planificarActividad);
router.get('/proyectos/:proyectoId/actividades-sqa/:actividadId/checklist', obtenerChecklist);
router.post('/proyectos/:proyectoId/actividades-sqa/:actividadId/buscar-duplicados', buscarDuplicados);
router.post('/proyectos/:proyectoId/actividades-sqa/:actividadId/cerrar-revision', cerrarRevision);
router.post('/proyectos/:proyectoId/actividades-sqa/:actividadId/cerrar-evidencia', cerrarEvidencia);

module.exports = router;
