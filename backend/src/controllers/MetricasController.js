const express = require('express');
const service = require('../services/ConfiguracionMetricasService');
const configRepo = require('../repositories/ConfiguracionMetricasRepository');
const { ErrorPersistencia } = require('../domain/metricas');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const aDTO = (c) => c && {
  id: c.id,
  proyectoId: c.proyectoId,
  version: c.version,
  vigente: c.vigente,
  fechaCreacion: c.fechaCreacion,
  metricas: c.metricas.map(({ tipo, meta, umbralAdvertencia, umbralCritico, sentido, unidad }) =>
    ({ tipo, meta, umbralAdvertencia, umbralCritico, sentido, unidad })),
};

// FA-02.02 → 400; FA-02.01 → 422.
const responderInvalido = (res, { incompleto, errores }) =>
  res.status(incompleto ? 400 : 422).json({ valido: false, errores });

function manejarError(res, err) {
  if (err.resultado) return responderInvalido(res, err.resultado);
  if (err.status) return res.status(err.status).json({ mensaje: err.message });
  if (err instanceof ErrorPersistencia) return res.status(500).json({ mensaje: err.message });
  console.error('[MetricasController]', err);
  return res.status(500).json({ mensaje: 'Error interno del servidor.' });
}

async function getVigente(req, res) {
  try {
    res.json(aDTO(await configRepo.obtenerVigente(req.params.proyectoId)));
  } catch (err) {
    manejarError(res, err);
  }
}

async function postValidacion(req, res) {
  try {
    const resultado = await service.validar(req.params.proyectoId, req.body);
    if (!resultado.valido) return responderInvalido(res, resultado);
    res.json({ valido: true, errores: [], vistaPrevia: service.generarVistaPrevia(resultado.metricas) });
  } catch (err) {
    manejarError(res, err);
  }
}

async function postConfiguracion(req, res) {
  try {
    // shortcut: sin autenticación aún; el usuario llega por cabecera opcional. Sustituir por el usuario de la sesión.
    const usuarioId = UUID.test(req.get('x-usuario-id') ?? '') ? req.get('x-usuario-id') : null;
    res.status(201).json(aDTO(await service.guardarVersionada(req.params.proyectoId, req.body, usuarioId)));
  } catch (err) {
    manejarError(res, err);
  }
}

const router = express.Router();
router.param('proyectoId', (req, res, next, id) =>
  (UUID.test(id) ? next() : res.status(400).json({ mensaje: 'proyectoId inválido.' })));
router.get('/proyectos/:proyectoId/metricas/vigente', getVigente);
router.post('/proyectos/:proyectoId/metricas/validar', postValidacion);
router.post('/proyectos/:proyectoId/metricas', postConfiguracion);

module.exports = router;
