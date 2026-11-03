const proyectoRepo = require('../data/ProyectoRepository');
const actividadRepo = require('../data/ActividadSqaRepository');
const checklistRepo = require('../data/ChecklistRepository');
const configRepo = require('../data/ConfiguracionMetricasRepository');
const transacciones = require('../data/TransaccionManager');
const validador = require('./ValidadorActividad');
const { TipoMetrica } = require('./entidades/metricas');
const {
  inferirTipoArtefacto,
  normalizarFechaISO,
} = require('./entidades/actividadSqa');

// Precondiciones 2 y 3 (CU-04): Proyecto activo en el periodo y umbrales de métricas configurados (CU-02).
async function verificarPrecondiciones(proyectoId) {
  const proyecto = await proyectoRepo.obtenerProyectoPeriodoActivo();
  if (!proyecto || (proyectoId && proyecto.id !== proyectoId)) {
    throw Object.assign(
      new Error('No existe un proyecto activo con ese identificador en el periodo en curso.'),
      { status: 404 },
    );
  }
  const umbralCumplimiento = await configRepo.obtenerUmbralVigente(proyecto.id, TipoMetrica.CUMPLIMIENTO_SQA);
  if (!umbralCumplimiento) {
    throw Object.assign(
      new Error('Primero configure las métricas de calidad y sus umbrales antes de gestionar actividades SQA.'),
      { status: 409 },
    );
  }
  return proyecto;
}

// FN-02 / FN-03 / FA-02.01 / FA-03.01 / FE-01:
// Planifica una actividad SQA con responsable, fecha planificada y artefacto.
// Si es revisión por pares, valida autor y al menos un revisor distinto del autor y le asocia el checklist del artefacto.
async function planificarActividad(proyectoId, dto = {}) {
  const proyecto = await verificarPrecondiciones(proyectoId);
  const actividadId = dto.actividadId;
  if (!actividadId) {
    return {
      valido: false,
      errores: [{ campo: 'actividadId', mensaje: 'Debe seleccionar una actividad del plan de QA.' }],
    };
  }

  const actividad = await actividadRepo.obtenerPorId(actividadId);
  if (!actividad || actividad.proyectoId !== proyecto.id) {
    throw Object.assign(new Error('La actividad seleccionada no existe o no pertenece al proyecto activo.'), { status: 404 });
  }

  const [periodo, miembros] = await Promise.all([
    proyectoRepo.obtenerPeriodoActivo(),
    proyectoRepo.obtenerMiembros(proyecto.id),
  ]);

  const errores = validador.validarPlanificacion(dto, miembros);
  const errorFecha = validador.validarFechaEnPeriodo(dto.fechaPlanificada, periodo);
  if (errorFecha) {
    errores.push(errorFecha);
  }

  // FA-02.01: Si NO es revisión por pares (PRUEBAS / AUDITORIA), se omiten autor y revisores.
  if (actividad.esRevisionPares()) {
    const errorRevisores = validador.validarRevisores(dto.autorId, dto.revisoresIds, miembros);
    if (errorRevisores) {
      errores.push(errorRevisores);
    }
  }

  // FA-03.01: Datos incompletos o inválidos -> no abre transacción
  if (errores.length > 0) {
    return {
      valido: false,
      errores,
    };
  }

  actividad.responsableId = dto.responsableId;
  actividad.fechaPlanificada = normalizarFechaISO(dto.fechaPlanificada);
  actividad.artefacto = String(dto.artefacto).trim();
  actividad.tipoArtefacto = inferirTipoArtefacto({
    nombre: actividad.nombre,
    fase: actividad.fase,
    tipoArtefacto: dto.tipoArtefacto || actividad.tipoArtefacto,
  });

  let plantillaChecklist = null;
  if (actividad.esRevisionPares()) {
    actividad.autorId = dto.autorId;
    actividad.revisoresIds = Array.isArray(dto.revisoresIds) ? dto.revisoresIds : [];
    plantillaChecklist = await checklistRepo.obtenerPorTipoArtefacto(actividad.tipoArtefacto);
  } else {
    actividad.autorId = null;
    actividad.revisoresIds = [];
  }

  // FN-03 / FE-01: Guardado dentro de transacción
  const actividadActualizada = await transacciones.ejecutar(async (tx) =>
    actividadRepo.guardarPlanificacion(actividad, tx));

  const miembroResp = miembros.find((m) => m.id === actividadActualizada.responsableId);
  const miembroAutor = miembros.find((m) => m.id === actividadActualizada.autorId);
  actividadActualizada.responsableNombre = miembroResp?.member_name || actividadActualizada.responsableNombre;
  actividadActualizada.autorNombre = miembroAutor?.member_name || actividadActualizada.autorNombre;

  return {
    valido: true,
    actividad: actividadActualizada,
    checklistAsociado: plantillaChecklist,
    errores: [],
  };
}

module.exports = {
  verificarPrecondiciones,
  planificarActividad,
};

