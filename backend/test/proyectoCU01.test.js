const test = require('node:test');
const assert = require('node:assert');

const validador = require('../src/services/ValidadorRegistro');
const generadorPlan = require('../src/services/GeneradorPlanQA');
const generadorTablero = require('../src/services/GeneradorTablero');
const { TipoProyecto, RolEquipo, FaseProyecto, NivelSemaforo, ProyectoExistenteException } = require('../src/services/entidades/proyecto');

// 1. Pruebas de validación de datos generales y roles obligatorios (FA-02.02)
test('CU-01 FA-02.02: ValidadorRegistro detecta datos generales faltantes o inválidos', () => {
  // Nombre vacío
  const errNombre = validador.validarDatosGenerales({ name: '', estimatedKloc: 5.5 });
  assert.ok(errNombre.some((e) => e.campo === 'nombre'));

  // Nombre muy corto (< 3 caracteres)
  const errCorto = validador.validarDatosGenerales({ name: 'AB', estimatedKloc: 5.5 });
  assert.ok(errCorto.some((e) => e.campo === 'nombre'));

  // KLOC faltante o negativo
  const errKlocFaltante = validador.validarDatosGenerales({ name: 'MetricDash', estimatedKloc: null });
  assert.ok(errKlocFaltante.some((e) => e.campo === 'tamanoProductoKLOC'));

  const errKlocNegativo = validador.validarDatosGenerales({ name: 'MetricDash', estimatedKloc: -2 });
  assert.ok(errKlocNegativo.some((e) => e.campo === 'tamanoProductoKLOC'));

  // Datos válidos
  const sinErrores = validador.validarDatosGenerales({
    name: 'MetricDash SQA',
    estimatedKloc: 3.5,
    projectType: TipoProyecto.DESARROLLO_NUEVO,
  });
  assert.strictEqual(sinErrores.length, 0);
});

test('CU-01 FA-02.02: ValidadorRegistro exige los tres roles obligatorios (QA, Técnico y Gestión)', () => {
  // Faltan todos los roles
  const errSinRoles = validador.validarRolesRequeridos([]);
  assert.ok(errSinRoles.length > 0);

  // Falta rol de Gestión de Proyecto
  const rolesIncompletos = [
    { role: RolEquipo.QA, memberName: 'Héctor Varela' },
    { role: RolEquipo.TECNICO, memberName: 'Carlos Aguirre' },
  ];
  const errGestion = validador.validarRolesRequeridos(rolesIncompletos);
  assert.ok(errGestion.some((e) => e.campo === 'rol_GESTION_PROYECTO'));

  // Falta rol de QA
  const sinQA = [
    { role: RolEquipo.TECNICO, memberName: 'Carlos Aguirre' },
    { role: RolEquipo.GESTION_PROYECTO, memberName: 'Karol Espino' },
  ];
  const errQA = validador.validarRolesRequeridos(sinQA);
  assert.ok(errQA.some((e) => e.campo === 'rol_QA'));

  // Roles completos válidos
  const rolesCompletos = [
    { role: RolEquipo.QA, memberName: 'Héctor Varela' },
    { role: RolEquipo.TECNICO, memberName: 'Carlos Aguirre' },
    { role: RolEquipo.GESTION_PROYECTO, memberName: 'Karol Espino' },
  ];
  const sinErroresRoles = validador.validarRolesRequeridos(rolesCompletos);
  assert.strictEqual(sinErroresRoles.length, 0);
});

test('CU-01 FN-03: GeneradorPlanQA propone actividades estructuradas por fase ISO/IEC 29110', () => {
  const plan = generadorPlan.generarPlanBase(TipoProyecto.DESARROLLO_NUEVO);
  assert.strictEqual(plan.tipoProyecto, TipoProyecto.DESARROLLO_NUEVO);
  assert.ok(plan.actividades.length >= 8);

  // Verificar presencia de fases
  const fases = new Set(plan.actividades.map((a) => a.phase));
  assert.ok(fases.has(FaseProyecto.ANALISIS_REQUERIMIENTOS));
  assert.ok(fases.has(FaseProyecto.DISENO_COMPONENTES));
  assert.ok(fases.has(FaseProyecto.CONSTRUCCION_SOFTWARE));
  assert.ok(fases.has(FaseProyecto.INTEGRACION_Y_PRUEBAS));

  // Verificar que todas tengan referencia ISO y responsable
  for (const act of plan.actividades) {
    assert.ok(act.title && act.title.length > 0);
    assert.ok(act.iso_practice_ref && act.iso_practice_ref.includes('29110'));
    assert.ok(Object.values(RolEquipo).includes(act.responsible_role));
  }

  // Adaptación para MANTENIMIENTO agrega análisis de impacto
  const planMant = generadorPlan.generarPlanBase(TipoProyecto.MANTENIMIENTO);
  assert.ok(planMant.actividades.some((a) => a.title.includes('Impacto')));
});

test('CU-01 FN-04: GeneradorTablero crea la línea base inicial en estado SIN_DATOS', () => {
  const tablero = generadorTablero.crearTableroInicial(
    { name: 'MetricDash', estimatedKloc: 4.2 },
    { approvalDate: '2026-10-19' },
    { totalActividades: 8 },
  );

  assert.strictEqual(tablero.cutoffNumber, 1);
  assert.strictEqual(tablero.kloc, 4.2);
  assert.strictEqual(tablero.plannedSqaActs, 8);
  assert.strictEqual(tablero.executedSqaActs, 0);
  assert.strictEqual(tablero.healthStatus, NivelSemaforo.SIN_DATOS);
  assert.strictEqual(tablero.indicadores.densidadDefectos.estado, NivelSemaforo.SIN_DATOS);
});

test('CU-01 FA-02.01: ProyectoExistenteException produce status 409 y mensaje de restricción monoproyecto', () => {
  const ex = new ProyectoExistenteException('AGO-DIC-2026');
  assert.strictEqual(ex.status, 409);
  assert.ok(ex.message.includes('AGO-DIC-2026'));
  assert.ok(ex.message.includes('un solo proyecto por periodo'));
});
