const actividadRepo = require('../data/ActividadSQARepository');
const peerReviewRepo = require('../data/PeerReviewRepository');
const defectoRepo = require('../data/DefectoRepository');
const proyectoRepo = require('../data/ProyectoRepository');
const configRepo = require('../data/ConfiguracionMetricasRepository');
const tableroRepo = require('../data/TableroControlRepository');
const pruebasRepo = require('../data/PruebasRepository');
const transacciones = require('../data/TransaccionManager');

const validadorPlan = require('./ValidadorPlanificacionSQA');
const validadorEjec = require('./ValidadorEjecucionSQA');
const calculoCumplimiento = require('./ServicioCalculoCumplimientoSQA');
const calculoMetricas = require('./ServicioCalculoMetricas');
const evaluarMetricas = require('./ServicioEvaluarMetricas');
const servicioDefectos = require('./ServicioGestionDefectos');

const {
  TipoArtefacto,
  DictamenRevision,
  CategoriaActividad,
  ChecklistsPorArtefacto,
  RevisionPares,
  ActividadSQA,
} = require('./entidades/actividadSQA');
const { Defecto, SeveridadDefecto, PrioridadDefecto, EstadoDefecto, AlertaCalidad } = require('./entidades/defecto');
const { TipoMetrica, EstadoSemaforo } = require('./entidades/metricas');
const { NivelSemaforo } = require('./entidades/proyecto');

// FN-01 / Precondiciones 2 y 3: verifica proyecto activo y carga contexto
async function cargarContexto(proyectoId) {
  const proyecto = await proyectoRepo.obtenerProyectoPeriodoActivo();
  if (!proyecto || proyecto.id !== proyectoId) {
    throw Object.assign(
      new Error('No hay un proyecto activo con ese identificador en el periodo en curso.'),
      { status: 404 },
    );
  }

  const configMetricas = await configRepo.obtenerVigente(proyectoId);
  if (!configMetricas) {
    throw Object.assign(
      new Error('Los umbrales de métricas de calidad deben estar previamente configurados para el proyecto.'),
      { status: 409 },
    );
  }

  const [
    filasActividades,
    miembros,
    periodo,
    filasCortes,
    rondasPrevias,
  ] = await Promise.all([
    actividadRepo.listarPorProyecto(proyectoId),
    proyectoRepo.obtenerMiembros(proyectoId),
    proyectoRepo.obtenerPeriodoActivo(),
    proyectoRepo.listarCortes(proyectoId),
    pruebasRepo.listarPorProyecto ? pruebasRepo.listarPorProyecto(proyectoId).catch(() => []) : Promise.resolve([]),
  ]);

  const corteActual = filasCortes && filasCortes.length > 0 ? filasCortes[filasCortes.length - 1] : null;
  const medicionActual = corteActual ? await configRepo.obtenerMedicion(corteActual.id) : null;
  const metricasCumplimiento = await actividadRepo.obtenerMetricasCumplimiento(proyectoId);

  const valorCumplimiento = calculoCumplimiento.calcularCumplimiento(
    metricasCumplimiento.realizadas,
    metricasCumplimiento.exigibles,
  );

  return {
    proyecto: {
      id: proyecto.id,
      nombre: proyecto.name,
      periodo: proyecto.period_code || proyecto.period_name || '',
      estimatedKloc: Number(proyecto.estimated_kloc),
    },
    periodo,
    miembros,
    actividades: filasActividades,
    corteActual,
    cortes: filasCortes,
    configMetricas,
    medicionActual,
    metricasCumplimiento: {
      ...metricasCumplimiento,
      porcentajeCumplimiento: valorCumplimiento,
    },
    rondasPruebas: rondasPrevias,
  };
}

// FN-02 / FN-03 / FA-02.01 / FA-03.01: Planificar actividad
async function planificar(proyectoId, actividadId, dto = {}) {
  const contexto = await cargarContexto(proyectoId);
  const actividad = await actividadRepo.obtenerPorId(actividadId);

  if (!actividad || actividad.project_id !== proyectoId) {
    throw Object.assign(
      new Error('La actividad SQA no pertenece al proyecto activo especificado.'),
      { status: 404 },
    );
  }

  // Validación de planificación (FA-03.01)
  const resultado = validadorPlan.validarPlanificacion({
    dto,
    actividad,
    miembros: contexto.miembros,
    periodo: contexto.periodo,
    fechaHoy: new Date(),
  });

  if (!resultado.esValido) {
    const err = new Error('Datos de planificación incompletos o inválidos.');
    err.status = 400;
    err.errores = resultado.errores;
    throw err;
  }

  const datosPlan = {
    plannedDate: dto.plannedDate || dto.fechaPlanificada,
    responsibleMemberId: dto.responsibleMemberId || dto.responsableId,
    artifact: (dto.artifact || dto.artefacto).trim(),
    authorId: dto.authorId || dto.autorId || null,
    reviewerIds: dto.reviewerIds || dto.revisoresIds || [],
  };

  const actividadActualizada = await actividadRepo.guardarPlanificacion(actividadId, datosPlan);
  const checklist = ChecklistsPorArtefacto[datosPlan.artifact] || ChecklistsPorArtefacto[TipoArtefacto.SGU] || [];

  return {
    actividad: actividadActualizada,
    checklist,
  };
}

// FN-04: Obtener el checklist para una actividad
async function obtenerChecklist(actividadId) {
  const actividad = await actividadRepo.obtenerPorId(actividadId);
  if (!actividad) {
    throw Object.assign(new Error('Actividad SQA no encontrada.'), { status: 404 });
  }

  const artefacto = actividad.artifact || TipoArtefacto.SGU;
  const checklist = ChecklistsPorArtefacto[artefacto] || ChecklistsPorArtefacto[TipoArtefacto.SGU];

  return {
    actividadId,
    artefacto,
    checklist,
  };
}

// FN-06 / FA-06.01: Analizar posibles duplicados de hallazgos "no cumple"
async function buscarDuplicadosHallazgos(proyectoId, actividadId, hallazgos = []) {
  const actividad = await actividadRepo.obtenerPorId(actividadId);
  if (!actividad || actividad.project_id !== proyectoId) {
    throw Object.assign(new Error('Actividad no encontrada.'), { status: 404 });
  }

  const resultados = [];
  for (const h of hallazgos) {
    if (h.cumple === false || h.cumple === 'false') {
      const duplicados = await servicioDefectos.buscarPosiblesDuplicados(proyectoId, {
        faseOrigen: actividad.phase,
        descripcionDetallada: h.observacion || '',
      });
      resultados.push({
        itemId: h.itemId,
        coincidencias: duplicados,
        tieneDuplicados: duplicados.length > 0,
      });
    } else {
      resultados.push({
        itemId: h.itemId,
        coincidencias: [],
        tieneDuplicados: false,
      });
    }
  }

  return resultados;
}

// FN-07 / FN-08 / FN-09 / FA-06.01 / FA-09.01 / FE-01: Cierre formal de revisión por pares
async function cerrarRevision(proyectoId, actividadId, dto = {}) {
  const contexto = await cargarContexto(proyectoId);
  const actividad = await actividadRepo.obtenerPorId(actividadId);

  if (!actividad || actividad.project_id !== proyectoId) {
    throw Object.assign(new Error('Actividad no encontrada.'), { status: 404 });
  }

  if (actividad.category !== CategoriaActividad.REVIEW) {
    throw Object.assign(new Error('Solo las actividades de tipo Revisión por Pares se cierran con esta operación.'), { status: 400 });
  }

  // Validación de cierre (FA-05.01)
  const val = validadorEjec.validarCierreRevision(dto);
  if (!val.esValido) {
    const err = new Error('Hallazgo incompleto o datos del acta inválidos.');
    err.status = 400;
    err.errores = val.errores;
    throw err;
  }

  const corte = contexto.corteActual;
  if (!corte) {
    throw Object.assign(new Error('No existe un corte de evaluación activo para el proyecto.'), { status: 409 });
  }

  // Ejecución atómica en transacción
  return transacciones.ejecutarEnTransaccion(async (tx) => {
    const peerReviewId = dto.id || undefined;
    const authorId = actividad.author_id || dto.authorId;
    const responsibleId = actividad.responsible_member_id || dto.responsibleMemberId;

    const hallazgosEntrantes = dto.checklistResults || dto.hallazgos || [];
    const hallazgosProcesados = [];
    const defectosCreados = [];
    let hayDefectoCritico = false;

    // FN-06 / FN-08: Procesar hallazgos "no cumple"
    for (const h of hallazgosEntrantes) {
      if (h.cumple === false || h.cumple === 'false') {
        if (h.descartado === true) {
          // FA-06.01: Descartado por ser duplicado -> referenciado con el folio del defecto existente
          hallazgosProcesados.push({
            ...h,
            descartado: true,
            folioReferenciado: h.folioReferenciado || (h.duplicadoDetectado && h.duplicadoDetectado.folio) || null,
          });
        } else {
          // Confirmado como nueva incidencia -> crear y registrar defecto
          const nuevoDefecto = new Defecto({
            severidad: h.severidad,
            prioridad: h.prioridad,
            faseDeteccion: actividad.phase,
            faseOrigen: actividad.phase,
            descripcionDetallada: h.observacion.trim(),
            confirmadoNoDuplicado: Boolean(h.confirmarIncidenciaDistinta || h.confirmadoNoDuplicado),
            reportadoPorId: responsibleId,
            asignadoAId: authorId,
            reviewId: peerReviewId,
          });

          if (nuevoDefecto.esCritico()) {
            hayDefectoCritico = true;
          }

          const defectoGuardado = await defectoRepo.guardar(nuevoDefecto, corte, tx);
          defectosCreados.push(defectoGuardado);

          hallazgosProcesados.push({
            ...h,
            descartado: false,
            defectoId: defectoGuardado.id,
            folioReferenciado: defectoGuardado.folio,
          });
        }
      } else {
        hallazgosProcesados.push({
          ...h,
          cumple: true,
        });
      }
    }

    const minutesUrl = `/actas/acta_revision_${actividad.id.slice(0, 8)}.pdf`;

    // Guardar en peer_reviews
    const reviewData = {
      id: peerReviewId,
      activityId: actividad.id,
      workProduct: actividad.artifact || TipoArtefacto.SGU,
      authorId,
      reviewDate: dto.reviewDate || new Date(),
      reviewerRole: dto.reviewerRole || 'Revisores del Equipo',
      reviewers: actividad.reviewer_ids || dto.reviewers || [],
      verdict: String(dto.verdict || dto.dictamen).toUpperCase(),
      findingsSummary: dto.findingsSummary || dto.resumenHallazgos,
      minutesUrl,
      checklistResults: hallazgosProcesados,
    };
    const actaGuardada = await peerReviewRepo.guardar(reviewData, tx);

    // Marcar actividad realizada con url de evidencia (acta)
    const actividadRealizada = await actividadRepo.marcarRealizada(actividad.id, minutesUrl, tx);

    // FN-08: Recalcular Cumplimiento SQA
    const conteosCumplimiento = await actividadRepo.obtenerMetricasCumplimiento(proyectoId, tx);
    const medicionCumplimiento = calculoCumplimiento.generarMedicionCumplimiento(
      conteosCumplimiento.realizadas,
      conteosCumplimiento.exigibles,
    );
    await configRepo.guardarMedicion(corte.id, medicionCumplimiento, tx);

    // FN-08: Recalcular Densidad de Defectos si se crearon defectos nuevos
    let medicionDensidad = null;
    if (defectosCreados.length > 0) {
      medicionDensidad = await calculoMetricas.recalcularDensidadDefectos(contexto.proyecto, tx);
      await configRepo.guardarMedicion(corte.id, medicionDensidad, tx);
    }

    // FN-09: Evaluar métricas contra umbrales de CU-02
    const umbralCumplimiento = await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.CUMPLIMIENTO_SQA);
    const umbralDensidad = await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.DENSIDAD_DEFECTOS);

    const alertaCumplimiento = umbralCumplimiento
      ? evaluarMetricas.evaluarMedicion(medicionCumplimiento, umbralCumplimiento)
      : null;

    const alertaDensidad = (medicionDensidad && umbralDensidad)
      ? evaluarMetricas.evaluarMedicion(medicionDensidad, umbralDensidad)
      : null;

    // Determinar nivel global del semáforo
    const estadoCumplimiento = medicionCumplimiento.estadoSemaforo;
    const estadoDensidad = medicionDensidad ? medicionDensidad.estadoSemaforo : null;
    const medicionPrevia = contexto.medicionActual;
    const estados = [
      estadoCumplimiento,
      estadoDensidad,
      medicionPrevia?.test_coverage_pct != null ? evaluarMetricas.determinarEstadoSemaforo(Number(medicionPrevia.test_coverage_pct), await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.COBERTURA_PRUEBAS)) : null,
      medicionPrevia?.test_pass_rate_pct != null ? evaluarMetricas.determinarEstadoSemaforo(Number(medicionPrevia.test_pass_rate_pct), await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.TASA_EXITO_PRUEBAS)) : null,
    ];

    const nivelGlobal = evaluarMetricas.calcularNivelGlobal(...estados);

    // FA-09.01: Alerta visual por umbral excedido o defecto crítico
    let mensajeAlerta = null;
    if (hayDefectoCritico || alertaCumplimiento || alertaDensidad) {
      const motivos = [];
      if (hayDefectoCritico) motivos.push('se registró un defecto de severidad CRÍTICA');
      if (alertaCumplimiento) motivos.push(alertaCumplimiento.mensajeAlerta.replace('Alerta de calidad: ', '').replace('.', ''));
      if (alertaDensidad) motivos.push(alertaDensidad.mensajeAlerta.replace('Alerta de calidad: ', '').replace('.', ''));
      mensajeAlerta = `Alerta de calidad: ${motivos.join('; ')}.`;
    }

    // Actualizar tablero de control
    const tablero = await tableroRepo.obtenerPorProyecto(proyectoId, tx);
    tablero.healthStatus = nivelGlobal;
    tablero.ultimaAlerta = mensajeAlerta;
    await tableroRepo.guardar(tablero, tx);

    return {
      actividad: actividadRealizada,
      acta: actaGuardada,
      defectosCreados,
      medicionCumplimiento,
      medicionDensidad,
      nivelGlobal,
      alerta: mensajeAlerta ? { mensajeAlerta, nivelSemaforo: nivelGlobal } : null,
    };
  });
}

// FA-04.01 / FN-08 / FN-09: Cierre de actividad de pruebas o auditoría
async function cerrarEvidencia(proyectoId, actividadId, dto = {}) {
  const contexto = await cargarContexto(proyectoId);
  const actividad = await actividadRepo.obtenerPorId(actividadId);

  if (!actividad || actividad.project_id !== proyectoId) {
    throw Object.assign(new Error('Actividad no encontrada.'), { status: 404 });
  }

  const val = validadorEjec.validarCierreEvidencia(actividad.category, dto);
  if (!val.esValido) {
    const err = new Error('Evidencia de ejecución inválida o incompleta.');
    err.status = 400;
    err.errores = val.errores;
    throw err;
  }

  const corte = contexto.corteActual;
  if (!corte) {
    throw Object.assign(new Error('No existe un corte de evaluación activo para el proyecto.'), { status: 409 });
  }

  const evidenciaUrl = dto.evidenceUrl || dto.enlaceEntregable || (dto.testSuiteId ? `/pruebas/ronda/${dto.testSuiteId}` : null);

  return transacciones.ejecutarEnTransaccion(async (tx) => {
    const actividadRealizada = await actividadRepo.marcarRealizada(actividad.id, evidenciaUrl, tx);

    // Recalcular Cumplimiento SQA
    const conteosCumplimiento = await actividadRepo.obtenerMetricasCumplimiento(proyectoId, tx);
    const medicionCumplimiento = calculoCumplimiento.generarMedicionCumplimiento(
      conteosCumplimiento.realizadas,
      conteosCumplimiento.exigibles,
    );
    await configRepo.guardarMedicion(corte.id, medicionCumplimiento, tx);

    // Evaluar contra umbral
    const umbralCumplimiento = await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.CUMPLIMIENTO_SQA);
    const alertaCumplimiento = umbralCumplimiento
      ? evaluarMetricas.evaluarMedicion(medicionCumplimiento, umbralCumplimiento)
      : null;

    const medicionPrevia = contexto.medicionActual;
    const estados = [
      medicionCumplimiento.estadoSemaforo,
      medicionPrevia?.defect_density != null ? evaluarMetricas.determinarEstadoSemaforo(Number(medicionPrevia.defect_density), await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.DENSIDAD_DEFECTOS)) : null,
      medicionPrevia?.test_coverage_pct != null ? evaluarMetricas.determinarEstadoSemaforo(Number(medicionPrevia.test_coverage_pct), await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.COBERTURA_PRUEBAS)) : null,
      medicionPrevia?.test_pass_rate_pct != null ? evaluarMetricas.determinarEstadoSemaforo(Number(medicionPrevia.test_pass_rate_pct), await configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.TASA_EXITO_PRUEBAS)) : null,
    ];

    const nivelGlobal = evaluarMetricas.calcularNivelGlobal(...estados);
    const mensajeAlerta = alertaCumplimiento ? alertaCumplimiento.mensajeAlerta : null;

    const tablero = await tableroRepo.obtenerPorProyecto(proyectoId, tx);
    tablero.healthStatus = nivelGlobal;
    tablero.ultimaAlerta = mensajeAlerta;
    await tableroRepo.guardar(tablero, tx);

    return {
      actividad: actividadRealizada,
      medicionCumplimiento,
      nivelGlobal,
      alerta: mensajeAlerta ? { mensajeAlerta, nivelSemaforo: nivelGlobal } : null,
    };
  });
}

module.exports = {
  cargarContexto,
  planificar,
  obtenerChecklist,
  buscarDuplicadosHallazgos,
  cerrarRevision,
  cerrarEvidencia,
};
