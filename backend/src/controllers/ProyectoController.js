const express = require('express');
const service = require('../services/RegistroProyectoService');
const proyectoRepo = require('../data/ProyectoRepository');
const configRepo = require('../data/ConfiguracionMetricasRepository');
const evaluarMetricas = require('../services/ServicioEvaluarMetricas');
const { TipoMetrica } = require('../services/entidades/metricas');
const { NivelSemaforo, ProyectoExistenteException } = require('../services/entidades/proyecto');
const { ErrorPersistencia } = require('../data/TransaccionManager');

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

    // Enriquecer el tablero con las mediciones por corte (CP1 a CP4) y las últimas mediciones consolidadas
    const cortes = proyectoRepo.listarCortes ? await proyectoRepo.listarCortes(proyecto.id) : (corteInicial ? [corteInicial] : []);
    const configVigente = configRepo.obtenerVigente ? await configRepo.obtenerVigente(proyecto.id) : null;
    const umbralDe = (tipo) => configVigente?.metricas?.find((x) => x.tipo === tipo) || null;
    const evaluarSiHay = (valor, tipo) => {
      if (valor == null) return NivelSemaforo.SIN_DATOS;
      const u = umbralDe(tipo);
      return u ? evaluarMetricas.determinarEstadoSemaforo(Number(valor), u) : NivelSemaforo.SIN_DATOS;
    };

    const totalActs = actividades.length;
    const ejecutadasActs = actividades.filter((a) => ['DONE', 'REALIZADA'].includes(String(a.status).toUpperCase())).length;
    const cumplimientoProyecto = totalActs > 0 ? Math.round((ejecutadasActs / totalActs) * 10000) / 100 : null;

    const FASE_POR_CORTE = {
      1: 'ANALISIS_REQUERIMIENTOS',
      2: 'DISENO_COMPONENTES',
      3: 'CONSTRUCCION_SOFTWARE',
      4: 'INTEGRACION_Y_PRUEBAS',
    };

    let valDensidad = null;
    let valCobertura = null;
    let valTasaExito = null;
    let ultimoHealthStatus = null;

    const cortesDetallados = [];

    for (const c of (cortes || [])) {
      const m = configRepo.obtenerMedicion ? await configRepo.obtenerMedicion(c.id) : null;
      const numCorte = Number(c.cutoff_number);
      const faseCorte = FASE_POR_CORTE[numCorte];
      const actsFase = faseCorte ? actividades.filter((a) => a.phase === faseCorte) : [];
      const planeadasCorte = actsFase.length > 0 ? actsFase.length : (c.planned_sqa_acts ?? totalActs);
      const ejecutadasCorte = actsFase.filter((a) => ['DONE', 'REALIZADA'].includes(String(a.status).toUpperCase())).length;
      const cumplimientoFase = planeadasCorte > 0
        ? Math.round((ejecutadasCorte / planeadasCorte) * 10000) / 100
        : null;

      const denC = m?.defect_density != null ? Number(m.defect_density) : null;
      const cobC = m?.test_coverage_pct != null ? Number(m.test_coverage_pct) : null;
      const tasaC = m?.test_pass_rate_pct != null ? Number(m.test_pass_rate_pct) : null;
      const cumpC = cumplimientoFase;

      if (denC != null) valDensidad = denC;
      if (cobC != null) valCobertura = cobC;
      if (tasaC != null) valTasaExito = tasaC;
      if (m?.health_status && m.health_status !== NivelSemaforo.SIN_DATOS) {
        ultimoHealthStatus = m.health_status;
      }

      const estDenC = evaluarSiHay(denC, TipoMetrica.DENSIDAD_DEFECTOS);
      const estCobC = evaluarSiHay(cobC, TipoMetrica.COBERTURA_PRUEBAS);
      const estTasaC = evaluarSiHay(tasaC, TipoMetrica.TASA_EXITO_PRUEBAS);
      const estCumpC = ejecutadasCorte > 0
        ? evaluarSiHay(cumpC, TipoMetrica.CUMPLIMIENTO_SQA)
        : NivelSemaforo.SIN_DATOS;

      const saludCorte = evaluarMetricas.calcularNivelGlobal(
        estDenC,
        estCobC,
        estTasaC,
        estCumpC,
      );

      cortesDetallados.push({
        id: c.id,
        cutoff_number: c.cutoff_number,
        cutoff_name: c.cutoff_name,
        cutoff_date: c.cutoff_date,
        phase: faseCorte,
        kloc: c.kloc,
        planned_sqa_acts: planeadasCorte,
        executed_sqa_acts: ejecutadasCorte,
        tieneMediciones: Boolean((m && (denC != null || cobC != null || tasaC != null)) || ejecutadasCorte > 0),
        health_status: saludCorte !== NivelSemaforo.SIN_DATOS ? saludCorte : NivelSemaforo.SIN_DATOS,
        indicadores: {
          densidadDefectos: { valor: denC, estado: estDenC, unidad: 'def/KLOC' },
          coberturaPruebas: { valor: cobC, estado: estCobC, unidad: '%' },
          tasaExitoPruebas: { valor: tasaC, estado: estTasaC, unidad: '%' },
          cumplimientoSqa: { valor: cumpC, estado: estCumpC, unidad: '%' },
        },
      });
    }

    const cumplimientoCalc = cumplimientoProyecto;

    const estDensidad = evaluarSiHay(valDensidad, TipoMetrica.DENSIDAD_DEFECTOS);
    const estCobertura = evaluarSiHay(valCobertura, TipoMetrica.COBERTURA_PRUEBAS);
    const estTasaExito = evaluarSiHay(valTasaExito, TipoMetrica.TASA_EXITO_PRUEBAS);
    const estCumplimiento = ejecutadasActs > 0
      ? evaluarSiHay(cumplimientoCalc, TipoMetrica.CUMPLIMIENTO_SQA)
      : NivelSemaforo.SIN_DATOS;
    const estadoGlobal = evaluarMetricas.calcularNivelGlobal(
      estDensidad,
      estCobertura,
      estTasaExito,
      estCumplimiento,
      ultimoHealthStatus,
    );

    const tableroEnriquecido = corteInicial ? {
      ...corteInicial,
      planned_sqa_acts: totalActs,
      executed_sqa_acts: ejecutadasActs,
      health_status: estadoGlobal !== NivelSemaforo.SIN_DATOS ? estadoGlobal : (corteInicial.health_status || NivelSemaforo.SIN_DATOS),
      indicadores: {
        densidadDefectos: { valor: valDensidad, estado: estDensidad, unidad: 'def/KLOC' },
        coberturaPruebas: { valor: valCobertura, estado: estCobertura, unidad: '%' },
        tasaExitoPruebas: { valor: valTasaExito, estado: estTasaExito, unidad: '%' },
        cumplimientoSqa: { valor: cumplimientoCalc, estado: estCumplimiento, unidad: '%' },
      },
      cortes: cortesDetallados,
    } : null;

    return res.json({
      existe: true,
      proyecto,
      roles: miembros,
      planQA: {
        totalActividades: actividades.length,
        actividades,
      },
      lineaBase,
      tableroInicial: tableroEnriquecido,
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
