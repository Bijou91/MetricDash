const proyectoRepo = require('../data/ProyectoRepository');
const actividadRepo = require('../data/ActividadSqaRepository');
const checklistRepo = require('../data/ChecklistRepository');
const revisionRepo = require('../data/RevisionRepository');
const configRepo = require('../data/ConfiguracionMetricasRepository');
const pruebasRepo = require('../data/PruebasRepository');
const tableroRepo = require('../data/TableroControlRepository');
const transacciones = require('../data/TransaccionManager');
const validador = require('./ValidadorActividad');
const servicioDefectos = require('./ServicioGestionDefectos');
const generadorActa = require('./GeneradorActa');
const servicioMetricas = require('./ServicioCalculoMetricas');
const servicioEvaluacionUmbrales = require('./ServicioEvaluacionUmbrales');
const servicioEvaluarMetricas = require('./ServicioEvaluarMetricas');
const { Defecto } = require('./entidades/defecto');
const { TipoMetrica } = require('./entidades/metricas');
const { TableroControl } = require('./entidades/pruebas');
const {
  TipoActividad,
  RevisionPorPares,
  ResultadoItem,
  resultadoCierreActividad,
} = require('./entidades/actividadSqa');

const FASE_A_CORTE = Object.freeze({
  ANALISIS_REQUERIMIENTOS: 1,
  DISENO_COMPONENTES: 2,
  CONSTRUCCION_SOFTWARE: 3,
  INTEGRACION_Y_PRUEBAS: 4,
});

async function obtenerCorteDeActividad(proyectoId, fase) {
  const numCorte = FASE_A_CORTE[fase] || 1;
  if (typeof proyectoRepo.listarCortes === 'function') {
    try {
      const cortes = await proyectoRepo.listarCortes(proyectoId);
      const encontrado = Array.isArray(cortes)
        ? cortes.find((c) => Number(c.cutoff_number) === numCorte)
        : null;
      if (encontrado) return encontrado;
    } catch (_) {
      // Continúa con obtenerCorteActual
    }
  }
  return proyectoRepo.obtenerCorteActual(proyectoId);
}

// Calcula el estado global del corte respetando todas las métricas medidas en el corte (D4).
async function sincronizarSaludCorteYTablero(proyectoId, corteId, medicionesNuevas = [], alerta = null, tx) {
  const previa = tx && typeof tx.query === 'function'
    ? await configRepo.obtenerMedicion(corteId, tx)
    : null;

  const [uDen, uCob, uTasa, uCump] = await Promise.all([
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.DENSIDAD_DEFECTOS),
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.COBERTURA_PRUEBAS),
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.TASA_EXITO_PRUEBAS),
    configRepo.obtenerUmbralVigente(proyectoId, TipoMetrica.CUMPLIMIENTO_SQA),
  ]);

  const mapaNuevas = new Map(medicionesNuevas.map((m) => [m.tipoMetrica, m]));

  const valDen = mapaNuevas.has(TipoMetrica.DENSIDAD_DEFECTOS)
    ? mapaNuevas.get(TipoMetrica.DENSIDAD_DEFECTOS).valorCalculado
    : (previa?.defect_density != null ? Number(previa.defect_density) : null);
  const valCob = mapaNuevas.has(TipoMetrica.COBERTURA_PRUEBAS)
    ? mapaNuevas.get(TipoMetrica.COBERTURA_PRUEBAS).valorCalculado
    : (previa?.test_coverage_pct != null ? Number(previa.test_coverage_pct) : null);
  const valTasa = mapaNuevas.has(TipoMetrica.TASA_EXITO_PRUEBAS)
    ? mapaNuevas.get(TipoMetrica.TASA_EXITO_PRUEBAS).valorCalculado
    : (previa?.test_pass_rate_pct != null ? Number(previa.test_pass_rate_pct) : null);
  const valCump = mapaNuevas.has(TipoMetrica.CUMPLIMIENTO_SQA)
    ? mapaNuevas.get(TipoMetrica.CUMPLIMIENTO_SQA).valorCalculado
    : (previa?.sqa_compliance_pct != null ? Number(previa.sqa_compliance_pct) : null);

  const estDen = valDen != null && uDen ? servicioEvaluarMetricas.determinarEstadoSemaforo(valDen, uDen) : null;
  const estCob = valCob != null && uCob ? servicioEvaluarMetricas.determinarEstadoSemaforo(valCob, uCob) : null;
  const estTasa = valTasa != null && uTasa ? servicioEvaluarMetricas.determinarEstadoSemaforo(valTasa, uTasa) : null;
  const estCump = valCump != null && uCump ? servicioEvaluarMetricas.determinarEstadoSemaforo(valCump, uCump) : null;

  const nivelGlobal = servicioEvaluarMetricas.calcularNivelGlobal(estDen, estCob, estTasa, estCump);

  for (const med of medicionesNuevas) {
    med.estadoSemaforo = nivelGlobal;
    await configRepo.guardarMedicion(corteId, med, tx);
  }

  if (tableroRepo && typeof tableroRepo.guardar === 'function') {
    const tablero = new TableroControl({ proyectoId });
    tablero.actualizarIndicadores(medicionesNuevas);
    if (alerta) tablero.reflejarAlerta(alerta);
    await tableroRepo.guardar(tablero, tx);
  }

  return {
    nivelGlobal,
    densidadDefectos: valDen,
  };
}

// FN-04: Inicia la ejecución de una actividad SQA.
// Si es REVISION_PARES devuelve su plantilla de checklist ítem por ítem;
// si es PRUEBAS o AUDITORIA devuelve el tipo y las rondas de pruebas disponibles (FA-04.01).
async function iniciarActividad(actividadId) {
  const actividad = await actividadRepo.obtenerPorId(actividadId);
  if (!actividad) {
    throw Object.assign(new Error('Actividad SQA no encontrada.'), { status: 404 });
  }

  const proyecto = await proyectoRepo.obtenerProyectoPeriodoActual();
  if (!proyecto || proyecto.id !== actividad.proyectoId) {
    throw Object.assign(new Error('No existe un proyecto activo asociado a esta actividad.'), { status: 404 });
  }

  const umbralCumplimiento = await configRepo.obtenerUmbralVigente(proyecto.id, TipoMetrica.CUMPLIMIENTO_SQA);
  if (!umbralCumplimiento) {
    throw Object.assign(
      new Error('Primero configure las métricas de calidad y sus umbrales antes de ejecutar actividades SQA.'),
      { status: 409 },
    );
  }

  await actividadRepo.marcarEnCurso(actividad.id);

  if (actividad.esRevisionPares()) {
    const checklist = await checklistRepo.obtenerPorTipoArtefacto(actividad.tipoArtefacto);
    return {
      actividadId: actividad.id,
      tipoActividad: actividad.tipo,
      tipoArtefacto: checklist.tipoArtefacto,
      nombreChecklist: checklist.nombre,
      descripcionChecklist: checklist.descripcion,
      items: checklist.items,
      rondasDisponibles: [],
    };
  }

  const rondasDisponibles = actividad.tipo === TipoActividad.PRUEBAS && pruebasRepo.listarPorProyecto
    ? await pruebasRepo.listarPorProyecto(proyecto.id)
    : [];

  return {
    actividadId: actividad.id,
    tipoActividad: actividad.tipo,
    tipoArtefacto: null,
    nombreChecklist: null,
    descripcionChecklist: null,
    items: [],
    rondasDisponibles,
  };
}

// FN-06: Arma un objeto Defecto por cada ítem marcado como "no cumple" con lo capturado,
// la fase de la actividad y el autor del artefacto como asignado.
function armarDefectosDesdeHallazgos(revision, actividad) {
  const hallazgos = revision.obtenerHallazgos ? revision.obtenerHallazgos() : [];
  const autorId = revision.autorId || actividad?.autorId || actividad?.responsableId || null;
  const reportadoPorId = actividad?.responsableId || autorId;
  const fase = actividad?.fase || 'ANALISIS_REQUERIMIENTOS';

  return hallazgos.map((h) => ({
    itemId: h.itemId,
    descartarPorDuplicado: Boolean(h.descartarPorDuplicado),
    confirmarIncidenciaDistinta: Boolean(h.confirmarIncidenciaDistinta),
    folioDefectoExistente: h.folioDefectoExistente || null,
    defecto: new Defecto({
      severidad: h.severidad,
      prioridad: h.prioridad,
      faseDeteccion: fase,
      faseOrigen: fase,
      descripcionDetallada: h.observacion,
      confirmadoNoDuplicado: Boolean(h.confirmarIncidenciaDistinta),
      reportadoPorId,
      asignadoAId: autorId,
    }),
  }));
}

// FN-05 a FN-09, FA-05.01, FA-06.01, FA-09.01 y FE-01:
// Cierra una revisión por pares validando hallazgos, buscando posibles duplicados (CU-03),
// emitiendo el acta, marcando la actividad como realizada y recalculando densidad y cumplimiento SQA.
async function cerrarRevision(actividadId, dto = {}) {
  const actividad = await actividadRepo.obtenerPorId(actividadId);
  if (!actividad) {
    throw Object.assign(new Error('Actividad SQA no encontrada.'), { status: 404 });
  }

  const proyecto = await proyectoRepo.obtenerProyectoPeriodoActual();
  if (!proyecto || proyecto.id !== actividad.proyectoId) {
    throw Object.assign(new Error('No existe un proyecto activo asociado a esta actividad.'), { status: 404 });
  }

  const resultadosRaw = Array.isArray(dto.resultados) ? dto.resultados : [];
  const errores = [];

  if (resultadosRaw.length === 0) {
    errores.push({ campo: 'resultados', mensaje: 'Debe evaluar los ítems del checklist antes de cerrar la revisión.' });
  }

  // FA-05.01: Validar cada ítem marcado como "no cumple"
  for (const resItem of resultadosRaw) {
    const errItem = validador.validarHallazgo(resItem);
    if (errItem.length > 0) {
      errores.push(...errItem);
    }
  }

  const errDictamen = validador.validarDictamen(dto.dictamen);
  if (errDictamen) {
    errores.push(errDictamen);
  }

  if (errores.length > 0) {
    return {
      httpStatus: 400,
      resultado: resultadoCierreActividad({ exito: false, errores }),
    };
  }

  const revision = new RevisionPorPares({
    actividadId: actividad.id,
    tipoArtefacto: actividad.tipoArtefacto,
    autorId: actividad.autorId || dto.autorId || actividad.responsableId,
    revisoresIds: actividad.revisoresIds,
    rolRevisor: actividad.rolResponsable,
    dictamen: dto.dictamen,
    resultados: resultadosRaw.map((r) => new ResultadoItem(r)),
  });

  // FN-06: Armar defectos desde hallazgos y buscar posibles duplicados (CU-03)
  const propuestas = armarDefectosDesdeHallazgos(revision, actividad);
  const coincidenciasTotales = [];

  for (const prop of propuestas) {
    if (prop.descartarPorDuplicado || prop.confirmarIncidenciaDistinta) {
      continue;
    }
    const similares = await servicioDefectos.buscarPosiblesDuplicados(proyecto.id, {
      faseOrigen: prop.defecto.faseOrigen,
      descripcionDetallada: prop.defecto.descripcionDetallada,
    });
    if (similares.length > 0) {
      coincidenciasTotales.push({
        itemId: prop.itemId,
        observacion: prop.defecto.descripcionDetallada,
        coincidencias: similares,
      });
    }
  }

  // FA-06.01: Posible duplicado detectado -> notificar al responsable antes de abrir transacción
  if (coincidenciasTotales.length > 0) {
    return {
      httpStatus: 200,
      resultado: resultadoCierreActividad({
        exito: false,
        requiereDecisionDuplicado: true,
        coincidencias: coincidenciasTotales,
      }),
    };
  }

  const corte = await obtenerCorteDeActividad(proyecto.id, actividad.fase);
  const responsableAutor = { id: revision.autorId || actividad.responsableId };

  // FN-08 y FN-09: Cierre atómico dentro de TransaccionManager
  const cierre = await transacciones.ejecutar(async (tx) => {
    const defectosCreados = [];
    const foliosExistentes = [];

    for (const prop of propuestas) {
      if (prop.descartarPorDuplicado) {
        if (prop.folioDefectoExistente) {
          foliosExistentes.push(prop.folioDefectoExistente);
        }
        continue;
      }
      const defCreado = await servicioDefectos.crearYAsignarDefecto(
        {
          severidad: prop.defecto.severidad,
          prioridad: prop.defecto.prioridad,
          faseDeteccion: prop.defecto.faseDeteccion,
          faseOrigen: prop.defecto.faseOrigen,
          descripcionDetallada: prop.defecto.descripcionDetallada,
          confirmarIncidenciaDistinta: true,
          reportadoPorId: prop.defecto.reportadoPorId,
          asignadoAId: prop.defecto.asignadoAId,
        },
        responsableAutor,
        corte,
        tx,
      );
      defectosCreados.push(defCreado);
    }

    const acta = generadorActa.emitirActa(revision, defectosCreados, foliosExistentes);
    await revisionRepo.guardarRevision(revision, tx);
    await revisionRepo.guardarActa(acta, tx);

    if (revision.dictamen === 'RECHAZADO' && typeof actividadRepo.marcarEnRetrabajo === 'function') {
      actividad.estado = 'EN_CURSO';
      actividad.evidenciaUrl = acta.minutesUrl;
      actividad.evidenciaRef = acta.minutesUrl;
      await actividadRepo.marcarEnRetrabajo(actividad, acta.minutesUrl, tx);
    } else {
      actividad.marcarRealizada(acta.minutesUrl);
      await actividadRepo.marcarRealizada(actividad, tx);
    }

    const medicionDensidad = await servicioMetricas.recalcularDensidadDefectos(proyecto, tx);
    const medicionCumplimiento = await servicioMetricas.recalcularCumplimientoSQA(proyecto, tx);

    const [umbralDensidad, umbralCumplimiento] = await Promise.all([
      configRepo.obtenerUmbralVigente(proyecto.id, TipoMetrica.DENSIDAD_DEFECTOS),
      configRepo.obtenerUmbralVigente(proyecto.id, TipoMetrica.CUMPLIMIENTO_SQA),
    ]);

    medicionDensidad.proyectoId = proyecto.id;
    medicionDensidad.umbral = umbralDensidad;
    medicionCumplimiento.proyectoId = proyecto.id;
    medicionCumplimiento.umbral = umbralCumplimiento;

    const alertaCumplimiento = await servicioEvaluacionUmbrales.evaluarMedicion(medicionCumplimiento, defectosCreados);
    const alertaDensidad = await servicioEvaluacionUmbrales.evaluarMedicion(medicionDensidad, defectosCreados);
    const alertaEmitida = alertaCumplimiento || alertaDensidad || null;

    const { nivelGlobal } = await sincronizarSaludCorteYTablero(
      proyecto.id,
      corte.id,
      [medicionDensidad, medicionCumplimiento],
      alertaEmitida,
      tx,
    );

    return {
      acta,
      defectosCreados,
      medicionDensidad,
      medicionCumplimiento,
      nivelGlobal,
      alertaEmitida,
    };
  });

  return {
    httpStatus: 200,
    resultado: resultadoCierreActividad({
      exito: true,
      requiereDecisionDuplicado: false,
      coincidencias: [],
      actaId: cierre.acta.id,
      acta: cierre.acta,
      defectosRegistrados: cierre.defectosCreados,
      cumplimientoSQA: cierre.medicionCumplimiento.valorCalculado,
      densidadDefectos: cierre.medicionDensidad.valorCalculado,
      nivelSemaforo: cierre.nivelGlobal,
      alertaEmitida: cierre.alertaEmitida,
      errores: [],
    }),
  };
}

// FA-04.01: Ejecución de una actividad de PRUEBAS o AUDITORIA.
// Registra la evidencia (ronda de CU-05 o enlace al entregable), marca la actividad como realizada
// sin registrar defectos ni emitir acta, y recalcula el cumplimiento SQA.
async function registrarEvidenciaPruebasAuditoria(actividadId, dto = {}) {
  const actividad = await actividadRepo.obtenerPorId(actividadId);
  if (!actividad) {
    throw Object.assign(new Error('Actividad SQA no encontrada.'), { status: 404 });
  }

  const proyecto = await proyectoRepo.obtenerProyectoPeriodoActual();
  if (!proyecto || proyecto.id !== actividad.proyectoId) {
    throw Object.assign(new Error('No existe un proyecto activo asociado a esta actividad.'), { status: 404 });
  }

  const errores = validador.validarEvidencia(actividad.tipo, dto);
  if (errores.length > 0) {
    return {
      httpStatus: 400,
      resultado: resultadoCierreActividad({ exito: false, errores }),
    };
  }

  let referenciaEvidencia = dto.evidenciaEnlace ? String(dto.evidenciaEnlace).trim() : null;
  if (actividad.tipo === TipoActividad.PRUEBAS) {
    if (pruebasRepo.listarPorProyecto) {
      const rondas = await pruebasRepo.listarPorProyecto(proyecto.id);
      const rondaElegida = rondas.find((r) => r.id === dto.evidenciaRondaId);
      if (rondas.length > 0 && !rondaElegida) {
        return {
          httpStatus: 400,
          resultado: resultadoCierreActividad({
            exito: false,
            errores: [{ campo: 'evidenciaRondaId', mensaje: 'La ronda de pruebas seleccionada no pertenece al proyecto activo.' }],
          }),
        };
      }
      referenciaEvidencia = rondaElegida
        ? `ronda-pruebas://${rondaElegida.id} (${rondaElegida.version} — Cobertura: ${rondaElegida.coberturaPruebas}%, Éxito: ${rondaElegida.tasaExitoPruebas}%)`
        : `ronda-pruebas://${dto.evidenciaRondaId}`;
    } else {
      referenciaEvidencia = `ronda-pruebas://${dto.evidenciaRondaId}`;
    }
  }

  const corte = await obtenerCorteDeActividad(proyecto.id, actividad.fase);

  const cierre = await transacciones.ejecutar(async (tx) => {
    actividad.marcarRealizada(referenciaEvidencia);
    await actividadRepo.marcarRealizada(actividad, tx);

    const medicionCumplimiento = await servicioMetricas.recalcularCumplimientoSQA(proyecto, tx);
    const umbralCumplimiento = await configRepo.obtenerUmbralVigente(proyecto.id, TipoMetrica.CUMPLIMIENTO_SQA);
    medicionCumplimiento.proyectoId = proyecto.id;
    medicionCumplimiento.umbral = umbralCumplimiento;

    const alertaEmitida = await servicioEvaluacionUmbrales.evaluarMedicion(medicionCumplimiento, null);

    const { nivelGlobal, densidadDefectos } = await sincronizarSaludCorteYTablero(
      proyecto.id,
      corte.id,
      [medicionCumplimiento],
      alertaEmitida,
      tx,
    );

    return {
      medicionCumplimiento,
      densidadDefectos,
      nivelGlobal,
      alertaEmitida,
    };
  });

  return {
    httpStatus: 200,
    resultado: resultadoCierreActividad({
      exito: true,
      requiereDecisionDuplicado: false,
      coincidencias: [],
      actaId: null,
      acta: null,
      evidenciaRegistrada: referenciaEvidencia,
      cumplimientoSQA: cierre.medicionCumplimiento.valorCalculado,
      densidadDefectos: cierre.densidadDefectos,
      nivelSemaforo: cierre.nivelGlobal,
      alertaEmitida: cierre.alertaEmitida,
      errores: [],
    }),
  };
}

module.exports = {
  iniciarActividad,
  armarDefectosDesdeHallazgos,
  cerrarRevision,
  registrarEvidenciaPruebasAuditoria,
};

