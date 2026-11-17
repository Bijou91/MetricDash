const { FaseProyecto, EstadoActividad, NivelSemaforo, ErrorValidacion } = require('./proyecto');
const { SeveridadDefecto, PrioridadDefecto } = require('./defecto');

const TipoActividad = Object.freeze({
  REVISION_PARES: 'REVISION_PARES',
  PRUEBAS: 'PRUEBAS',
  AUDITORIA: 'AUDITORIA',
});

const DictamenRevision = Object.freeze({
  APROBADO: 'APROBADO',
  APROBADO_CONDICIONADO: 'APROBADO_CONDICIONADO',
  RECHAZADO: 'RECHAZADO',
});

const TipoArtefactoChecklist = Object.freeze({
  VISION: 'VISION',
  SDS: 'SDS',
  UI: 'UI',
  PLAN: 'PLAN',
});

const CATEGORIA_A_TIPO_ACTIVIDAD = Object.freeze({
  REVIEW: TipoActividad.REVISION_PARES,
  REVISION_PARES: TipoActividad.REVISION_PARES,
  TEST: TipoActividad.PRUEBAS,
  PRUEBAS: TipoActividad.PRUEBAS,
  AUDIT: TipoActividad.AUDITORIA,
  AUDITORIA: TipoActividad.AUDITORIA,
  DEFECT: TipoActividad.AUDITORIA,
});

const ESTADO_DB_A_DOMINIO = Object.freeze({
  PLANNED: EstadoActividad.PLANIFICADA,
  PLANIFICADA: EstadoActividad.PLANIFICADA,
  IN_PROGRESS: EstadoActividad.EN_CURSO,
  EN_CURSO: EstadoActividad.EN_CURSO,
  DONE: EstadoActividad.REALIZADA,
  REALIZADA: EstadoActividad.REALIZADA,
});

function inferirTipoArtefacto(actividad = {}) {
  if (actividad.tipoArtefacto && TipoArtefactoChecklist[actividad.tipoArtefacto]) {
    return actividad.tipoArtefacto;
  }
  const titulo = String(actividad.nombre || actividad.title || '').toUpperCase();
  const fase = actividad.fase || actividad.phase;
  if (titulo.includes('SDS') || titulo.includes('ARQUITECTURA')) return TipoArtefactoChecklist.SDS;
  if (titulo.includes('UI') || titulo.includes('MODELO DE DATOS') || titulo.includes('PROTOTIPO')) return TipoArtefactoChecklist.UI;
  if (titulo.includes('CÓDIGO') || titulo.includes('CODIGO') || titulo.includes('ESTÁNDARES') || titulo.includes('BITÁCORA')) return TipoArtefactoChecklist.PLAN;
  if (fase === FaseProyecto.DISENO_COMPONENTES) return TipoArtefactoChecklist.SDS;
  if (fase === FaseProyecto.CONSTRUCCION_SOFTWARE) return TipoArtefactoChecklist.PLAN;
  return TipoArtefactoChecklist.VISION;
}

function normalizarFechaISO(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    return fecha.toISOString().slice(0, 10);
  }
  const str = String(fecha).trim();
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

class ActividadSQA {
  constructor({
    id,
    proyectoId,
    nombre,
    tipo,
    categoria,
    fase,
    practicaIso,
    rolResponsable,
    artefacto = null,
    tipoArtefacto = null,
    responsableId = null,
    responsableNombre = null,
    autorId = null,
    autorNombre = null,
    revisoresIds = [],
    fechaPlanificada = null,
    fechaEjecucion = null,
    estado = EstadoActividad.PLANIFICADA,
    evidenciaUrl = null,
    evidenciaRef = null,
    actaId = null,
    dictamenActa = null,
  }) {
    this.id = id;
    this.proyectoId = proyectoId;
    this.nombre = nombre;
    this.categoria = categoria || 'REVIEW';
    this.tipo = tipo || CATEGORIA_A_TIPO_ACTIVIDAD[this.categoria] || TipoActividad.REVISION_PARES;
    this.fase = fase;
    this.practicaIso = practicaIso || null;
    this.rolResponsable = rolResponsable || 'QA';
    this.artefacto = artefacto;
    this.tipoArtefacto = tipoArtefacto || inferirTipoArtefacto({ nombre, fase });
    this.responsableId = responsableId;
    this.responsableNombre = responsableNombre;
    this.autorId = autorId;
    this.autorNombre = autorNombre;
    this.revisoresIds = Array.isArray(revisoresIds) ? revisoresIds : [];
    this.fechaPlanificada = normalizarFechaISO(fechaPlanificada);
    this.fechaEjecucion = normalizarFechaISO(fechaEjecucion);
    this.estado = ESTADO_DB_A_DOMINIO[estado] || EstadoActividad.PLANIFICADA;
    this.evidenciaUrl = evidenciaUrl;
    this.evidenciaRef = evidenciaRef || evidenciaUrl;
    this.actaId = actaId || null;
    this.dictamenActa = dictamenActa || null;
  }

  esRevisionPares() {
    return this.tipo === TipoActividad.REVISION_PARES;
  }

  // FN-08: Son exigibles las actividades cuya fecha planificada ya llegó o que ya fueron realizadas.
  esExigible(fechaActual = new Date()) {
    if (this.estado === EstadoActividad.REALIZADA) return true;
    if (!this.fechaPlanificada) return false;
    const hoyStr = normalizarFechaISO(fechaActual) || new Date().toISOString().slice(0, 10);
    return this.fechaPlanificada <= hoyStr;
  }

  marcarRealizada(evidencia) {
    this.estado = EstadoActividad.REALIZADA;
    this.fechaEjecucion = normalizarFechaISO(new Date());
    if (evidencia) {
      this.evidenciaUrl = String(evidencia);
      this.evidenciaRef = String(evidencia);
    }
  }
}

class ItemChecklist {
  constructor({ id, descripcion, orden }) {
    this.id = id;
    this.descripcion = descripcion;
    this.orden = Number(orden);
  }
}

class ChecklistPlantilla {
  constructor({ id, tipoArtefacto, nombre = '', descripcion = '', items = [] }) {
    this.id = id;
    this.tipoArtefacto = tipoArtefacto;
    this.nombre = nombre;
    this.descripcion = descripcion;
    this.items = items.map((it) => (it instanceof ItemChecklist ? it : new ItemChecklist(it)));
  }
}

class ResultadoItem {
  constructor({
    itemId,
    descripcionItem = '',
    cumple = true,
    observacion = '',
    severidad = null,
    prioridad = null,
    descartarPorDuplicado = false,
    confirmarIncidenciaDistinta = false,
    folioDefectoExistente = null,
  }) {
    this.itemId = itemId;
    this.descripcionItem = descripcionItem;
    this.cumple = Boolean(cumple);
    this.observacion = typeof observacion === 'string' ? observacion.trim() : '';
    this.severidad = severidad || null;
    this.prioridad = prioridad || null;
    this.descartarPorDuplicado = Boolean(descartarPorDuplicado);
    this.confirmarIncidenciaDistinta = Boolean(confirmarIncidenciaDistinta);
    this.folioDefectoExistente = folioDefectoExistente || null;
  }

  esHallazgo() {
    return this.cumple === false;
  }

  validarCamposRequeridos() {
    if (!this.esHallazgo()) return [];
    const faltantes = [];
    if (!this.observacion) faltantes.push('observacion');
    if (!Object.values(SeveridadDefecto).includes(this.severidad)) faltantes.push('severidad');
    if (!Object.values(PrioridadDefecto).includes(this.prioridad)) faltantes.push('prioridad');
    return faltantes;
  }
}

class RevisionPorPares {
  constructor({
    id = null,
    actividadId,
    tipoArtefacto = TipoArtefactoChecklist.VISION,
    autorId,
    revisoresIds = [],
    rolRevisor = 'QA',
    dictamen = DictamenRevision.APROBADO,
    fechaRevision = new Date(),
    resultados = [],
  }) {
    this.id = id;
    this.actividadId = actividadId;
    this.tipoArtefacto = tipoArtefacto;
    this.autorId = autorId;
    this.revisoresIds = Array.isArray(revisoresIds) ? revisoresIds : [];
    this.rolRevisor = rolRevisor;
    this.dictamen = dictamen;
    this.fechaRevision = normalizarFechaISO(fechaRevision) || new Date().toISOString().slice(0, 10);
    this.resultados = resultados.map((r) => (r instanceof ResultadoItem ? r : new ResultadoItem(r)));
  }

  obtenerHallazgos() {
    return this.resultados.filter((r) => r.esHallazgo());
  }
}

class ActaRevision {
  constructor({
    id = null,
    actividadId,
    revisionId = null,
    fechaEmision = new Date(),
    dictamen,
    resumenHallazgos = '',
    foliosDefectos = [],
    defectosIds = [],
    minutesUrl = null,
    totalItems = 0,
    itemsCumple = 0,
    itemsNoCumple = 0,
  }) {
    this.id = id;
    this.actividadId = actividadId;
    this.revisionId = revisionId;
    this.fechaEmision = normalizarFechaISO(fechaEmision) || new Date().toISOString().slice(0, 10);
    this.dictamen = dictamen;
    this.resumenHallazgos = resumenHallazgos;
    this.foliosDefectos = foliosDefectos;
    this.defectosIds = defectosIds;
    this.minutesUrl = minutesUrl;
    this.totalItems = totalItems;
    this.itemsCumple = itemsCumple;
    this.itemsNoCumple = itemsNoCumple;
  }
}

function resultadoCierreActividad(campos = {}) {
  return {
    exito: false,
    requiereDecisionDuplicado: false,
    coincidencias: [],
    actaId: null,
    acta: null,
    cumplimientoSQA: null,
    densidadDefectos: null,
    nivelSemaforo: NivelSemaforo.SIN_DATOS,
    alertaEmitida: null,
    errores: [],
    ...campos,
  };
}

module.exports = {
  TipoActividad,
  EstadoActividad,
  DictamenRevision,
  TipoArtefactoChecklist,
  CATEGORIA_A_TIPO_ACTIVIDAD,
  ESTADO_DB_A_DOMINIO,
  inferirTipoArtefacto,
  normalizarFechaISO,
  ActividadSQA,
  ItemChecklist,
  ChecklistPlantilla,
  ResultadoItem,
  RevisionPorPares,
  ActaRevision,
  ErrorValidacion,
  resultadoCierreActividad,
};

