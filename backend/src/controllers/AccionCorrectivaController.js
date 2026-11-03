const express = require('express');
const servicioGestion = require('../services/ServicioGestionAccionCorrectiva');
const servicioRegistroMetrica = require('../services/ServicioRegistroMetrica');
const alertaRepo = require('../data/AlertaDeterioroRepository');
const accionRepo = require('../data/AccionCorrectivaRepository');
const proyectoRepo = require('../data/ProyectoRepository');
const transacciones = require('../data/TransaccionManager');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function manejarError(res, err) {
  if (err.status) return res.status(err.status).json({ mensaje: err.message });
  if (err instanceof transacciones.ErrorPersistencia) {
    return res.status(500).json({ mensaje: err.message });
  }
  console.error('[AccionCorrectivaController]', err);
  return res.status(500).json({ mensaje: err.message || 'Error interno del servidor.' });
}

// FN-03: Consulta de alertas del proyecto para el tablero
async function obtenerAlertasProyecto(req, res) {
  try {
    const { proyectoId } = req.params;
    const alertas = await alertaRepo.listarPorProyecto(proyectoId);
    return res.json({ alertas });
  } catch (err) {
    return manejarError(res, err);
  }
}

// Consulta de una alerta específica con su detalle, causas y tendencia
async function obtenerAlertaPorId(req, res) {
  try {
    const { alertaId } = req.params;
    if (!UUID.test(alertaId)) return res.status(400).json({ mensaje: 'alertaId inválido.' });
    const alerta = await alertaRepo.obtenerPorId(alertaId);
    if (!alerta) return res.status(404).json({ mensaje: 'Alerta no encontrada.' });
    return res.json({ alerta });
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-06: Consulta de acciones correctivas del proyecto para darles seguimiento en el tablero
async function obtenerAccionesProyecto(req, res) {
  try {
    const { proyectoId } = req.params;
    const acciones = await accionRepo.listarPorProyecto(proyectoId);
    return res.json({ acciones });
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-05, FA-04.01, FA-05.01: Registrar nueva acción correctiva
async function crearAccionCorrectiva(req, res) {
  try {
    const proyectoId = req.params.proyectoId || req.body?.proyectoId;
    if (!proyectoId || !UUID.test(proyectoId)) {
      return res.status(400).json({ mensaje: 'proyectoId inválido o faltante.' });
    }

    const dto = { ...req.body, proyectoId };

    // Validar y ejecutar dentro de la transacción gestionada por TransaccionManager (FE-01)
    const resultado = await transacciones.ejecutar(async (tx) => {
      const resVal = await servicioGestion.registrarOActualizar(dto, tx);
      return resVal;
    });

    if (!resultado.esValido) {
      // FA-05.01: Datos incompletos o inválidos
      return res.status(400).json({
        valido: false,
        registroExitoso: false,
        mensaje: 'Datos de la acción correctiva incompletos o inválidos.',
        errores: resultado.errores,
      });
    }

    return res.status(201).json({
      registroExitoso: true,
      valido: true,
      mensaje: 'Acción correctiva registrada exitosamente en estado abierta.',
      accion: resultado.accion,
    });
  } catch (err) {
    return manejarError(res, err);
  }
}

// Actualizar acción correctiva existente (FA-07.01 replanteamiento)
async function actualizarAccionCorrectiva(req, res) {
  try {
    const { accionId } = req.params;
    if (!UUID.test(accionId)) return res.status(400).json({ mensaje: 'accionId inválido.' });

    const accionExistente = await accionRepo.obtenerPorId(accionId);
    if (!accionExistente) {
      return res.status(404).json({ mensaje: 'Acción correctiva no encontrada.' });
    }

    const dto = {
      ...req.body,
      id: accionId,
      proyectoId: accionExistente.proyectoId,
      tipoMetrica: accionExistente.tipoMetrica,
      alertaId: accionExistente.alertaId,
    };

    const resultado = await transacciones.ejecutar(async (tx) => {
      return servicioGestion.registrarOActualizar(dto, tx);
    });

    if (!resultado.esValido) {
      return res.status(400).json({
        valido: false,
        actualizacionExitosa: false,
        mensaje: 'Datos de la acción correctiva inválidos.',
        errores: resultado.errores,
      });
    }

    return res.status(200).json({
      actualizacionExitosa: true,
      valido: true,
      mensaje: 'Acción correctiva replanteada y actualizada exitosamente.',
      accion: resultado.accion,
    });
  } catch (err) {
    return manejarError(res, err);
  }
}

// Endpoint para registrar una medición y activar el procesamiento de CU-06 (SRM -> SG)
async function procesarMedicionEndpoint(req, res) {
  try {
    const { proyectoId } = req.params;
    const dto = { ...req.body, proyectoId };

    const resultado = await transacciones.ejecutar(async (tx) => {
      return servicioRegistroMetrica.registrarMedicion(dto, tx);
    });

    return res.status(200).json({
      procesado: true,
      ...resultado,
    });
  } catch (err) {
    return manejarError(res, err);
  }
}

const router = express.Router();

router.get('/proyectos/:proyectoId/alertas', obtenerAlertasProyecto);
router.get('/alertas/:alertaId', obtenerAlertaPorId);
router.get('/proyectos/:proyectoId/acciones-correctivas', obtenerAccionesProyecto);
router.post('/proyectos/:proyectoId/acciones-correctivas', crearAccionCorrectiva);
router.post('/acciones-correctivas', crearAccionCorrectiva);
router.put('/acciones-correctivas/:accionId', actualizarAccionCorrectiva);
router.post('/proyectos/:proyectoId/mediciones', procesarMedicionEndpoint);

module.exports = router;

