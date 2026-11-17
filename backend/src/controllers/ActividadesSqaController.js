const express = require('express');
const planificacionService = require('../services/PlanificacionActividadService');
const ejecucionService = require('../services/EjecucionActividadService');
const actividadRepo = require('../data/ActividadSqaRepository');
const proyectoRepo = require('../data/ProyectoRepository');
const configRepo = require('../data/ConfiguracionMetricasRepository');
const pruebasRepo = require('../data/PruebasRepository');
const revisionRepo = require('../data/RevisionRepository');
const servicioMetricas = require('../services/ServicioCalculoMetricas');
const servicioEvaluar = require('../services/ServicioEvaluarMetricas');
const { ErrorPersistencia } = require('../data/TransaccionManager');
const { TipoMetrica } = require('../services/entidades/metricas');
const { NivelSemaforo } = require('../services/entidades/proyecto');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function manejarError(res, err) {
  if (err.status) return res.status(err.status).json({ mensaje: err.message });
  if (err instanceof ErrorPersistencia) return res.status(500).json({ mensaje: err.message });
  console.error('[ActividadesSqaController]', err);
  return res.status(500).json({ mensaje: 'Error interno del servidor.' });
}

// FN-01: Obtiene el plan base de actividades SQA del proyecto junto con miembros, periodo activo,
// rondas de pruebas disponibles y métricas actuales para TableroSqaWidget.
async function getPlan(req, res) {
  try {
    const { proyectoId } = req.params;
    const proyecto = await proyectoRepo.obtenerProyectoPeriodoActual();
    if (!proyecto || proyecto.id !== proyectoId) {
      return res.status(404).json({ mensaje: 'No existe un proyecto activo con ese identificador en el periodo en curso.' });
    }

    const [umbralCump, umbralDen, umbralCob, umbralTasa, periodo, miembros, plan, rondas, corte] = await Promise.all([
      configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.CUMPLIMIENTO_SQA),
      configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.DENSIDAD_DEFECTOS),
      configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.COBERTURA_PRUEBAS),
      configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.TASA_EXITO_PRUEBAS),
      proyectoRepo.obtenerPeriodoActivo(),
      proyectoRepo.obtenerMiembros(proyectoId),
      actividadRepo.obtenerPlan(proyectoId),
      pruebasRepo.listarPorProyecto ? pruebasRepo.listarPorProyecto(proyectoId) : Promise.resolve([]),
      proyectoRepo.obtenerCorteActual(proyectoId),
    ]);

    if (!umbralCump) {
      return res.status(409).json({
        mensaje: 'Primero configure las métricas de calidad y sus umbrales antes de gestionar las actividades SQA.',
      });
    }

    const medicionCump = await servicioMetricas.recalcularCumplimientoSQA(proyecto);
    const medicionDen = await servicioMetricas.recalcularDensidadDefectos(proyecto);
    const estCump = medicionCump.actividadesRealizadas > 0 && medicionCump.actividadesExigibles > 0 && umbralCump
      ? servicioEvaluar.determinarEstadoSemaforo(medicionCump.valorCalculado, umbralCump)
      : NivelSemaforo.SIN_DATOS;
    const estDen = medicionDen.totalDefectos > 0 && umbralDen
      ? servicioEvaluar.determinarEstadoSemaforo(medicionDen.valorCalculado, umbralDen)
      : NivelSemaforo.SIN_DATOS;

    const medCorte = corte && configRepo.obtenerMedicion ? await configRepo.obtenerMedicion(corte.id) : null;
    const estCob = medCorte?.test_coverage_pct != null && umbralCob
      ? servicioEvaluar.determinarEstadoSemaforo(Number(medCorte.test_coverage_pct), umbralCob)
      : null;
    const estTasa = medCorte?.test_pass_rate_pct != null && umbralTasa
      ? servicioEvaluar.determinarEstadoSemaforo(Number(medCorte.test_pass_rate_pct), umbralTasa)
      : null;

    const nivelSemaforo = servicioEvaluar.calcularNivelGlobal(
      estCump,
      estDen,
      estCob,
      estTasa,
    );

    return res.status(200).json({
      proyecto: {
        id: proyecto.id,
        nombre: proyecto.name,
        tamanoProductoKLOC: Number(proyecto.estimated_kloc),
      },
      periodo: periodo ? {
        id: periodo.id,
        codigo: periodo.code,
        nombre: periodo.name,
        fechaInicio: periodo.start_date,
        fechaFin: periodo.end_date,
      } : null,
      miembros: (miembros || []).map((m) => ({
        id: m.id,
        nombre: m.member_name,
        rol: m.role,
        email: m.email,
      })),
      plan,
      rondasPruebas: rondas,
      indicadores: {
        cumplimientoSQA: medicionCump.valorCalculado,
        actividadesExigibles: medicionCump.actividadesExigibles,
        actividadesRealizadas: medicionCump.actividadesRealizadas,
        estadoCumplimiento: estCump,
        densidadDefectos: medicionDen.valorCalculado,
        totalDefectos: medicionDen.totalDefectos,
        estadoDensidad: estDen,
        nivelSemaforo,
      },
    });
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-02 / FN-03 / FA-02.01 / FA-03.01 / FE-01: Planifica una actividad SQA.
async function postPlanificacion(req, res) {
  try {
    const { proyectoId, actividadId } = req.params;
    const dto = { ...req.body, actividadId: actividadId || req.body?.actividadId };
    const resultado = await planificacionService.planificarActividad(proyectoId, dto);
    if (!resultado.valido) {
      return res.status(400).json(resultado);
    }
    return res.status(200).json(resultado);
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-04: Inicia una actividad SQA y devuelve su checklist ítem por ítem (o datos para evidencia en PRUEBAS/AUDITORIA).
async function postInicio(req, res) {
  try {
    const { actividadId } = req.params;
    const checklist = await ejecucionService.iniciarActividad(actividadId);
    return res.status(200).json(checklist);
  } catch (err) {
    return manejarError(res, err);
  }
}

// FN-05 a FN-09 / FA-05.01 / FA-06.01 / FA-09.01 / FE-01: Cierra una revisión por pares.
async function postCierre(req, res) {
  try {
    const { actividadId } = req.params;
    const dto = { ...req.body, actividadId };
    const { httpStatus, resultado } = await ejecucionService.cerrarRevision(actividadId, dto);
    return res.status(httpStatus).json(resultado);
  } catch (err) {
    return manejarError(res, err);
  }
}

// FA-04.01: Registra la evidencia de una actividad de PRUEBAS o AUDITORIA y la marca como realizada.
async function postEvidencia(req, res) {
  try {
    const { actividadId } = req.params;
    const dto = { ...req.body, actividadId };
    const { httpStatus, resultado } = await ejecucionService.registrarEvidenciaPruebasAuditoria(actividadId, dto);
    return res.status(httpStatus).json(resultado);
  } catch (err) {
    return manejarError(res, err);
  }
}

// Consulta el acta emitida de una revisión por pares ya cerrada.
async function getActa(req, res) {
  try {
    const { actividadId } = req.params;
    const acta = await revisionRepo.obtenerActaPorActividad(actividadId);
    if (!acta) {
      return res.status(404).json({ mensaje: 'No existe un acta emitida para esta actividad.' });
    }
    return res.status(200).json(acta);
  } catch (err) {
    return manejarError(res, err);
  }
}

const router = express.Router();
router.param('proyectoId', (req, res, next, id) =>
  (UUID.test(id) ? next() : res.status(400).json({ mensaje: 'proyectoId inválido.' })));
router.param('actividadId', (req, res, next, id) =>
  (UUID.test(id) ? next() : res.status(400).json({ mensaje: 'actividadId inválido.' })));

router.get('/proyectos/:proyectoId/actividades-sqa', getPlan);
router.post('/proyectos/:proyectoId/actividades-sqa/planificar', postPlanificacion);
router.post('/proyectos/:proyectoId/actividades-sqa/:actividadId/planificar', postPlanificacion);
router.post('/actividades-sqa/:actividadId/iniciar', postInicio);
router.post('/actividades-sqa/:actividadId/cerrar', postCierre);
router.post('/actividades-sqa/:actividadId/evidencia', postEvidencia);
router.get('/actividades-sqa/:actividadId/acta', getActa);

module.exports = router;

