// CU-05 Registrar los resultados de pruebas: entidades, validadores, servicios, repositorios y controlador con dobles (sin PostgreSQL).
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const express = require('express');

const pool = require('../src/data/pool');
const transacciones = require('../src/data/TransaccionManager');
const proyectoRepo = require('../src/data/ProyectoRepository');
const configRepo = require('../src/data/ConfiguracionMetricasRepository');
const pruebasRepo = require('../src/data/PruebasRepository');
const tableroRepo = require('../src/data/TableroControlRepository');
const validador = require('../src/services/ValidadorRondaPruebas');
const calculoPruebas = require('../src/services/ServicioCalculoPruebas');
const evaluarMetricas = require('../src/services/ServicioEvaluarMetricas');
const servicioPruebas = require('../src/services/ServicioRegistroPruebas');
const { RondaPruebas, TableroControl } = require('../src/services/entidades/pruebas');
const { MedicionMetrica } = require('../src/services/entidades/defecto');
const { MetricaCalidad, TipoMetrica } = require('../src/services/entidades/metricas');
const { NivelSemaforo } = require('../src/services/entidades/proyecto');

afterEach(() => mock.restoreAll());

const PROYECTO_ID = '00000000-0000-0000-0000-000000000001';
const CORTE_ID = '00000000-0000-0000-0000-0000000000c1';
const proyecto = { id: PROYECTO_ID, name: 'MetricDash SQA', period_code: 'AGO-DIC-2026', estimated_kloc: '4.5' };
const cortes = [
  { id: CORTE_ID, project_id: PROYECTO_ID, cutoff_number: 1, cutoff_name: 'CP1-Baseline', cutoff_date: '2026-09-01', kloc: '4.5', health_status: 'SIN_DATOS' },
];

const umbralCobertura = () => new MetricaCalidad({ tipo: TipoMetrica.COBERTURA_PRUEBAS, meta: 80, umbralAdvertencia: 70, umbralCritico: 50 });
const umbralTasaExito = () => new MetricaCalidad({ tipo: TipoMetrica.TASA_EXITO_PRUEBAS, meta: 95, umbralAdvertencia: 90, umbralCritico: 80 });
const umbralDensidad = () => new MetricaCalidad({ tipo: TipoMetrica.DENSIDAD_DEFECTOS, meta: 1, umbralAdvertencia: 3, umbralCritico: 5 });

const dtoValido = {
  corteId: CORTE_ID,
  pruebasPlaneadas: 100,
  pruebasEjecutadas: 90,
  pruebasExitosas: 86,
  pruebasFallidas: 4,
};

async function llamar(method, path, body) {
  const router = require('../src/controllers/PruebasController');
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

function contextoValido({ medicionPrevia = null } = {}) {
  mock.method(proyectoRepo, 'obtenerProyectoPeriodoActivo', async () => proyecto);
  mock.method(proyectoRepo, 'listarCortes', async () => cortes);
  mock.method(configRepo, 'obtenerUmbralVigente', async (_pid, tipo) => {
    if (tipo === TipoMetrica.COBERTURA_PRUEBAS) return umbralCobertura();
    if (tipo === TipoMetrica.TASA_EXITO_PRUEBAS) return umbralTasaExito();
    if (tipo === TipoMetrica.DENSIDAD_DEFECTOS) return umbralDensidad();
    return null;
  });
  mock.method(configRepo, 'obtenerMedicion', async () => medicionPrevia);
  mock.method(pruebasRepo, 'listarPorProyecto', async () => []);
}

function transaccionValida() {
  const orden = [];
  mock.method(transacciones, 'ejecutarEnTransaccion', (op) => op('tx'));
  mock.method(transacciones, 'ejecutar', (op) => op('tx'));
  mock.method(tableroRepo, 'obtenerPorProyecto', async (pid) => new TableroControl({ proyectoId: pid }));
  const guardarRonda = mock.method(pruebasRepo, 'guardar', async (r, tx) => {
    orden.push(['ronda', tx]);
    return Object.assign(r, { id: 'ronda-1' });
  });
  const guardarMedicion = mock.method(configRepo, 'guardarMedicion', async (cid, m, tx) => {
    orden.push(['medicion', m.tipoMetrica, cid, tx]);
  });
  const guardarTablero = mock.method(tableroRepo, 'guardar', async (t, tx) => {
    orden.push(['tablero', t.healthStatus, tx]);
  });
  return { orden, guardarRonda, guardarMedicion, guardarTablero };
}

// ---------------------------------------------------------------- Entidades de dominio

test('CU-05 FN-04 RondaPruebas: calcula cobertura y tasa de éxito con redondeo a 2 decimales', () => {
  const r1 = new RondaPruebas({
    corteId: CORTE_ID,
    pruebasPlaneadas: 100,
    pruebasEjecutadas: 80,
    pruebasExitosas: 76,
    pruebasFallidas: 4,
  });
  assert.strictEqual(r1.calcularCobertura(), 80);
  assert.strictEqual(r1.calcularTasaExito(), 95);

  const r2 = new RondaPruebas({
    corteId: CORTE_ID,
    pruebasPlaneadas: 3,
    pruebasEjecutadas: 2,
    pruebasExitosas: 1,
    pruebasFallidas: 1,
  });
  assert.strictEqual(r2.calcularCobertura(), 66.67);
  assert.strictEqual(r2.calcularTasaExito(), 50);

  const r3 = new RondaPruebas({
    corteId: CORTE_ID,
    pruebasPlaneadas: 8,
    pruebasEjecutadas: 8,
    pruebasExitosas: 7,
    pruebasFallidas: 1,
  });
  assert.strictEqual(r3.calcularCobertura(), 100);
  assert.strictEqual(r3.calcularTasaExito(), 87.5);
});

test('CU-05 TableroControl: actualizarIndicadores y reflejarAlerta registran mediciones y mensaje de alerta', () => {
  const t = new TableroControl({ proyectoId: PROYECTO_ID });
  const m = [new MedicionMetrica({ tipoMetrica: TipoMetrica.COBERTURA_PRUEBAS, valorCalculado: 45 })];
  t.actualizarIndicadores(m);
  assert.strictEqual(t.indicadores.length, 1);

  t.reflejarAlerta({ mensajeAlerta: 'Cobertura crítica' });
  assert.strictEqual(t.ultimaAlerta, 'Cobertura crítica');
  assert.strictEqual(t.alertas.length, 1);
});

// ---------------------------------------------------------------- ValidadorRondaPruebas

test('CU-05 FA-02.01: validarCompletitud reporta todos los campos obligatorios faltantes', () => {
  const res = validador.validar({});
  assert.strictEqual(res.esValido, false);
  assert.strictEqual(res.incompleto, true);
  assert.deepStrictEqual(
    res.camposFaltantes.sort(),
    ['corteId', 'pruebasEjecutadas', 'pruebasExitosas', 'pruebasFallidas', 'pruebasPlaneadas'],
  );
});

test('CU-05 FA-03.01: validarConsistenciaNumerica rechaza negativos, decimales y planeadas o ejecutadas en cero', () => {
  const rNeg = validador.validar({ ...dtoValido, pruebasFallidas: -1 });
  assert.strictEqual(rNeg.esValido, false);
  assert.strictEqual(rNeg.incompleto, false);
  assert.ok(rNeg.errores.some((e) => e.campo === 'pruebasFallidas'));

  const rDec = validador.validar({ ...dtoValido, pruebasPlaneadas: 10.5 });
  assert.strictEqual(rDec.esValido, false);
  assert.ok(rDec.errores.some((e) => e.campo === 'pruebasPlaneadas'));

  const rCero = validador.validar({
    corteId: CORTE_ID,
    pruebasPlaneadas: 0,
    pruebasEjecutadas: 0,
    pruebasExitosas: 0,
    pruebasFallidas: 0,
  });
  assert.strictEqual(rCero.esValido, false);
  assert.ok(rCero.errores.some((e) => e.campo === 'pruebasPlaneadas'));
  assert.ok(rCero.errores.some((e) => e.campo === 'pruebasEjecutadas'));
});

test('CU-05 FA-03.01: validarConsistenciaNumerica rechaza ejecutadas > planeadas y suma != ejecutadas', () => {
  const rMayor = validador.validar({
    corteId: CORTE_ID,
    pruebasPlaneadas: 50,
    pruebasEjecutadas: 60,
    pruebasExitosas: 60,
    pruebasFallidas: 0,
  });
  assert.strictEqual(rMayor.esValido, false);
  assert.ok(rMayor.errores.some((e) => e.campo === 'pruebasEjecutadas' && /superar/.test(e.mensaje)));

  const rSuma = validador.validar({
    corteId: CORTE_ID,
    pruebasPlaneadas: 100,
    pruebasEjecutadas: 80,
    pruebasExitosas: 70,
    pruebasFallidas: 5,
  });
  assert.strictEqual(rSuma.esValido, false);
  assert.ok(rSuma.errores.some((e) => e.campo === 'pruebasFallidas' && /suma/.test(e.mensaje)));

  const rOk = validador.validar(dtoValido);
  assert.strictEqual(rOk.esValido, true);
});

test('CU-05 FA-06.01: validarNotaExplicativaObligatoria exige nota no vacía solo cuando el estado es ROJO', () => {
  assert.strictEqual(validador.validarNotaExplicativaObligatoria(dtoValido, NivelSemaforo.VERDE_OPTIMO), null);
  assert.strictEqual(validador.validarNotaExplicativaObligatoria(dtoValido, NivelSemaforo.AMARILLO_ADVERTENCIA), null);

  const errVacia = validador.validarNotaExplicativaObligatoria({ ...dtoValido, notaExplicativa: '   ' }, NivelSemaforo.ROJO_CRITICO);
  assert.ok(errVacia);
  assert.strictEqual(errVacia.campo, 'notaExplicativa');

  const okConNota = validador.validarNotaExplicativaObligatoria(
    { ...dtoValido, notaExplicativa: 'Bloqueo por ambiente de integración caído' },
    NivelSemaforo.ROJO_CRITICO,
  );
  assert.strictEqual(okConNota, null);
});

// ---------------------------------------------------------------- ServicioCalculoPruebas y ServicioEvaluarMetricas

test('CU-05 FN-04/FN-05: generarMediciones, evaluarMedicion y calcularNivelGlobal evalúan cobertura y tasa de éxito', () => {
  const ronda = new RondaPruebas({
    corteId: CORTE_ID,
    pruebasPlaneadas: 100,
    pruebasEjecutadas: 60, // Cobertura 60% -> AMARILLO (70..50)
    pruebasExitosas: 45,   // Tasa éxito 75% -> ROJO (< 80)
    pruebasFallidas: 15,
  });
  const mediciones = calculoPruebas.generarMediciones(ronda, CORTE_ID);
  assert.strictEqual(mediciones.length, 2);
  assert.strictEqual(mediciones[0].valorCalculado, 60);
  assert.strictEqual(mediciones[1].valorCalculado, 75);

  const alertaCob = evaluarMetricas.evaluarMedicion(mediciones[0], umbralCobertura());
  const alertaTasa = evaluarMetricas.evaluarMedicion(mediciones[1], umbralTasaExito());

  assert.strictEqual(mediciones[0].estadoSemaforo, NivelSemaforo.AMARILLO_ADVERTENCIA);
  assert.strictEqual(alertaCob.nivelSemaforo, NivelSemaforo.AMARILLO_ADVERTENCIA);
  assert.strictEqual(mediciones[1].estadoSemaforo, NivelSemaforo.ROJO_CRITICO);
  assert.strictEqual(alertaTasa.nivelSemaforo, NivelSemaforo.ROJO_CRITICO);

  assert.strictEqual(
    evaluarMetricas.calcularNivelGlobal(mediciones[0].estadoSemaforo, mediciones[1].estadoSemaforo),
    NivelSemaforo.ROJO_CRITICO,
  );
  assert.strictEqual(
    evaluarMetricas.calcularNivelGlobal(NivelSemaforo.VERDE_OPTIMO, NivelSemaforo.SIN_DATOS, null),
    NivelSemaforo.VERDE_OPTIMO,
  );
});

// ---------------------------------------------------------------- ConfiguracionMetricasRepository (columnas por tipo)

test('CU-05 ConfiguracionMetricasRepository.guardarMedicion actualiza la columna correcta según TipoMetrica sin romper CU-03', async () => {
  const llamadas = [];
  const txFalso = { query: async (sql, params) => llamadas.push({ sql, params }) };

  await configRepo.guardarMedicion(
    CORTE_ID,
    { tipoMetrica: TipoMetrica.COBERTURA_PRUEBAS, valorCalculado: 85, estadoSemaforo: 'VERDE_OPTIMO' },
    txFalso,
  );
  assert.match(llamadas[0].sql, /test_coverage_pct/);

  await configRepo.guardarMedicion(
    CORTE_ID,
    { tipoMetrica: TipoMetrica.TASA_EXITO_PRUEBAS, valorCalculado: 92, estadoSemaforo: 'AMARILLO_ADVERTENCIA' },
    txFalso,
  );
  assert.match(llamadas[1].sql, /test_pass_rate_pct/);

  // Compatibilidad CU-03 (DENSIDAD_DEFECTOS)
  await configRepo.guardarMedicion(
    CORTE_ID,
    { tipoMetrica: TipoMetrica.DENSIDAD_DEFECTOS, valorCalculado: 0.5, estadoSemaforo: 'VERDE_OPTIMO' },
    txFalso,
  );
  assert.match(llamadas[2].sql, /defect_density/);
});

// ---------------------------------------------------------------- PruebasController y ServicioRegistroPruebas

test('CU-05 Controlador FN-01: GET /cortes devuelve proyecto, cortes disponibles y umbrales vigentes', async () => {
  contextoValido();
  const r = await llamar('GET', `/proyectos/${PROYECTO_ID}/cortes`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.proyecto.id, PROYECTO_ID);
  assert.strictEqual(r.body.cortesDisponibles.length, 1);
  assert.strictEqual(r.body.umbralesConfigurados, true);
});

test('CU-05 Controlador Precondiciones: sin proyecto activo responde 404 y sin umbrales responde 409', async () => {
  mock.method(proyectoRepo, 'obtenerProyectoPeriodoActivo', async () => null);
  const r404 = await llamar('POST', `/proyectos/${PROYECTO_ID}/pruebas`, dtoValido);
  assert.strictEqual(r404.status, 404);

  mock.method(proyectoRepo, 'obtenerProyectoPeriodoActivo', async () => proyecto);
  mock.method(configRepo, 'obtenerUmbralVigente', async () => null);
  const r409 = await llamar('POST', `/proyectos/${PROYECTO_ID}/pruebas`, dtoValido);
  assert.strictEqual(r409.status, 409);
  assert.match(r409.body.mensaje, /umbrales/);
});

test('CU-05 Controlador FA-02.01: datos incompletos responden 400 con camposFaltantes sin abrir transacción', async () => {
  contextoValido();
  const tx = mock.method(transacciones, 'ejecutarEnTransaccion', async () => {});
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/pruebas`, { corteId: CORTE_ID, pruebasPlaneadas: 100 });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.body.registroExitoso, false);
  assert.ok(r.body.camposFaltantes.includes('pruebasEjecutadas'));
  assert.strictEqual(tx.mock.callCount(), 0);
});

test('CU-05 Controlador FA-03.01 / D3: inconsistencia numérica o corte ajeno al proyecto responden 422 sin abrir transacción', async () => {
  contextoValido();
  const tx = mock.method(transacciones, 'ejecutarEnTransaccion', async () => {});

  const rInconsistente = await llamar('POST', `/proyectos/${PROYECTO_ID}/pruebas`, {
    ...dtoValido,
    pruebasExitosas: 80,
    pruebasFallidas: 5, // 80 + 5 != 90
  });
  assert.strictEqual(rInconsistente.status, 422);
  assert.strictEqual(rInconsistente.body.registroExitoso, false);
  assert.strictEqual(tx.mock.callCount(), 0);

  const rCorteAjeno = await llamar('POST', `/proyectos/${PROYECTO_ID}/pruebas`, {
    ...dtoValido,
    corteId: '00000000-0000-0000-0000-000000000099',
  });
  assert.strictEqual(rCorteAjeno.status, 422);
  assert.ok(rCorteAjeno.body.errores.some((e) => e.campo === 'corteId'));
  assert.strictEqual(tx.mock.callCount(), 0);
});

test('CU-05 Controlador FA-06.01: métrica en ROJO sin nota explicativa responde 200 con requiereNota=true y bloquea guardado', async () => {
  contextoValido();
  const tx = mock.method(transacciones, 'ejecutarEnTransaccion', async () => {});

  // Cobertura = 40% (< 50 crítico) -> ROJO
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/pruebas`, {
    corteId: CORTE_ID,
    pruebasPlaneadas: 100,
    pruebasEjecutadas: 40,
    pruebasExitosas: 38,
    pruebasFallidas: 2,
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.registroExitoso, false);
  assert.strictEqual(r.body.requiereNota, true);
  assert.strictEqual(r.body.coberturaPruebas, 40);
  assert.strictEqual(r.body.estadoCobertura, NivelSemaforo.ROJO_CRITICO);
  assert.strictEqual(r.body.nivelSemaforoGlobal, NivelSemaforo.ROJO_CRITICO);
  assert.strictEqual(tx.mock.callCount(), 0);
});

test('CU-05 Controlador FA-06.01 + FN-06: métrica en ROJO con nota explicativa guarda atómicamente y responde 201', async () => {
  contextoValido();
  const { orden, guardarRonda } = transaccionValida();

  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/pruebas`, {
    corteId: CORTE_ID,
    pruebasPlaneadas: 100,
    pruebasEjecutadas: 40,
    pruebasExitosas: 38,
    pruebasFallidas: 2,
    notaExplicativa: 'Se pospusieron 60 pruebas de sistema por falta de entorno de staging.',
  });

  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.registroExitoso, true);
  assert.strictEqual(r.body.requiereNota, false);
  assert.strictEqual(r.body.nivelSemaforoGlobal, NivelSemaforo.ROJO_CRITICO);
  assert.strictEqual(guardarRonda.mock.calls[0].arguments[0].notaExplicativa, 'Se pospusieron 60 pruebas de sistema por falta de entorno de staging.');
  assert.deepStrictEqual(orden, [
    ['ronda', 'tx'],
    ['medicion', TipoMetrica.COBERTURA_PRUEBAS, CORTE_ID, 'tx'],
    ['medicion', TipoMetrica.TASA_EXITO_PRUEBAS, CORTE_ID, 'tx'],
    ['tablero', NivelSemaforo.ROJO_CRITICO, 'tx'],
  ]);
});

test('CU-05 Controlador FN-06/FN-07: registro en VERDE guarda ronda, 2 mediciones y tablero y responde 201', async () => {
  contextoValido();
  const { orden } = transaccionValida();

  // Cobertura 90% (>=70 VERDE), Tasa 95.56% (>=90 VERDE)
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/pruebas`, dtoValido);
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.registroExitoso, true);
  assert.strictEqual(r.body.coberturaPruebas, 90);
  assert.strictEqual(r.body.tasaExitoPruebas, 95.56);
  assert.strictEqual(r.body.estadoCobertura, NivelSemaforo.VERDE_OPTIMO);
  assert.strictEqual(r.body.estadoTasaExito, NivelSemaforo.VERDE_OPTIMO);
  assert.strictEqual(r.body.nivelSemaforoGlobal, NivelSemaforo.VERDE_OPTIMO);
  assert.strictEqual(r.body.alertaEmitida, null);
  assert.strictEqual(orden.length, 4);
});

test('CU-05 Controlador D4-A: si la densidad de defectos del corte ya estaba en ROJO, el semáforo global del tablero conserva ROJO', async () => {
  // defect_density = 6 (> 5 crítico) -> ROJO_CRITICO, aunque las pruebas salgan en VERDE
  contextoValido({ medicionPrevia: { defect_density: '6.0', health_status: 'ROJO_CRITICO' } });
  const { guardarTablero } = transaccionValida();

  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/pruebas`, dtoValido);
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.estadoCobertura, NivelSemaforo.VERDE_OPTIMO);
  assert.strictEqual(r.body.estadoTasaExito, NivelSemaforo.VERDE_OPTIMO);
  assert.strictEqual(r.body.nivelSemaforoGlobal, NivelSemaforo.ROJO_CRITICO);
  assert.strictEqual(guardarTablero.mock.calls[0].arguments[0].healthStatus, NivelSemaforo.ROJO_CRITICO);
});

test('CU-05 Controlador FE-01: falla de persistencia hace rollback y responde 500 con mensaje de reintento', async () => {
  contextoValido();
  mock.method(tableroRepo, 'obtenerPorProyecto', async (pid) => new TableroControl({ proyectoId: pid }));
  mock.method(transacciones, 'ejecutarEnTransaccion', async () => {
    throw new transacciones.ErrorPersistencia('No se pudo guardar la información. Intente de nuevo.');
  });

  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/pruebas`, dtoValido);
  assert.strictEqual(r.status, 500);
  assert.match(r.body.mensaje, /Intente de nuevo/);
});

test('CU-05 Controlador: proyectoId inválido responde 400', async () => {
  const r = await llamar('GET', '/proyectos/no-es-uuid/cortes');
  assert.strictEqual(r.status, 400);
});

