// Pruebas de servicios, acceso a datos y controladores con dobles: no requieren PostgreSQL.
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const express = require('express');

const pool = require('../src/data/pool');
const transacciones = require('../src/data/TransaccionManager');
const proyectoRepo = require('../src/data/ProyectoRepository');
const configRepo = require('../src/data/ConfiguracionMetricasRepository');
const metricasService = require('../src/services/ConfiguracionMetricasService');
const registroService = require('../src/services/RegistroProyectoService');
const { ProyectoExistenteException } = require('../src/services/entidades/proyecto');

afterEach(() => mock.restoreAll());

const PROYECTO_ID = '00000000-0000-0000-0000-000000000001';
const metricasValidas = [
  { tipo: 'DENSIDAD_DEFECTOS', meta: 1, umbralAdvertencia: 3, umbralCritico: 5 },
  { tipo: 'COBERTURA_PRUEBAS', meta: 80, umbralAdvertencia: 70, umbralCritico: 50 },
  { tipo: 'TASA_EXITO_PRUEBAS', meta: 95, umbralAdvertencia: 90, umbralCritico: 80 },
  { tipo: 'CUMPLIMIENTO_SQA', meta: 90, umbralAdvertencia: 75, umbralCritico: 60 },
];
const registroValido = {
  name: 'MetricDash SQA',
  estimatedKloc: 4.5,
  projectType: 'DESARROLLO_NUEVO',
  members: [
    { role: 'QA', memberName: 'Héctor Varela' },
    { role: 'TECNICO', memberName: 'Carlos Aguirre' },
    { role: 'GESTION_PROYECTO', memberName: 'Karol Espino' },
  ],
};
const periodoActivo = { id: 'p1', code: 'AGO-DIC-2026', name: 'Ciclo Escolar Agosto-Diciembre 2026' };

// Ejecuta la operación con una transacción falsa, como lo haría TransaccionManager.
const txFalsa = () => mock.method(transacciones, 'ejecutar', (op) => op('tx'));

async function llamar(router, method, path, body) {
  const app = express().use(express.json()).use('/api', router);
  const server = app.listen(0);
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

// ---------------------------------------------------------------- Capa de Acceso a Datos

test('TransaccionManager: confirma con COMMIT cuando la operación termina bien', async () => {
  const queries = [];
  const cliente = { query: async (q) => queries.push(q), release: mock.fn() };
  mock.method(pool, 'connect', async () => cliente);

  const r = await transacciones.ejecutar(async () => 'ok');

  assert.strictEqual(r, 'ok');
  assert.deepStrictEqual(queries, ['BEGIN', 'COMMIT']);
  assert.strictEqual(cliente.release.mock.callCount(), 1);
});

test('TransaccionManager FE-01: hace ROLLBACK y lanza ErrorPersistencia sin exponer el error de BD', async () => {
  const queries = [];
  const cliente = { query: async (q) => queries.push(q), release: mock.fn() };
  mock.method(pool, 'connect', async () => cliente);
  mock.method(console, 'error', () => {});

  await assert.rejects(
    transacciones.ejecutar(async () => { throw new Error('connection terminated'); }),
    (err) => err instanceof transacciones.ErrorPersistencia && !err.message.includes('connection'),
  );
  assert.deepStrictEqual(queries, ['BEGIN', 'ROLLBACK']);
  assert.strictEqual(cliente.release.mock.callCount(), 1);
});

// ---------------------------------------------------------------- CU-02 servicio

test('CU-02 ConfiguracionMetricasService.validar: proyecto inexistente o inactivo responde 404', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => null);
  await assert.rejects(metricasService.validar(PROYECTO_ID, { metricas: metricasValidas }), { status: 404 });
});

test('CU-02 FN-06: guardarVersionada desactiva la vigente e inserta la versión siguiente en una transacción', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => ({ id: PROYECTO_ID }));
  txFalsa();
  const orden = [];
  mock.method(configRepo, 'obtenerUltimaVersion', async () => 2);
  mock.method(configRepo, 'desactivarVigente', async () => orden.push('desactivar'));
  mock.method(configRepo, 'insertarVersion', async () => orden.push('insertar'));

  const config = await metricasService.guardarVersionada(PROYECTO_ID, { metricas: metricasValidas }, null);

  assert.strictEqual(config.version, 3);
  assert.strictEqual(config.vigente, true);
  assert.strictEqual(config.metricas.length, 4);
  assert.deepStrictEqual(orden, ['desactivar', 'insertar']);
});

test('CU-02 FA-02.01: guardarVersionada con umbrales cruzados no abre transacción', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => ({ id: PROYECTO_ID }));
  const ejecutar = mock.method(transacciones, 'ejecutar', async () => {});
  const cruzadas = [{ ...metricasValidas[0], umbralCritico: 2 }, ...metricasValidas.slice(1)];

  await assert.rejects(
    metricasService.guardarVersionada(PROYECTO_ID, { metricas: cruzadas }, null),
    (err) => err.resultado.valido === false && err.resultado.incompleto === false,
  );
  assert.strictEqual(ejecutar.mock.callCount(), 0);
});

test('CU-02 CASO LÍMITE: ConfiguracionMetricasService.validar procesa DTOs anómalos (null, vacío, no-array)', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => ({ id: PROYECTO_ID }));

  // DTO null
  const resNull = await metricasService.validar(PROYECTO_ID, null);
  assert.strictEqual(resNull.valido, false);
  assert.strictEqual(resNull.incompleto, true);

  // DTO vacío {}
  const resVacio = await metricasService.validar(PROYECTO_ID, {});
  assert.strictEqual(resVacio.valido, false);
  assert.strictEqual(resVacio.incompleto, true);

  // Lista de métricas vacía []
  const resArrayVacio = await metricasService.validar(PROYECTO_ID, { metricas: [] });
  assert.strictEqual(resArrayVacio.valido, false);
  assert.strictEqual(resArrayVacio.incompleto, true);
  assert.strictEqual(resArrayVacio.errores.length, 4);

  // Metricas no array
  const resNoArray = await metricasService.validar(PROYECTO_ID, { metricas: 'texto-invalido' });
  assert.strictEqual(resNoArray.valido, false);
  assert.strictEqual(resNoArray.incompleto, true);
});

test('CU-02 CASO LÍMITE: ConfiguracionMetricasService.guardarVersionada calcula versión inicial v1 cuando ultimaVersion es 0 o null', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => ({ id: PROYECTO_ID }));
  txFalsa();
  mock.method(configRepo, 'desactivarVigente', async () => {});
  mock.method(configRepo, 'insertarVersion', async () => {});

  // Caso 1: ultimaVersion es 0
  mock.method(configRepo, 'obtenerUltimaVersion', async () => 0);
  const cfg1 = await metricasService.guardarVersionada(PROYECTO_ID, { metricas: metricasValidas }, 'user-1');
  assert.strictEqual(cfg1.version, 1);

  // Caso 2: ultimaVersion es null
  mock.method(configRepo, 'obtenerUltimaVersion', async () => null);
  const cfg2 = await metricasService.guardarVersionada(PROYECTO_ID, { metricas: metricasValidas }, 'user-1');
  assert.strictEqual(cfg2.version, 1);
});

test('CU-02 CASO LÍMITE: ConfiguracionMetricasService.guardarVersionada aborta fail-fast ante micro-violaciones de frontera sin abrir transacción', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => ({ id: PROYECTO_ID }));
  const ejecutar = mock.method(transacciones, 'ejecutar', async () => {});

  // Micro-desviación de frontera: 100.001%
  const fueraFrontera = [
    { ...metricasValidas[0] },
    { ...metricasValidas[1], meta: 100.001 },
    ...metricasValidas.slice(2),
  ];

  await assert.rejects(
    metricasService.guardarVersionada(PROYECTO_ID, { metricas: fueraFrontera }, null),
    (err) => err.resultado.valido === false && err.resultado.errores.some((e) => e.campo === 'meta'),
  );
  assert.strictEqual(ejecutar.mock.callCount(), 0);
});

// ---------------------------------------------------------------- CU-02 controlador

const metricasRouter = require('../src/controllers/MetricasController');

test('CU-02 MetricasController: validación correcta responde 200 con la vista previa del semáforo', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => ({ id: PROYECTO_ID }));
  const r = await llamar(metricasRouter, 'POST', `/proyectos/${PROYECTO_ID}/metricas/validar`, { metricas: metricasValidas });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.valido, true);
  assert.strictEqual(r.body.vistaPrevia.rangos.length, 12);
});

test('CU-02 MetricasController FA-02.02: métricas incompletas responden 400', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => ({ id: PROYECTO_ID }));
  const r = await llamar(metricasRouter, 'POST', `/proyectos/${PROYECTO_ID}/metricas/validar`, { metricas: metricasValidas.slice(0, 3) });
  assert.strictEqual(r.status, 400);
  assert.ok(r.body.errores.some((e) => e.tipoMetrica === 'CUMPLIMIENTO_SQA'));
});

test('CU-02 MetricasController FA-02.01: umbrales incoherentes responden 422', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => ({ id: PROYECTO_ID }));
  const cruzadas = [{ ...metricasValidas[1], umbralCritico: 75 }, metricasValidas[0], ...metricasValidas.slice(2)];
  const r = await llamar(metricasRouter, 'POST', `/proyectos/${PROYECTO_ID}/metricas/validar`, { metricas: cruzadas });
  assert.strictEqual(r.status, 422);
  assert.ok(r.body.errores.some((e) => e.tipoMetrica === 'COBERTURA_PRUEBAS' && e.campo === 'umbralCritico'));
});

test('CU-02 MetricasController FN-07: guardado exitoso responde 201 con la versión creada', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => ({ id: PROYECTO_ID }));
  txFalsa();
  mock.method(configRepo, 'obtenerUltimaVersion', async () => 0);
  mock.method(configRepo, 'desactivarVigente', async () => {});
  mock.method(configRepo, 'insertarVersion', async (c) => { c.id = 'cfg-1'; });

  const r = await llamar(metricasRouter, 'POST', `/proyectos/${PROYECTO_ID}/metricas`, { metricas: metricasValidas });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.version, 1);
  assert.strictEqual(r.body.metricas.length, 4);
});

test('CU-02 MetricasController FE-01: falla de BD al guardar responde 500 con mensaje de reintento', async () => {
  mock.method(proyectoRepo, 'obtenerActivo', async () => ({ id: PROYECTO_ID }));
  mock.method(transacciones, 'ejecutar', async () => { throw new transacciones.ErrorPersistencia('No se pudo guardar la información. Intente de nuevo.'); });

  const r = await llamar(metricasRouter, 'POST', `/proyectos/${PROYECTO_ID}/metricas`, { metricas: metricasValidas });
  assert.strictEqual(r.status, 500);
  assert.match(r.body.mensaje, /Intente de nuevo/);
});

test('CU-02 MetricasController FN-01: sin configuración previa responde 200 con null', async () => {
  mock.method(configRepo, 'obtenerVigente', async () => null);
  const r = await llamar(metricasRouter, 'GET', `/proyectos/${PROYECTO_ID}/metricas/vigente`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body, null);
});

test('CU-02 MetricasController: proyectoId que no es UUID responde 400', async () => {
  const r = await llamar(metricasRouter, 'GET', '/proyectos/abc/metricas/vigente');
  assert.strictEqual(r.status, 400);
});

// ---------------------------------------------------------------- CU-01 servicio y controlador

test('CU-01 FN-04: registrarProyecto guarda proyecto, roles, plan, línea base y tablero en una transacción', async () => {
  mock.method(proyectoRepo, 'obtenerPeriodoActivo', async () => periodoActivo);
  mock.method(proyectoRepo, 'existeProyectoEnPeriodo', async () => false);
  txFalsa();
  const guardar = mock.method(proyectoRepo, 'guardarProyectoCompleto', async (datos, tx) => ({
    proyecto: { id: 'proj-1', name: datos.proyecto.name, estimated_kloc: '4.5' },
    miembros: datos.roles,
    actividades: datos.actividades,
    lineaBase: datos.lineaBase,
    corte: {},
  }));

  const r = await registroService.registrarProyecto(registroValido);

  assert.strictEqual(r.registroExitoso, true);
  assert.strictEqual(r.proyectoId, 'proj-1');
  const [datos, tx] = guardar.mock.calls[0].arguments;
  assert.strictEqual(tx, 'tx');
  assert.strictEqual(datos.proyecto.periodId, 'p1');
  assert.strictEqual(datos.roles.length, 3);
  assert.ok(datos.actividades.length >= 8);
});

test('CU-01 FA-02.01: registrarProyecto bloquea un segundo proyecto en el mismo periodo', async () => {
  mock.method(proyectoRepo, 'obtenerPeriodoActivo', async () => periodoActivo);
  mock.method(proyectoRepo, 'existeProyectoEnPeriodo', async () => true);
  const ejecutar = mock.method(transacciones, 'ejecutar', async () => {});

  await assert.rejects(registroService.registrarProyecto(registroValido), ProyectoExistenteException);
  assert.strictEqual(ejecutar.mock.callCount(), 0);
});

test('CU-01: registrarProyecto sin periodo académico activo responde 400', async () => {
  mock.method(proyectoRepo, 'obtenerPeriodoActivo', async () => null);
  await assert.rejects(registroService.registrarProyecto(registroValido), { status: 400 });
});

test('CU-01: registrarProyecto con periodId inválido o no activo responde 400', async () => {
  mock.method(proyectoRepo, 'obtenerPeriodoActivo', async () => periodoActivo);
  await assert.rejects(
    registroService.registrarProyecto({ ...registroValido, periodId: 'periodo-invalido' }),
    (err) => err.status === 400 && err.message.includes('no corresponde al periodo activo'),
  );
});

const proyectoRouter = require('../src/controllers/ProyectoController');

test('CU-01 ProyectoController FA-02.02: roles incompletos responden 400 con los faltantes', async () => {
  const r = await llamar(proyectoRouter, 'POST', '/proyectos', { ...registroValido, members: registroValido.members.slice(0, 2) });
  assert.strictEqual(r.status, 400);
  assert.ok(r.body.errores.some((e) => e.campo === 'rol_GESTION_PROYECTO'));
});

test('CU-01 ProyectoController FA-02.01: proyecto duplicado en el periodo responde 409', async () => {
  mock.method(proyectoRepo, 'obtenerPeriodoActivo', async () => periodoActivo);
  mock.method(proyectoRepo, 'existeProyectoEnPeriodo', async () => true);
  const r = await llamar(proyectoRouter, 'POST', '/proyectos', registroValido);
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.body.limiteExcedido, true);
});

test('CU-01 ProyectoController FE-01: falla de BD al registrar responde 500 y no registra', async () => {
  mock.method(proyectoRepo, 'obtenerPeriodoActivo', async () => periodoActivo);
  mock.method(proyectoRepo, 'existeProyectoEnPeriodo', async () => false);
  mock.method(transacciones, 'ejecutar', async () => { throw new transacciones.ErrorPersistencia('No se pudo guardar la información. Intente de nuevo.'); });
  const r = await llamar(proyectoRouter, 'POST', '/proyectos', registroValido);
  assert.strictEqual(r.status, 500);
});
