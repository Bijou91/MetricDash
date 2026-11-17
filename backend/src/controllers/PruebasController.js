const express = require('express');
const servicioPruebas = require('../services/ServicioRegistroPruebas');
const { ErrorPersistencia } = require('../data/TransaccionManager');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function manejarError(res, err) {
  if (err.status) return res.status(err.status).json({ mensaje: err.message });
  if (err instanceof ErrorPersistencia) return res.status(500).json({ mensaje: err.message });
  console.error('[PruebasController]', err);
  return res.status(500).json({ mensaje: 'Error interno del servidor.' });
}

// FN-01: Carga el proyecto activo, la lista de cortes disponibles y los umbrales vigentes.
async function obtenerCortes(req, res) {
  try {
    const contexto = await servicioPruebas.cargarContexto(req.params.proyectoId);
    return res.status(200).json(contexto);
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-02 a FN-07, FA-02.01, FA-03.01, FA-06.01 y FE-01.
async function registrarRonda(req, res) {
  try {
    const { proyectoId } = req.params;
    const dto = { ...req.body, proyectoId };
    const { httpStatus, resultado } = await servicioPruebas.registrar(proyectoId, dto);
    return res.status(httpStatus).json(resultado);
  } catch (err) {
    return manejarError(res, err);
  }
}

const router = express.Router();
router.param('proyectoId', (req, res, next, id) =>
  (UUID.test(id) ? next() : res.status(400).json({ mensaje: 'proyectoId inválido.' })));
router.get('/proyectos/:proyectoId/cortes', obtenerCortes);
router.post('/proyectos/:proyectoId/pruebas', registrarRonda);

module.exports = router;

