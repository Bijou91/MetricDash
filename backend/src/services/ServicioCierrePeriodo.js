const proyectoRepo = require('../data/ProyectoRepository');
const actividadRepo = require('../data/ActividadSqaRepository');
const defectoRepo = require('../data/DefectoRepository');
const accionRepo = require('../data/AccionCorrectivaRepository');
const alertaRepo = require('../data/AlertaDeterioroRepository');
const configRepo = require('../data/ConfiguracionMetricasRepository');
const revisionRepo = require('../data/RevisionRepository');
const pruebasRepo = require('../data/PruebasRepository');
const corteRepo = require('../data/RepositorioCorteEvaluacion');
const cierreRepo = require('../data/CierrePeriodoRepository');
const transacciones = require('../data/TransaccionManager');
const validador = require('./ValidadorCierrePeriodo');
const calculoMetricas = require('./ServicioCalculoMetricas');
const evaluarMetricas = require('./ServicioEvaluarMetricas');
const congelamiento = require('./ServicioCongelamientoMetricas');
const calculadorIndice = require('./CalculadorIndiceSaludCU08');
const exportadorReporte = require('./ExportadorReportePDFCU08');
const generadorBitacora = require('./GeneradorBitacoraSqa');
const exportadorBitacora = require('./ExportadorBitacoraPDF');
const { ErrorValidacion, EstadoActividad } = require('./entidades/proyecto');
const { TipoActividad } = require('./entidades/actividadSqa');
const { EstadoDefecto } = require('./entidades/defecto');
const { TipoMetrica } = require('./entidades/metricas');
const {
  TipoPendiente, OpcionResolucion, EstadoPeriodo, Pendiente, ResolucionPendiente, Retrospectiva,
} = require('./entidades/cierrePeriodo');

// El controlador traduce el campo a HTTP: periodo -> 409 (FE-02), proyecto -> 404, configuracion -> 409, resto -> 400.
function fallar(campo, mensaje, errores) {
  return Object.assign(new ErrorValidacion(campo, mensaje), { errores: errores ?? [new ErrorValidacion(campo, mensaje)] });
}

const PENDIENTE_ACTIVIDAD = [EstadoActividad.PLANIFICADA, EstadoActividad.EN_CURSO];
const DEFECTO_RESUELTO = [EstadoDefecto.CERRADO, EstadoDefecto.DESCARTADO];

// FN-02: pendientes del periodo (un solo proyecto por periodo, así que filtrar por proyecto acota al periodo).
async function leerPendientes(proyectoId, tx) {
  const [actividades, defectos, acciones, alertas] = await Promise.all([
    actividadRepo.obtenerPlan(proyectoId, tx),
    defectoRepo.listarPorProyecto(proyectoId, tx),
    accionRepo.listarPorProyecto(proyectoId, tx),
    alertaRepo.listarPorProyecto(proyectoId, tx),
  ]);
  return [
    ...actividades.filter((a) => PENDIENTE_ACTIVIDAD.includes(a.estado)).map((a) => new Pendiente({
      tipo: TipoPendiente.ACTIVIDAD_SQA,
      registroId: a.id,
      descripcion: a.nombre,
      estadoActual: a.estado,
      tipoActividad: a.tipo,
      evidencia: a.evidenciaRef || a.evidenciaUrl || null,
    })),
    ...defectos.filter((d) => !DEFECTO_RESUELTO.includes(d.estado)).map((d) => new Pendiente({
      tipo: TipoPendiente.DEFECTO,
      registroId: d.id,
      descripcion: `${d.folio}: ${d.descripcionDetallada ?? ''}`.trim(),
      estadoActual: d.estado,
    })),
    ...acciones.filter((a) => a.estaAbierta()).map((a) => new Pendiente({
      tipo: TipoPendiente.ACCION_CORRECTIVA,
      registroId: a.id,
      descripcion: a.descripcion,
      estadoActual: a.estado,
    })),
    // Con acción correctiva la alerta pasa a EN_PROCESO; las ACTIVA son las pospuestas (CU-06 FA-04.01).
    ...alertas.filter((a) => a.estado === 'ACTIVA').map((a) => new Pendiente({
      tipo: TipoPendiente.ALERTA_DETERIORO,
      registroId: a.id,
      descripcion: a.mensaje,
      estadoActual: a.estado,
    })),
  ];
}

// Precondiciones: proyecto activo del periodo, periodo no cerrado y umbrales configurados (CU-02).
async function verificarPrecondiciones(proyectoId, periodo, tx) {
  if (!periodo || periodo.status === EstadoPeriodo.CERRADO) throw fallar('periodo', 'El periodo ya está cerrado.');
  const proyecto = await proyectoRepo.obtenerProyectoPeriodoActivo();
  if (!proyecto || proyecto.id !== String(proyectoId).toLowerCase()) throw fallar('proyecto', 'No existe un proyecto activo en el periodo en curso.');
  const config = await configRepo.obtenerVigente(proyecto.id, tx);
  if (!config) throw fallar('configuracion', 'Configure primero las metas y umbrales de las 4 métricas (CU-02).');
  return { proyecto, config };
}

async function obtenerPendientes(proyectoId) {
  await verificarPrecondiciones(proyectoId, await proyectoRepo.obtenerPeriodoActivo());
  return leerPendientes(proyectoId);
}

// FN-05 / FA-05.01: valida y arma las resoluciones con el tipo y la descripción del pendiente (no los del cliente).
function validarSolicitud(dto, pendientes, periodoId) {
  const errores = validador.validar(dto, pendientes);
  if (errores.length > 0) throw fallar('solicitud', 'Faltan datos para cerrar el periodo.', errores);
  const porId = new Map(pendientes.map((p) => [p.registroId, p]));
  const resoluciones = dto.resoluciones.map((r) => {
    const p = porId.get(r.registroId);
    return new ResolucionPendiente({
      tipo: p.tipo, registroId: p.registroId, descripcion: p.descripcion,
      opcion: r.opcion, justificacion: r.justificacion, periodoOrigenId: periodoId,
    });
  });
  return { resoluciones, retrospectiva: new Retrospectiva(dto.retrospectiva) };
}

// FN-03 / FN-07: aplica cada resolución y devuelve las métricas que quedaron afectadas.
async function aplicarResoluciones(resoluciones, tx) {
  const afectadas = new Set();
  for (const r of resoluciones) {
    if (r.esArrastre()) continue; // conserva estado, responsable e historial
    const estado = r.estadoDestino();
    if (r.tipo === TipoPendiente.ACTIVIDAD_SQA) {
      await actividadRepo.actualizarEstado(r.registroId, estado, tx);
      afectadas.add(TipoMetrica.CUMPLIMIENTO_SQA);
    } else if (r.tipo === TipoPendiente.DEFECTO) {
      await defectoRepo.actualizarEstado(r.registroId, estado, r.justificacion, tx);
      // Un defecto CERRADO sigue contando; solo el DESCARTADO cambia la densidad.
      if (r.opcion === OpcionResolucion.CANCELAR) afectadas.add(TipoMetrica.DENSIDAD_DEFECTOS);
    } else if (r.tipo === TipoPendiente.ACCION_CORRECTIVA) {
      await accionRepo.actualizar(r.registroId, { estado }, tx);
    } else if (r.tipo === TipoPendiente.ALERTA_DETERIORO) {
      await alertaRepo.actualizar(r.registroId, { estado }, tx);
    }
  }
  return afectadas;
}

// FN-07: recalcula solo las métricas afectadas. Se guarda con guardarMedicionHistorica() y no con
// ServicioRegistroMetrica para no disparar la detección de deterioro del CU-06 al cerrar.
async function recalcularMetricas(proyecto, config, corteId, afectadas, tx) {
  const mediciones = [];
  if (afectadas.has(TipoMetrica.DENSIDAD_DEFECTOS)) mediciones.push(await calculoMetricas.recalcularDensidadDefectos(proyecto, tx));
  if (afectadas.has(TipoMetrica.CUMPLIMIENTO_SQA)) mediciones.push(await calculoMetricas.recalcularCumplimientoSQA(proyecto, tx));
  for (const m of mediciones) {
    const umbral = config.metricas.find((u) => u.tipo === m.tipoMetrica);
    const estadoSemaforo = evaluarMetricas.determinarEstadoSemaforo(m.valorCalculado, umbral);
    await configRepo.guardarMedicionHistorica({
      proyectoId: proyecto.id, corteId, tipoMetrica: m.tipoMetrica, valor: m.valorCalculado, estadoSemaforo,
    }, tx);
  }
}

// Bloque común de FN-05 (simulado) y FN-07: aplicar resoluciones, recalcular y congelar.
async function aplicarRecalcularCongelar(proyecto, config, resoluciones, tx) {
  const corte = await proyectoRepo.obtenerCorteActual(proyecto.id, tx);
  const afectadas = await aplicarResoluciones(resoluciones, tx);
  await recalcularMetricas(proyecto, config, corte?.id ?? null, afectadas, tx);
  return congelamiento.congelar(proyecto.id, tx);
}

// FN-05: resumen con las resoluciones ya aplicadas, sin persistir nada (rollback siempre).
async function prepararResumen(proyectoId, dto) {
  const periodo = await proyectoRepo.obtenerPeriodoActivo();
  const { proyecto, config } = await verificarPrecondiciones(proyectoId, periodo);
  const { resoluciones, retrospectiva } = validarSolicitud(dto, await leerPendientes(proyectoId), periodo.id);
  const valoresFinales = await transacciones.simular((tx) => aplicarRecalcularCongelar(proyecto, config, resoluciones, tx));
  return { resoluciones, retrospectiva, valoresFinales };
}

// FN-07: reporte final con las reglas del CU-07; la retrospectiva va como notas ejecutivas.
async function generarReporteFinal(proyecto, metricas, config, retrospectiva, tx) {
  const mediciones = metricas.map((m) => m.comoMedicion());
  const [versionReporte, actividadesPlaneadas, actividadesEjecutadas] = [
    await corteRepo.obtenerSiguienteVersionReporte(proyecto.id, tx),
    await actividadRepo.contarExigibles(proyecto.id, new Date(), tx),
    await actividadRepo.contarRealizadas(proyecto.id, tx),
  ];
  const reporte = await corteRepo.guardarCorteReporteSalud({
    proyectoId: proyecto.id,
    versionReporte,
    nombreVersion: `CP${versionReporte}-Reporte final del periodo`,
    indiceSaludGeneral: calculadorIndice.calcularIndiceSaludDeterminista(mediciones),
    estadoSalud: calculadorIndice.determinarEstadoSaludGlobal(mediciones),
    leyendaIndice: calculadorIndice.obtenerLeyendaIndice(mediciones),
    notasEjecutivas: retrospectiva.comoNotasEjecutivas(),
    klocActual: Number(proyecto.estimated_kloc) || 1,
    actividadesPlaneadas,
    actividadesEjecutadas,
  }, tx);
  const desglose = calculadorIndice.generarDesgloseImpacto(mediciones, config);
  return { reporte, archivo: await exportadorReporte.compilarPDF(reporte, desglose) };
}

// FN-08: registros del periodo para la bitácora.
async function consolidarRegistros(proyectoId, tx) {
  const actividades = await actividadRepo.obtenerPlan(proyectoId, tx);
  const actas = [];
  for (const a of actividades) {
    if (a.tipo === TipoActividad.REVISION_PARES && a.estado === EstadoActividad.REALIZADA) {
      const acta = await revisionRepo.obtenerActaPorActividad(a.id, tx);
      if (acta) actas.push(acta);
    }
  }
  return {
    actividades,
    defectos: await defectoRepo.listarPorProyecto(proyectoId, tx),
    accionesCorrectivas: await accionRepo.listarPorProyecto(proyectoId, tx),
    actas,
    rondasPruebas: await pruebasRepo.listarPorProyecto(proyectoId, tx),
  };
}

// FN-07 a FN-09 dentro de la transacción que abre el controlador (FE-01: todo o nada).
async function cerrarPeriodo(proyectoId, dto, usuarioId, tx) {
  const periodo = await proyectoRepo.obtenerPeriodoActivo(tx); // FOR UPDATE
  const { proyecto, config } = await verificarPrecondiciones(proyectoId, periodo, tx); // FE-02
  const { resoluciones, retrospectiva } = validarSolicitud(dto, await leerPendientes(proyectoId, tx), periodo.id);
  const miembros = await proyectoRepo.obtenerMiembros(proyecto.id);
  if (!miembros.some((m) => m.id === String(usuarioId).toLowerCase())) {
    throw fallar('cerradoPor', 'Seleccione el miembro del equipo que cierra el periodo.');
  }

  const cierre = {
    proyectoId: proyecto.id,
    periodoId: periodo.id,
    fechaCierre: new Date(),
    cerradoPor: String(usuarioId).toLowerCase(),
    resoluciones,
    retrospectiva,
  };
  cierre.metricasCongeladas = await aplicarRecalcularCongelar(proyecto, config, resoluciones, tx);
  const { reporte, archivo } = await generarReporteFinal(proyecto, cierre.metricasCongeladas, config, retrospectiva, tx);
  cierre.reporte = reporte;
  cierre.reporteFinalPdf = archivo;

  const bitacora = { periodo: periodo.code, ...generadorBitacora.compilar(cierre, await consolidarRegistros(proyecto.id, tx)) };
  bitacora.archivoPdf = await exportadorBitacora.compilarPDF(bitacora);
  cierre.bitacora = bitacora;

  cierre.id = await cierreRepo.guardar(cierre, tx);
  await proyectoRepo.cerrarPeriodo(periodo.id, tx);
  return cierre;
}

module.exports = { obtenerPendientes, prepararResumen, cerrarPeriodo, aplicarResoluciones, recalcularMetricas };
