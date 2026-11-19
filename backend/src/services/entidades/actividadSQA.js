const TipoArtefacto = Object.freeze({
  VERSION: 'VERSION',
  SGU: 'SGU',
  UI: 'UI',
  PLAN: 'PLAN',
});

const DictamenRevision = Object.freeze({
  APROBADO: 'APROBADO',
  CONDICIONAL: 'CONDICIONAL',
  RECHAZADO: 'RECHAZADO',
});

const CategoriaActividad = Object.freeze({
  REVIEW: 'REVIEW',
  TEST: 'TEST',
  DEFECT: 'DEFECT',
  AUDIT: 'AUDIT',
});

const EstadoActividadSQA = Object.freeze({
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
});

const ChecklistsPorArtefacto = Object.freeze({
  [TipoArtefacto.VERSION]: [
    { id: 'CHK-VER-01', pregunta: '¿El código sigue los lineamientos de codificación y arquitectura establecidos?' },
    { id: 'CHK-VER-02', pregunta: '¿Existe suite de pruebas unitarias y se encuentra libre de código muerto o duplicado?' },
    { id: 'CHK-VER-03', pregunta: '¿Se manejan adecuadamente los errores y excepciones sin exponer datos sensibles?' },
    { id: 'CHK-VER-04', pregunta: '¿Las consultas a base de datos y transacciones garantizan atomicidad e integridad?' },
  ],
  [TipoArtefacto.SGU]: [
    { id: 'CHK-SGU-01', pregunta: '¿La especificación del caso de uso es clara, precisa y libre de ambigüedades?' },
    { id: 'CHK-SGU-02', pregunta: '¿Existe trazabilidad completa con los objetivos y reglas de negocio del proyecto?' },
    { id: 'CHK-SGU-03', pregunta: '¿Los criterios de aceptación, precondiciones y postcondiciones son verificables?' },
    { id: 'CHK-SGU-04', pregunta: '¿Se encuentran debidamente especificados los flujos alternativos y de excepción?' },
  ],
  [TipoArtefacto.UI]: [
    { id: 'CHK-UI-01', pregunta: '¿El diseño es consistente con los estándares visuales y componentes del sistema?' },
    { id: 'CHK-UI-02', pregunta: '¿La jerarquía visual y navegación es intuitiva y cuenta con accesibilidad adecuada?' },
    { id: 'CHK-UI-03', pregunta: '¿Se contemplan estados de carga, estados vacíos y retroalimentación de error?' },
    { id: 'CHK-UI-04', pregunta: '¿El diseño es responsivo y se adapta correctamente a las resoluciones previstas?' },
  ],
  [TipoArtefacto.PLAN]: [
    { id: 'CHK-PLN-01', pregunta: '¿El plan cubre todas las fases y actividades del ciclo de vida del proyecto?' },
    { id: 'CHK-PLN-02', pregunta: '¿La asignación de responsables y fechas es viable dentro del periodo académico?' },
    { id: 'CHK-PLN-03', pregunta: '¿Se definieron con claridad los umbrales y criterios de calidad para los entregables?' },
    { id: 'CHK-PLN-04', pregunta: '¿Están definidos los mecanismos de auditoría, bitácora y control de cambios?' },
  ],
});

class HallazgoChecklist {
  constructor({
    itemId,
    pregunta = '',
    cumple = true,
    observacion = '',
    severidad = null,
    prioridad = null,
    duplicadoDetectado = null,
    descartado = false,
    folioReferenciado = null,
    defectoId = null,
  }) {
    this.itemId = itemId;
    this.pregunta = pregunta;
    this.cumple = Boolean(cumple);
    this.observacion = (observacion || '').trim();
    this.severidad = severidad;
    this.prioridad = prioridad;
    this.duplicadoDetectado = duplicadoDetectado;
    this.descartado = Boolean(descartado);
    this.folioReferenciado = folioReferenciado;
    this.defectoId = defectoId;
  }
}

class RevisionPares {
  constructor({
    id = null,
    activityId,
    workProduct,
    authorId = null,
    reviewDate = new Date(),
    reviewerRole = null,
    reviewers = [],
    verdict,
    findingsSummary,
    minutesUrl = null,
    checklistResults = [],
  }) {
    this.id = id;
    this.activityId = activityId;
    this.workProduct = workProduct;
    this.authorId = authorId;
    this.reviewDate = reviewDate;
    this.reviewerRole = reviewerRole;
    this.reviewers = reviewers;
    this.verdict = verdict;
    this.findingsSummary = findingsSummary;
    this.minutesUrl = minutesUrl;
    this.checklistResults = checklistResults.map((h) => new HallazgoChecklist(h));
  }

  obtenerNoCumple() {
    return this.checklistResults.filter((h) => !h.cumple);
  }
}

class ActividadSQA {
  constructor({
    id = null,
    projectId,
    title,
    category,
    phase,
    isoPracticeRef = null,
    plannedDate = null,
    executionDate = null,
    status = EstadoActividadSQA.PLANNED,
    responsibleRole = null,
    responsibleMemberId = null,
    authorId = null,
    reviewerIds = [],
    artifact = null,
    evidenceUrl = null,
  }) {
    this.id = id;
    this.projectId = projectId;
    this.title = title;
    this.category = category;
    this.phase = phase;
    this.isoPracticeRef = isoPracticeRef;
    this.plannedDate = plannedDate;
    this.executionDate = executionDate;
    this.status = status;
    this.responsibleRole = responsibleRole;
    this.responsibleMemberId = responsibleMemberId;
    this.authorId = authorId;
    this.reviewerIds = reviewerIds;
    this.artifact = artifact;
    this.evidenceUrl = evidenceUrl;
  }

  esRevisionPorPares() {
    return this.category === CategoriaActividad.REVIEW;
  }

  esRealizada() {
    return this.status === EstadoActividadSQA.DONE || this.status === 'REALIZADA';
  }

  esExigible(fechaReferencia = new Date()) {
    if (this.esRealizada()) return true;
    if (!this.plannedDate) return false;
    const ref = new Date(fechaReferencia);
    ref.setHours(23, 59, 59, 999);
    const plan = new Date(this.plannedDate);
    return plan <= ref;
  }
}

module.exports = {
  TipoArtefacto,
  DictamenRevision,
  CategoriaActividad,
  EstadoActividadSQA,
  ChecklistsPorArtefacto,
  HallazgoChecklist,
  RevisionPares,
  ActividadSQA,
};
