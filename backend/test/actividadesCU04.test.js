// CU-04 Planear y registrar una actividad SQA: entidades, validadores, servicios y controlador con dobles.
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const express = require('express');

const pool = require('../src/data/pool');
const transacciones = require('../src/data/TransaccionManager');
const actividadRepo = require('../src/data/ActividadSQARepository');
const peerReviewRepo = require('../src/data/PeerReviewRepository');
const defectoRepo = require('../src/data/DefectoRepository');
const proyectoRepo = require('../src/data/ProyectoRepository');
const configRepo = require('../src/data/ConfiguracionMetricasRepository');
const tableroRepo = require('../src/data/TableroControlRepository');
const pruebasRepo = require('../src/data/PruebasRepository');

const validadorPlan = require('../src/services/ValidadorPlanificacionSQA');
const validadorEjec = require('../src/services/ValidadorEjecucionSQA');
const calculoCumplimiento = require('../src/services/ServicioCalculoCumplimientoSQA');
const servicioActividades = require('../src/services/ServicioActividadesSQA');

const {
  TipoArtefacto,
  DictamenRevision,
  CategoriaActividad,
  EstadoActividadSQA,
  ChecklistsPorArtefacto,
  HallazgoChecklist,
  RevisionPares,
  ActividadSQA,
} = require('../src/services/entidades/actividadSQA');
const { Defecto, SeveridadDefecto, PrioridadDefecto } = require('../src/services/entidades/defecto');
const { MetricaCalidad, TipoMetrica } = require('../src/services/entidades/metricas');
const { NivelSemaforo } = require('../src/services/entidades/proyecto');
const { TableroControl } = require('../src/services/entidades/pruebas');

afterEach(() => mock.restoreAll());

const PROYECTO_ID = '00000000-0000-0000-0000-000000000001';
const CORTE_ID = '00000000-0000-0000-0000-0000000000c1';
const ACTIVIDAD_REV_ID = '00000000-0000-0000-0000-0000000000a1';
const ACTIVIDAD_TEST_ID = '00000000-0000-0000-0000-0000000000a2';
const MIEMBRO_QA = '00000000-0000-0000-0000-0000000000m1';
const MIEMBRO_DEV = '00000000-0000-0000-0000-0000000000m2';
const MIEMBRO_TEC = '00000000-0000-0000-0000-0000000000m3';

const proyecto = { id: PROYECTO_ID, name: 'MetricDash SQA', period_code: 'AGO-DIC-2026', estimated_kloc: '4.5' };
const periodo = { id: 'p1', code: 'AGO-DIC-2026', start_date: '2026-08-15', end_date: '2026-12-19', is_active: true };
const miembros = [
  { id: MIEMBRO_QA, member_name: 'Héctor QA', role: 'QA' },
  { id: MIEMBRO_DEV, member_name: 'Ana Dev', role: 'DEVELOPER' },
  { id: MIEMBRO_TEC, member_name: 'Carlos Tech', role: 'TECNICO' },
];

const actividadRev = {
  id: ACTIVIDAD_REV_ID,
  project_id: PROYECTO_ID,
  title: 'Revisión de Especificación de Casos de Uso',
  category: 'REVIEW',
  phase: 'ANALISIS_REQUERIMIENTOS',
  status: 'PLANNED',
  responsible_member_id: MIEMBRO_QA,
  author_id: MIEMBRO_DEV,
  reviewer_ids: [MIEMBRO_QA, MIEMBRO_TEC],
  artifact: 'SGU',
};

const actividadTest = {
  id: ACTIVIDAD_TEST_ID,
  project_id: PROYECTO_ID,
  title: 'Ejecución de Pruebas de Integración',
  category: 'TEST',
  phase: 'INTEGRACION_Y_PRUEBAS',
  status: 'PLANNED',
  responsible_member_id: MIEMBRO_QA,
  artifact: 'VERSION',
};

const cortes = [
  { id: CORTE_ID, project_id: PROYECTO_ID, cutoff_number: 1, cutoff_name: 'CP1-Baseline', cutoff_date: '2026-09-01', kloc: '4.5', health_status: 'SIN_DATOS' },
];

const umbralCumplimiento = () => new MetricaCalidad({ tipo: TipoMetrica.CUMPLIMIENTO_SQA, meta: 90, umbralAdvertencia: 75, umbralCritico: 60 });
const umbralDensidad = () => new MetricaCalidad({ tipo: TipoMetrica.DENSIDAD_DEFECTOS, meta: 1, umbralAdvertencia: 3, umbralCritico: 5 });

const mockTx = {
  query: async () => ({ rows: [{ n: 1 }] }),
};

async function llamar(method, path, body) {
  const router = require('../src/controllers/ActividadSQAController');
  const server = express().use(express.json()).use('/api', router).listen(0);
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

function mockContextoValido() {
  mock.method(proyectoRepo, 'obtenerProyectoPeriodoActivo', async () => proyecto);
  mock.method(proyectoRepo, 'obtenerMiembros', async () => miembros);
  mock.method(proyectoRepo, 'obtenerPeriodoActivo', async () => periodo);
  mock.method(proyectoRepo, 'listarCortes', async () => cortes);
  mock.method(proyectoRepo, 'obtenerCorteActual', async () => cortes[0]);
  mock.method(configRepo, 'obtenerVigente', async () => ({
    id: 'cfg-1',
    metricas: [
      { tipo: TipoMetrica.CUMPLIMIENTO_SQA, meta: 90, umbralAdvertencia: 75, umbralCritico: 60 },
      { tipo: TipoMetrica.DENSIDAD_DEFECTOS, meta: 1, umbralAdvertencia: 3, umbralCritico: 5 },
    ],
  }));
  mock.method(configRepo, 'obtenerMedicion', async () => ({ sqa_compliance_pct: '80', defect_density: '0.5' }));
  mock.method(actividadRepo, 'listarPorProyecto', async () => [actividadRev, actividadTest]);
  mock.method(actividadRepo, 'obtenerMetricasCumplimiento', async () => ({ totalActividades: 8, realizadas: 4, exigibles: 5 }));
  mock.method(pruebasRepo, 'listarPorProyecto', async () => []);
}

// ------------------------------------------------------------- 1. Dominio y Cálculo

test('CU-04 FN-08: ServicioCalculoCumplimientoSQA calcula el porcentaje exacto y maneja frontera 0 exigibles', () => {
  assert.strictEqual(calculoCumplimiento.calcularCumplimiento(4, 5), 80);
  assert.strictEqual(calculoCumplimiento.calcularCumplimiento(2, 3), 66.67);
  assert.strictEqual(calculoCumplimiento.calcularCumplimiento(0, 0), 100);

  const med = calculoCumplimiento.generarMedicionCumplimiento(4, 5);
  assert.strictEqual(med.tipoMetrica, TipoMetrica.CUMPLIMIENTO_SQA);
  assert.strictEqual(med.valorCalculado, 80);
});

test('CU-04 Entidad ActividadSQA: determina exigibilidad por fecha y estado', () => {
  const pasada = new ActividadSQA({ plannedDate: '2026-09-01', status: 'PLANNED' });
  const futura = new ActividadSQA({ plannedDate: '2026-12-01', status: 'PLANNED' });
  const realizadaFutura = new ActividadSQA({ plannedDate: '2026-12-01', status: 'DONE' });

  const refHoy = new Date('2026-10-15');
  assert.strictEqual(pasada.esExigible(refHoy), true);
  assert.strictEqual(futura.esExigible(refHoy), false);
  assert.strictEqual(realizadaFutura.esExigible(refHoy), true);
});

// ------------------------------------------------------------- 2. Validadores

test('CU-04 FA-03.01: ValidadorPlanificacionSQA detecta campos obligatorios faltantes', () => {
  const res = validadorPlan.validarPlanificacion({
    dto: {},
    actividad: actividadRev,
    miembros,
    periodo,
    fechaHoy: new Date('2026-09-01'),
  });
  assert.strictEqual(res.esValido, false);
  const campos = res.errores.map((e) => e.campo);
  assert.ok(campos.includes('responsibleMemberId'));
  assert.ok(campos.includes('artifact'));
  assert.ok(campos.includes('plannedDate'));
  assert.ok(campos.includes('authorId'));
  assert.ok(campos.includes('reviewerIds'));
});

test('CU-04 FA-03.01: ValidadorPlanificacionSQA rechaza fecha pasada y fuera de periodo', () => {
  const fechaHoy = new Date('2026-09-15');
  // Fecha pasada
  const resPasada = validadorPlan.validarPlanificacion({
    dto: { responsibleMemberId: MIEMBRO_QA, artifact: 'SGU', plannedDate: '2026-09-10', authorId: MIEMBRO_DEV, reviewerIds: [MIEMBRO_QA] },
    actividad: actividadRev,
    miembros,
    periodo,
    fechaHoy,
  });
  assert.strictEqual(resPasada.esValido, false);
  assert.ok(resPasada.errores.some((e) => e.campo === 'plannedDate' && e.mensaje.includes('anterior a la fecha actual')));

  // Fecha fuera de periodo (periodo acaba en 2026-12-19)
  const resFuera = validadorPlan.validarPlanificacion({
    dto: { responsibleMemberId: MIEMBRO_QA, artifact: 'SGU', plannedDate: '2026-12-25', authorId: MIEMBRO_DEV, reviewerIds: [MIEMBRO_QA] },
    actividad: actividadRev,
    miembros,
    periodo,
    fechaHoy,
  });
  assert.strictEqual(resFuera.esValido, false);
  assert.ok(resFuera.errores.some((e) => e.campo === 'plannedDate' && e.mensaje.includes('periodo académico activo')));
});

test('CU-04 FA-03.01: ValidadorPlanificacionSQA exige al menos un revisor distinto del autor', () => {
  const res = validadorPlan.validarPlanificacion({
    dto: {
      responsibleMemberId: MIEMBRO_QA,
      artifact: 'SGU',
      plannedDate: '2026-11-20',
      authorId: MIEMBRO_DEV,
      reviewerIds: [MIEMBRO_DEV], // El único revisor es el mismo autor
    },
    actividad: actividadRev,
    miembros,
    periodo,
    fechaHoy: new Date('2026-11-02'),
  });
  assert.strictEqual(res.esValido, false);
  assert.ok(res.errores.some((e) => e.campo === 'reviewerIds' && e.mensaje.includes('distinto del autor')));
});

test('CU-04 FA-02.01: ValidadorPlanificacionSQA en actividad TEST no exige autor ni revisores', () => {
  const res = validadorPlan.validarPlanificacion({
    dto: {
      responsibleMemberId: MIEMBRO_QA,
      artifact: 'VERSION',
      plannedDate: '2026-11-20',
    },
    actividad: actividadTest,
    miembros,
    periodo,
    fechaHoy: new Date('2026-11-02'),
  });
  assert.strictEqual(res.esValido, true);
});

test('CU-04 FA-05.01: ValidadorEjecucionSQA bloquea hallazgo "no cumple" sin severidad, prioridad u observación', () => {
  const resIncompleto = validadorEjec.validarCierreRevision({
    verdict: 'CONDICIONAL',
    findingsSummary: 'Varios detalles encontrados',
    checklistResults: [
      { itemId: 'CHK-01', cumple: false, observacion: '' }, // Incompleto
    ],
  });
  assert.strictEqual(resIncompleto.esValido, false);
  assert.ok(resIncompleto.errores.some((e) => e.campo === 'checklistResults'));

  const resCompleto = validadorEjec.validarCierreRevision({
    verdict: 'CONDICIONAL',
    findingsSummary: 'Varios detalles encontrados',
    checklistResults: [
      { itemId: 'CHK-01', cumple: false, observacion: 'Falta validar nulos', severidad: 'ALTA', prioridad: 'INMEDIATA' },
      { itemId: 'CHK-02', cumple: true },
    ],
  });
  assert.strictEqual(resCompleto.esValido, true);
});

// ------------------------------------------------------------- 3. Controlador y Flujos

test('CU-04 Controlador Precondición 2 y 3: responde 404 sin proyecto activo y 409 sin umbrales', async () => {
  mock.method(proyectoRepo, 'obtenerProyectoPeriodoActivo', async () => null);
  const r1 = await llamar('GET', `/proyectos/${PROYECTO_ID}/actividades-sqa`);
  assert.strictEqual(r1.status, 404);

  mock.method(proyectoRepo, 'obtenerProyectoPeriodoActivo', async () => proyecto);
  mock.method(configRepo, 'obtenerVigente', async () => null);
  const r2 = await llamar('GET', `/proyectos/${PROYECTO_ID}/actividades-sqa`);
  assert.strictEqual(r2.status, 409);
});

test('CU-04 Controlador FN-01: GET actividades devuelve contexto, plan base y métricas de cumplimiento', async () => {
  mockContextoValido();
  const res = await llamar('GET', `/proyectos/${PROYECTO_ID}/actividades-sqa`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.proyecto.id, PROYECTO_ID);
  assert.strictEqual(res.body.actividades.length, 2);
  assert.strictEqual(res.body.metricasCumplimiento.porcentajeCumplimiento, 80);
});

test('CU-04 Controlador FN-02 / FN-03: planificar actividad con datos válidos responde 200 y retorna checklist', async () => {
  mockContextoValido();
  mock.method(actividadRepo, 'obtenerPorId', async () => ({ ...actividadRev, project_id: PROYECTO_ID }));
  mock.method(actividadRepo, 'guardarPlanificacion', async (_id, d) => ({ ...actividadRev, ...d, status: 'PLANNED' }));

  const planDto = {
    responsibleMemberId: MIEMBRO_QA,
    plannedDate: '2026-11-20',
    artifact: 'SGU',
    authorId: MIEMBRO_DEV,
    reviewerIds: [MIEMBRO_QA, MIEMBRO_TEC],
  };

  const res = await llamar('PUT', `/proyectos/${PROYECTO_ID}/actividades-sqa/${ACTIVIDAD_REV_ID}/planificar`, planDto);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.actividad.artifact, 'SGU');
  assert.ok(res.body.checklist.length > 0);
});

test('CU-04 Controlador FA-03.01: planificar con fecha anterior a hoy responde 400 con errores', async () => {
  mockContextoValido();
  mock.method(actividadRepo, 'obtenerPorId', async () => ({ ...actividadRev, project_id: PROYECTO_ID }));

  const planDto = {
    responsibleMemberId: MIEMBRO_QA,
    plannedDate: '2020-01-01',
    artifact: 'SGU',
    authorId: MIEMBRO_DEV,
    reviewerIds: [MIEMBRO_QA],
  };

  const res = await llamar('PUT', `/proyectos/${PROYECTO_ID}/actividades-sqa/${ACTIVIDAD_REV_ID}/planificar`, planDto);
  assert.strictEqual(res.status, 400);
  assert.ok(res.body.errores.some((e) => e.campo === 'plannedDate'));
});

test('CU-04 Controlador FN-04: GET checklist devuelve el banco de preguntas del artefacto', async () => {
  mock.method(actividadRepo, 'obtenerPorId', async () => ({ ...actividadRev, artifact: 'VERSION' }));
  const res = await llamar('GET', `/proyectos/${PROYECTO_ID}/actividades-sqa/${ACTIVIDAD_REV_ID}/checklist`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.artefacto, 'VERSION');
  assert.strictEqual(res.body.checklist.length, ChecklistsPorArtefacto.VERSION.length);
});

test('CU-04 Controlador FN-06 / FA-06.01: buscar-duplicados detecta coincidencias con defectos existentes', async () => {
  mockContextoValido();
  mock.method(actividadRepo, 'obtenerPorId', async () => ({ ...actividadRev, project_id: PROYECTO_ID }));
  mock.method(defectoRepo, 'buscarSimilaresPorProyecto', async () => [
    { id: 'def-1', folio: 'DEF-001', descripcionDetallada: 'Error en la validacion de campos nulos en formulario', severidad: 'MEDIA' },
  ]);

  const body = {
    hallazgos: [
      { itemId: 'CHK-01', cumple: false, observacion: 'Error en validacion de campos nulos del formulario' },
    ],
  };

  const res = await llamar('POST', `/proyectos/${PROYECTO_ID}/actividades-sqa/${ACTIVIDAD_REV_ID}/buscar-duplicados`, body);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.hallazgos[0].tieneDuplicados, true);
  assert.strictEqual(res.body.hallazgos[0].coincidencias[0].folio, 'DEF-001');
});

test('CU-04 Controlador FN-07 a FN-09: cerrar revisión por pares guarda defectos, acta y recalcula métricas', async () => {
  mockContextoValido();
  mock.method(actividadRepo, 'obtenerPorId', async () => ({
    ...actividadRev,
    project_id: PROYECTO_ID,
    artifact: 'SGU',
    author_id: MIEMBRO_DEV,
    responsible_member_id: MIEMBRO_QA,
  }));

  mock.method(transacciones, 'ejecutarEnTransaccion', async (op) => op(mockTx));
  mock.method(defectoRepo, 'guardar', async (d, _c, _tx) => ({ ...d, id: 'def-nuevo', folio: 'DEF-002' }));
  mock.method(peerReviewRepo, 'guardar', async (r, _tx) => ({ ...r, id: 'rev-1' }));
  mock.method(actividadRepo, 'marcarRealizada', async (id, url, _tx) => ({ ...actividadRev, id, status: 'DONE', evidence_url: url }));
  mock.method(actividadRepo, 'obtenerMetricasCumplimiento', async () => ({ totalActividades: 8, realizadas: 5, exigibles: 5 }));
  mock.method(configRepo, 'guardarMedicion', async () => {});
  mock.method(configRepo, 'obtenerUmbralVigente', async (_pid, t) => (t === TipoMetrica.CUMPLIMIENTO_SQA ? umbralCumplimiento() : umbralDensidad()));
  mock.method(defectoRepo, 'contarDefectosProyecto', async () => 2);
  mock.method(tableroRepo, 'obtenerPorProyecto', async (pid) => new TableroControl({ proyectoId: pid }));
  mock.method(tableroRepo, 'guardar', async () => {});

  const cierreDto = {
    verdict: 'CONDICIONAL',
    findingsSummary: 'Revisión concluida con 1 hallazgo a resolver.',
    checklistResults: [
      {
        itemId: 'CHK-SGU-01',
        cumple: false,
        observacion: 'Falta especificar casos alternativos de desconexión',
        severidad: 'MEDIA',
        prioridad: 'ALTA',
        confirmarIncidenciaDistinta: true,
      },
      {
        itemId: 'CHK-SGU-02',
        cumple: true,
      },
    ],
  };

  const res = await llamar('POST', `/proyectos/${PROYECTO_ID}/actividades-sqa/${ACTIVIDAD_REV_ID}/cerrar-revision`, cierreDto);
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.actividad.status, 'DONE');
  assert.strictEqual(res.body.defectosCreados.length, 1);
  assert.strictEqual(res.body.medicionCumplimiento.valorCalculado, 100);
});

test('CU-04 Controlador FA-06.01: hallazgo duplicado descartado no crea nuevo defecto y queda referenciado en el acta', async () => {
  mockContextoValido();
  mock.method(actividadRepo, 'obtenerPorId', async () => ({
    ...actividadRev,
    project_id: PROYECTO_ID,
    artifact: 'SGU',
    author_id: MIEMBRO_DEV,
    responsible_member_id: MIEMBRO_QA,
  }));

  mock.method(transacciones, 'ejecutarEnTransaccion', async (op) => op(mockTx));
  let defectosGuardados = 0;
  mock.method(defectoRepo, 'guardar', async () => { defectosGuardados++; });
  mock.method(peerReviewRepo, 'guardar', async (r) => r);
  mock.method(actividadRepo, 'marcarRealizada', async () => ({ ...actividadRev, status: 'DONE' }));
  mock.method(actividadRepo, 'obtenerMetricasCumplimiento', async () => ({ totalActividades: 8, realizadas: 5, exigibles: 5 }));
  mock.method(configRepo, 'guardarMedicion', async () => {});
  mock.method(configRepo, 'obtenerUmbralVigente', async (_pid, t) => (t === TipoMetrica.CUMPLIMIENTO_SQA ? umbralCumplimiento() : umbralDensidad()));
  mock.method(tableroRepo, 'obtenerPorProyecto', async (pid) => new TableroControl({ proyectoId: pid }));
  mock.method(tableroRepo, 'guardar', async () => {});

  const cierreDto = {
    verdict: 'APROBADO',
    findingsSummary: 'Hallazgo ya conocido en DEF-001.',
    checklistResults: [
      {
        itemId: 'CHK-SGU-01',
        cumple: false,
        observacion: 'Falta validar nulos en formulario',
        severidad: 'MEDIA',
        prioridad: 'ALTA',
        descartado: true,
        folioReferenciado: 'DEF-001',
      },
    ],
  };

  const res = await llamar('POST', `/proyectos/${PROYECTO_ID}/actividades-sqa/${ACTIVIDAD_REV_ID}/cerrar-revision`, cierreDto);
  assert.strictEqual(res.status, 201);
  assert.strictEqual(defectosGuardados, 0); // No se creó ningún defecto
  assert.strictEqual(res.body.defectosCreados.length, 0);
  assert.strictEqual(res.body.acta.checklistResults[0].folioReferenciado, 'DEF-001');
});

test('CU-04 Controlador FA-04.01: cerrar actividad de pruebas o auditoría con evidencia', async () => {
  mockContextoValido();
  mock.method(actividadRepo, 'obtenerPorId', async () => ({
    ...actividadTest,
    project_id: PROYECTO_ID,
  }));

  mock.method(transacciones, 'ejecutarEnTransaccion', async (op) => op(mockTx));
  mock.method(actividadRepo, 'marcarRealizada', async (id, url) => ({ ...actividadTest, id, status: 'DONE', evidence_url: url }));
  mock.method(actividadRepo, 'obtenerMetricasCumplimiento', async () => ({ totalActividades: 8, realizadas: 5, exigibles: 5 }));
  mock.method(configRepo, 'guardarMedicion', async () => {});
  mock.method(configRepo, 'obtenerUmbralVigente', async () => umbralCumplimiento());
  mock.method(tableroRepo, 'obtenerPorProyecto', async (pid) => new TableroControl({ proyectoId: pid }));
  mock.method(tableroRepo, 'guardar', async () => {});

  const cierreDto = { testSuiteId: 'ronda-01' };
  const res = await llamar('POST', `/proyectos/${PROYECTO_ID}/actividades-sqa/${ACTIVIDAD_TEST_ID}/cerrar-evidencia`, cierreDto);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.actividad.status, 'DONE');
  assert.strictEqual(res.body.medicionCumplimiento.valorCalculado, 100);
});

test('CU-04 Controlador FA-09.01: emite alerta visual si se registra un defecto crítico', async () => {
  mockContextoValido();
  mock.method(actividadRepo, 'obtenerPorId', async () => ({
    ...actividadRev,
    project_id: PROYECTO_ID,
  }));

  mock.method(transacciones, 'ejecutarEnTransaccion', async (op) => op(mockTx));
  mock.method(defectoRepo, 'guardar', async (d) => ({ ...d, id: 'def-critico', folio: 'DEF-003' }));
  mock.method(peerReviewRepo, 'guardar', async (r) => r);
  mock.method(actividadRepo, 'marcarRealizada', async () => ({ ...actividadRev, status: 'DONE' }));
  mock.method(actividadRepo, 'obtenerMetricasCumplimiento', async () => ({ totalActividades: 8, realizadas: 5, exigibles: 5 }));
  mock.method(configRepo, 'guardarMedicion', async () => {});
  mock.method(configRepo, 'obtenerUmbralVigente', async (_pid, t) => (t === TipoMetrica.CUMPLIMIENTO_SQA ? umbralCumplimiento() : umbralDensidad()));
  mock.method(defectoRepo, 'contarDefectosProyecto', async () => 1);
  mock.method(tableroRepo, 'obtenerPorProyecto', async (pid) => new TableroControl({ proyectoId: pid }));
  mock.method(tableroRepo, 'guardar', async () => {});

  const cierreDto = {
    verdict: 'RECHAZADO',
    findingsSummary: 'Falla crítica de seguridad en autenticación',
    checklistResults: [
      {
        itemId: 'CHK-VER-03',
        cumple: false,
        observacion: 'Inyección SQL detectable en el inicio de sesión',
        severidad: 'CRITICA',
        prioridad: 'INMEDIATA',
      },
    ],
  };

  const res = await llamar('POST', `/proyectos/${PROYECTO_ID}/actividades-sqa/${ACTIVIDAD_REV_ID}/cerrar-revision`, cierreDto);
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.alerta);
  assert.ok(res.body.alerta.mensajeAlerta.includes('CRÍTICA'));
});

test('CU-04 Controlador FE-01: falla de BD hace rollback y responde 500 con mensaje de reintento', async () => {
  mockContextoValido();
  mock.method(actividadRepo, 'obtenerPorId', async () => ({
    ...actividadRev,
    project_id: PROYECTO_ID,
  }));
  mock.method(transacciones, 'ejecutarEnTransaccion', async () => {
    throw new transacciones.ErrorPersistencia('Error al guardar en base de datos. Se realizó rollback.');
  });

  const cierreDto = {
    verdict: 'APROBADO',
    findingsSummary: 'Todo en orden',
    checklistResults: [{ itemId: 'CHK-01', cumple: true }],
  };

  const res = await llamar('POST', `/proyectos/${PROYECTO_ID}/actividades-sqa/${ACTIVIDAD_REV_ID}/cerrar-revision`, cierreDto);
  assert.strictEqual(res.status, 500);
  assert.ok(res.body.mensaje.includes('rollback'));
});
