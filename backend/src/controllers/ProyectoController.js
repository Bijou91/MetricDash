const express = require('express');
const service = require('../services/RegistroProyectoService');
const proyectoRepo = require('../data/ProyectoRepository');
const { ErrorPersistencia } = require('../data/TransaccionManager');
const { ProyectoExistenteException } = require('../services/entidades/proyecto');

function manejarError(res, err) {
  if (err.resultado) {
    return res.status(400).json({
      valido: false,
      mensaje: 'Datos o roles incompletos (FA-02.02).',
      errores: err.resultado.errores,
    });
  }
  if (err instanceof ProyectoExistenteException || err.status === 409) {
    return res.status(409).json({
      valido: false,
      limiteExcedido: true,
      mensaje: err.message,
    });
  }
  if (err.status) {
    return res.status(err.status).json({ mensaje: err.message });
  }
  if (err instanceof ErrorPersistencia) {
    return res.status(500).json({ mensaje: err.message });
  }
  console.error('[ProyectoController]', err);
  return res.status(500).json({ mensaje: 'Error interno del servidor.' });
}

// FN-01 a FN-05: Registrar proyecto y generar plan base de QA
async function postProyecto(req, res) {
  try {
    const resultado = await service.registrarProyecto(req.body);
    return res.status(201).json(resultado);
  } catch (err) {
    return manejarError(res, err);
  }
}

// Consultar periodo activo y si ya tiene proyecto registrado
async function getPeriodoActivo(req, res) {
  try {
    const periodo = await proyectoRepo.obtenerPeriodoActivo();
    if (!periodo) {
      return res.status(404).json({ mensaje: 'No hay periodo académico activo en el sistema.' });
    }
    const existe = await proyectoRepo.existeProyectoEnPeriodo(periodo.id);
    return res.json({
      periodo,
      tieneProyectoRegistrado: existe,
    });
  } catch (err) {
    return manejarError(res, err);
  }
}

// Consultar el proyecto activo del periodo en curso
async function getProyectoActivo(req, res) {
  try {
    const proyecto = await proyectoRepo.obtenerProyectoPeriodoActivo();
    if (!proyecto) {
      return res.status(404).json({
        existe: false,
        mensaje: 'No hay ningún proyecto registrado para el periodo actual. El sistema está listo para registrar el proyecto inicial.',
      });
    }

    const miembros = await proyectoRepo.obtenerMiembros(proyecto.id);
    const actividades = await proyectoRepo.obtenerActividadesQA(proyecto.id);
    const lineaBase = await proyectoRepo.obtenerLineaBase(proyecto.id);
    const corteInicial = await proyectoRepo.obtenerCorteInicial(proyecto.id);

    return res.json({
      existe: true,
      proyecto,
      roles: miembros,
      planQA: {
        totalActividades: actividades.length,
        actividades,
      },
      lineaBase,
      tableroInicial: corteInicial,
    });
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-03: Previsualizar propuesta de Plan de QA antes de confirmar
async function getPropuestaPlan(req, res) {
  try {
    const generadorPlan = require('../services/GeneradorPlanQA');
    const tipo = req.query.tipoProyecto || 'DESARROLLO_NUEVO';
    const plan = generadorPlan.generarPlanBase(tipo);
    return res.json(plan);
  } catch (err) {
    return manejarError(res, err);
  }
}

// Actualizar estado de una actividad SQA
async function patchActividad(req, res) {
  try {
    const { actividadId } = req.params;
    const { status } = req.body;
    const actividadActualizada = await proyectoRepo.actualizarEstadoActividad(actividadId, status);
    if (!actividadActualizada) {
      return res.status(404).json({ mensaje: 'Actividad no encontrada.' });
    }
    return res.json(actividadActualizada);
  } catch (err) {
    return manejarError(res, err);
  }
}

// Eliminar proyecto (para reiniciar pruebas o entorno de desarrollo)
async function deleteProyecto(req, res) {
  try {
    const { id } = req.params;
    await proyectoRepo.eliminarProyecto(id);
    return res.json({ mensaje: 'Proyecto eliminado exitosamente para permitir nuevo registro.' });
  } catch (err) {
    return manejarError(res, err);
  }
}

const router = express.Router();
router.get('/proyectos/propuesta-plan', getPropuestaPlan);
router.post('/proyectos', postProyecto);
router.get('/proyectos/activo', getProyectoActivo);
router.delete('/proyectos/:id', deleteProyecto);
router.patch('/proyectos/actividades/:actividadId', patchActividad);
router.get('/periodos/activo', getPeriodoActivo);

module.exports = router;
