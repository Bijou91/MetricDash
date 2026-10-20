// CU-03 Registrar y clasificar un defecto: entidades, servicios y controlador con dobles (sin PostgreSQL).
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const express = require('express');

const transacciones = require('../src/data/TransaccionManager');
const proyectoRepo = require('../src/data/ProyectoRepository');
const defectoRepo = require('../src/data/DefectoRepository');
const configRepo = require('../src/data/ConfiguracionMetricasRepository');
const gestion = require('../src/services/ServicioGestionDefectos');
const calculo = require('../src/services/ServicioCalculoMetricas');
const evaluar = require('../src/services/ServicioEvaluarMetricas');
const { Defecto, MedicionMetrica, EstadoDefecto } = require('../src/services/entidades/defecto');
const { MetricaCalidad } = require('../src/services/entidades/metricas');
const { NivelSemaforo } = require('../src/services/entidades/proyecto');

afterEach(() => mock.restoreAll());

const PROYECTO_ID = '00000000-0000-0000-0000-000000000001';
const proyecto = { id: PROYECTO_ID, estimated_kloc: '4.5' };
const miembros = [
  { id: 'm-qa', member_name: 'Héctor Varela', role: 'QA' },
  { id: 'm-tec', member_name: 'Carlos Aguirre', role: 'TECNICO' },
];
const umbralDensidad = () => new MetricaCalidad({ tipo: 'DENSIDAD_DEFECTOS', meta: 1, umbralAdvertencia: 3, umbralCritico: 5 });
const dtoValido = {
  reportadoPorId: 'm-qa',
  asignadoAId: 'm-tec',
  severidad: 'ALTA',
  prioridad: 'ALTA',
  faseDeteccion: 'INTEGRACION_Y_PRUEBAS',
  faseOrigen: 'CONSTRUCCION_SOFTWARE',
  descripcionDetallada: 'El botón guardar de métricas no responde cuando la red es lenta',
};
const previo = (descripcion, extra = {}) => new Defecto({
  id: 'd-1', folio: 'DEF-001', severidad: 'MEDIA', faseDeteccion: 'INTEGRACION_Y_PRUEBAS',
  faseOrigen: 'CONSTRUCCION_SOFTWARE', descripcionDetallada: descripcion, ...extra,
});

async function llamar(method, path, body) {
  const router = require('../src/controllers/DefectoController');
  const server = express().use(express.json()).use('/api', router).listen(0);
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

// Escenario base del controlador: proyecto activo, umbrales de CU-02 y miembros del equipo.
function contextoValido() {
  mock.method(proyectoRepo, 'obtenerProyectoPeriodoActivo', async () => proyecto);
  mock.method(configRepo, 'obtenerUmbralVigente', async () => umbralDensidad());
  mock.method(proyectoRepo, 'obtenerMiembros', async () => miembros);
}

function transaccionValida({ totalDefectos = 2 } = {}) {
  mock.method(transacciones, 'ejecutar', (op) => op('tx'));
  mock.method(proyectoRepo, 'obtenerCorteActual', async () => ({ id: 'corte-1', project_id: PROYECTO_ID }));
  mock.method(defectoRepo, 'guardar', async (d) => Object.assign(d, { id: 'd-nuevo', folio: 'DEF-002' }));
  mock.method(defectoRepo, 'contarDefectosProyecto', async () => totalDefectos);
  mock.method(proyectoRepo, 'actualizar', async () => {});
  return mock.method(configRepo, 'guardarMedicion', async () => {});
}

// ---------------------------------------------------------------- Modelo de dominio

test('CU-03 Defecto: esCritico solo con severidad CRITICA y asignarResponsable lo deja ASIGNADO', () => {
  const d = previo('x', { severidad: 'CRITICA' });
  assert.strictEqual(d.esCritico(), true);
  assert.strictEqual(previo('x').esCritico(), false);
  d.asignarResponsable({ id: 'm-tec' });
  assert.strictEqual(d.asignadoAId, 'm-tec');
  assert.strictEqual(d.estado, EstadoDefecto.ASIGNADO);
});

test('CU-03 FN-05: MedicionMetrica.calcularDensidad divide defectos entre KLOC con 2 decimales', () => {
  const m = new MedicionMetrica({ tipoMetrica: 'DENSIDAD_DEFECTOS' });
  assert.strictEqual(m.calcularDensidad(2, 4.5), 0.44);
  assert.strictEqual(m.calcularDensidad(0, 4.5), 0);
  assert.strictEqual(m.calcularDensidad(9, 3), 3);
});

// ---------------------------------------------------------------- ServicioGestionDefectos

test('CU-03 FA-03.03: validarCamposObligatorios reporta todos los campos vacíos', () => {
  const faltantes = gestion.validarCamposObligatorios({}, miembros);
  assert.deepStrictEqual(faltantes.sort(), ['asignadoAId', 'descripcionDetallada', 'faseDeteccion', 'faseOrigen', 'prioridad', 'reportadoPorId', 'severidad']);
});

test('CU-03 FA-03.03: validarCamposObligatorios rechaza valores fuera de catálogo y miembros ajenos al proyecto', () => {
  const faltantes = gestion.validarCamposObligatorios(
    { ...dtoValido, severidad: 'URGENTE', faseOrigen: 'PRODUCCION', asignadoAId: 'otro', descripcionDetallada: '   ' }, miembros);
  assert.deepStrictEqual(faltantes.sort(), ['asignadoAId', 'descripcionDetallada', 'faseOrigen', 'severidad']);
  assert.deepStrictEqual(gestion.validarCamposObligatorios(dtoValido, miembros), []);
});

test('CU-03 FN-03: similitud compara palabras sin importar mayúsculas ni acentos', () => {
  assert.strictEqual(gestion.similitud('El botón GUARDAR falla', 'el boton guardar falla'), 100);
  assert.strictEqual(gestion.similitud('Error al exportar PDF', 'Login rechaza contraseña'), 0);
  assert.strictEqual(gestion.similitud('', 'algo'), 0);
});

test('CU-03 FA-03.01: buscarPosiblesDuplicados regresa solo coincidencias de la misma fase de origen sobre el umbral', async () => {
  const buscar = mock.method(defectoRepo, 'buscarSimilaresPorProyecto', async () => [
    previo('El botón guardar de métricas no responde cuando la red es lenta'),
    previo('La gráfica de cobertura no carga', { id: 'd-2', folio: 'DEF-002' }),
  ]);
  const r = await gestion.buscarPosiblesDuplicados(PROYECTO_ID, dtoValido);
  assert.deepStrictEqual(buscar.mock.calls[0].arguments, [PROYECTO_ID, 'CONSTRUCCION_SOFTWARE']);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].folio, 'DEF-001');
  assert.ok(r[0].porcentajeSimilitud >= gestion.UMBRAL_SIMILITUD_DUPLICADO);
});

test('CU-03 FN-04: crearYAsignarDefecto lo guarda ASIGNADO al responsable dentro de la transacción', async () => {
  const guardar = mock.method(defectoRepo, 'guardar', async (d) => d);
  const corte = { id: 'corte-1', project_id: PROYECTO_ID };
  const d = await gestion.crearYAsignarDefecto({ ...dtoValido, confirmarIncidenciaDistinta: true }, miembros[1], corte, 'tx');
  assert.strictEqual(d.estado, EstadoDefecto.ASIGNADO);
  assert.strictEqual(d.asignadoAId, 'm-tec');
  assert.strictEqual(d.confirmadoNoDuplicado, true);
  assert.deepStrictEqual(guardar.mock.calls[0].arguments.slice(1), [corte, 'tx']);
});

// ---------------------------------------------------------------- ServicioCalculoMetricas y ServicioEvaluarMetricas

test('CU-03 FN-05: recalcularDensidadDefectos usa el total del proyecto y el KLOC de CU-01', async () => {
  const contar = mock.method(defectoRepo, 'contarDefectosProyecto', async () => 9);
  const actualizar = mock.method(proyectoRepo, 'actualizar', async () => {});
  const m = await calculo.recalcularDensidadDefectos(proyecto, 'tx');
  assert.strictEqual(m.valorCalculado, 2);
  assert.strictEqual(m.totalDefectos, 9);
  assert.deepStrictEqual(contar.mock.calls[0].arguments, [PROYECTO_ID, 'tx']);
  assert.deepStrictEqual(actualizar.mock.calls[0].arguments, [PROYECTO_ID, 'tx']);
});

test('CU-03 FN-06: determinarEstadoSemaforo traduce el semáforo de CU-02 al nivel del tablero', () => {
  const u = umbralDensidad();
  assert.strictEqual(evaluar.determinarEstadoSemaforo(2, u), NivelSemaforo.VERDE_OPTIMO);
  assert.strictEqual(evaluar.determinarEstadoSemaforo(4, u), NivelSemaforo.AMARILLO_ADVERTENCIA);
  assert.strictEqual(evaluar.determinarEstadoSemaforo(5.1, u), NivelSemaforo.ROJO_CRITICO);
});

test('CU-03 FN-06: sin defecto crítico y densidad en verde no se emite alerta', () => {
  const m = Object.assign(new MedicionMetrica({}), { valorCalculado: 1 });
  assert.strictEqual(evaluar.evaluarSeveridadYDensidad(previo('x'), m, umbralDensidad()), null);
  assert.strictEqual(m.estadoSemaforo, NivelSemaforo.VERDE_OPTIMO);
});

test('CU-03 FA-03.02: defecto CRITICA o densidad sobre el umbral crítico emiten alerta', () => {
  const critico = evaluar.evaluarSeveridadYDensidad(previo('x', { severidad: 'CRITICA' }),
    Object.assign(new MedicionMetrica({}), { valorCalculado: 1 }), umbralDensidad());
  assert.strictEqual(critico.porDefectoCritico, true);
  assert.strictEqual(critico.porUmbralExcedido, false);

  const rojo = evaluar.evaluarSeveridadYDensidad(previo('x'),
    Object.assign(new MedicionMetrica({}), { valorCalculado: 6 }), umbralDensidad());
  assert.strictEqual(rojo.porUmbralExcedido, true);
  assert.strictEqual(rojo.nivelSemaforo, NivelSemaforo.ROJO_CRITICO);
  assert.match(rojo.mensajeAlerta, /umbral crítico/);

  const amarillo = evaluar.evaluarSeveridadYDensidad(previo('x'),
    Object.assign(new MedicionMetrica({}), { valorCalculado: 4 }), umbralDensidad());
  assert.strictEqual(amarillo.nivelSemaforo, NivelSemaforo.AMARILLO_ADVERTENCIA);
  assert.match(amarillo.mensajeAlerta, /advertencia/);
});

// ---------------------------------------------------------------- ControladorRegistroDefecto

test('CU-03 Controlador: sin proyecto activo en el periodo responde 404', async () => {
  mock.method(proyectoRepo, 'obtenerProyectoPeriodoActivo', async () => null);
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/defectos`, dtoValido);
  assert.strictEqual(r.status, 404);
});

test('CU-03 Controlador (precondición 3): sin umbrales de CU-02 responde 409', async () => {
  mock.method(proyectoRepo, 'obtenerProyectoPeriodoActivo', async () => proyecto);
  mock.method(configRepo, 'obtenerUmbralVigente', async () => null);
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/defectos`, dtoValido);
  assert.strictEqual(r.status, 409);
  assert.match(r.body.mensaje, /CU-02/);
});

test('CU-03 Controlador FA-03.03: campos faltantes responden 400 sin guardar', async () => {
  contextoValido();
  const ejecutar = mock.method(transacciones, 'ejecutar', async () => {});
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/defectos`, { ...dtoValido, prioridad: '' });
  assert.strictEqual(r.status, 400);
  assert.deepStrictEqual(r.body.camposFaltantes, ['prioridad']);
  assert.strictEqual(ejecutar.mock.callCount(), 0);
});

test('CU-03 Controlador FA-03.01: posible duplicado pide confirmación sin abrir transacción', async () => {
  contextoValido();
  mock.method(defectoRepo, 'buscarSimilaresPorProyecto', async () => [previo(dtoValido.descripcionDetallada)]);
  const ejecutar = mock.method(transacciones, 'ejecutar', async () => {});
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/defectos`, dtoValido);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.requiereConfirmacionDuplicado, true);
  assert.strictEqual(r.body.coincidenciasDetectadas[0].folio, 'DEF-001');
  assert.strictEqual(ejecutar.mock.callCount(), 0);
});

test('CU-03 Controlador FN-04 a FN-07: registro exitoso responde 201 con densidad y semáforo actualizados', async () => {
  contextoValido();
  mock.method(defectoRepo, 'buscarSimilaresPorProyecto', async () => []);
  const guardarMedicion = transaccionValida({ totalDefectos: 2 });
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/defectos`, dtoValido);
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.registroExitoso, true);
  assert.strictEqual(r.body.defectoRegistrado.folio, 'DEF-002');
  assert.strictEqual(r.body.defectoRegistrado.asignadoNombre, 'Carlos Aguirre');
  assert.strictEqual(r.body.densidadDefectosActualizada, 0.44);
  assert.strictEqual(r.body.nivelSemaforo, NivelSemaforo.VERDE_OPTIMO);
  assert.strictEqual(r.body.alertaEmitida, null);
  const [corteId, medicion, tx] = guardarMedicion.mock.calls[0].arguments;
  assert.strictEqual(corteId, 'corte-1');
  assert.strictEqual(medicion.valorCalculado, 0.44);
  assert.strictEqual(tx, 'tx');
});

test('CU-03 Controlador FA-03.01/FA-03.02: incidencia distinta confirmada se registra y emite alerta por umbral crítico', async () => {
  contextoValido();
  const buscar = mock.method(defectoRepo, 'buscarSimilaresPorProyecto', async () => [previo(dtoValido.descripcionDetallada)]);
  transaccionValida({ totalDefectos: 27 });
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/defectos`, { ...dtoValido, confirmarIncidenciaDistinta: true });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(buscar.mock.callCount(), 0);
  assert.strictEqual(r.body.defectoRegistrado.confirmadoNoDuplicado, true);
  assert.strictEqual(r.body.nivelSemaforo, NivelSemaforo.ROJO_CRITICO);
  assert.strictEqual(r.body.alertaEmitida.porUmbralExcedido, true);
});

test('CU-03 Controlador FE-01: falla de BD durante el registro responde 500 y pide reintentar', async () => {
  contextoValido();
  mock.method(defectoRepo, 'buscarSimilaresPorProyecto', async () => []);
  mock.method(transacciones, 'ejecutar', async () => {
    throw new transacciones.ErrorPersistencia('No se pudo guardar la información. Intente de nuevo.');
  });
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/defectos`, dtoValido);
  assert.strictEqual(r.status, 500);
  assert.match(r.body.mensaje, /Intente de nuevo/);
});

test('CU-03 Controlador FA-03.01: descartar el registro responde 200 sin guardar nada', async () => {
  const ejecutar = mock.method(transacciones, 'ejecutar', async () => {});
  const r = await llamar('POST', `/proyectos/${PROYECTO_ID}/defectos/descartar`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.descartado, true);
  assert.strictEqual(ejecutar.mock.callCount(), 0);
});

test('CU-03 Controlador FN-01: el tablero trae miembros, defectos, umbral y última medición', async () => {
  contextoValido();
  mock.method(defectoRepo, 'listarPorProyecto', async () => [previo('x')]);
  mock.method(proyectoRepo, 'obtenerCorteActual', async () => ({ id: 'corte-1' }));
  mock.method(configRepo, 'obtenerMedicion', async () => ({ defect_density: '0.44', health_status: 'VERDE_OPTIMO' }));
  const r = await llamar('GET', `/proyectos/${PROYECTO_ID}/defectos`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.miembros.length, 2);
  assert.strictEqual(r.body.defectos.length, 1);
  assert.strictEqual(r.body.umbralesConfigurados, true);
  assert.strictEqual(r.body.densidadDefectos, 0.44);
  assert.strictEqual(r.body.nivelSemaforo, 'VERDE_OPTIMO');
});

test('CU-03 Controlador: proyectoId que no es UUID responde 400', async () => {
  const r = await llamar('GET', '/proyectos/abc/defectos');
  assert.strictEqual(r.status, 400);
});
