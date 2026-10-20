const test = require('node:test');
const assert = require('node:assert');
const v = require('../src/services/ValidadorUmbrales');
const { generarVistaPrevia } = require('../src/services/ConfiguracionMetricasService');
const {
  TipoMetrica,
  SentidoMetrica,
  EstadoSemaforo,
  DEFINICION_METRICAS,
  MetricaCalidad,
} = require('../src/services/entidades/metricas');

const validas = [
  { tipo: 'DENSIDAD_DEFECTOS', meta: 1.0, umbralAdvertencia: 3.0, umbralCritico: 5.0 },
  { tipo: 'COBERTURA_PRUEBAS', meta: 80, umbralAdvertencia: 70, umbralCritico: 50 },
  { tipo: 'TASA_EXITO_PRUEBAS', meta: 95, umbralAdvertencia: 90, umbralCritico: 80 },
  { tipo: 'CUMPLIMIENTO_SQA', meta: 90, umbralAdvertencia: 75, umbralCritico: 60 },
];

const errores = (m) => [
  ...v.validarCoherencia(new MetricaCalidad(m)),
  ...v.validarRango(new MetricaCalidad(m)),
];

// =========================================================================
// 1. Configuración Completa y Válida (FN-02 y FN-03)
// =========================================================================
test('CU-02 FN-02/03: Configuración completa y coherente no produce ningún error', () => {
  const errCompletitud = v.validarCompletitud(validas);
  assert.deepStrictEqual(errCompletitud, []);

  const errCoherencia = validas.flatMap(errores);
  assert.deepStrictEqual(errCoherencia, []);
});

// =========================================================================
// 2. Validación de Completitud (FA-02.02)
// =========================================================================
test('CU-02 FA-02.02: ValidadorUmbrales detecta omisión de métricas obligatorias', () => {
  // Lista vacía o nula
  assert.strictEqual(v.validarCompletitud(undefined).length, 1);
  assert.strictEqual(v.validarCompletitud(null).length, 1);
  assert.strictEqual(v.validarCompletitud('no-es-array').length, 1);

  // Faltan 2 métricas (solo se envían 2 de las 4)
  const soloDos = validas.slice(0, 2);
  const errDos = v.validarCompletitud(soloDos);
  assert.strictEqual(errDos.length, 2);
  assert.ok(errDos.some((e) => e.tipoMetrica === 'TASA_EXITO_PRUEBAS'));
  assert.ok(errDos.some((e) => e.tipoMetrica === 'CUMPLIMIENTO_SQA'));
});

test('CU-02 FA-02.02: ValidadorUmbrales detecta campos vacíos o no numéricos', () => {
  const conCamposInvalidos = [
    { ...validas[0], meta: null },
    { ...validas[1], umbralAdvertencia: 'setenta' },
    { ...validas[2], umbralCritico: NaN },
    { ...validas[3], meta: undefined },
  ];
  const err = v.validarCompletitud(conCamposInvalidos);
  assert.ok(err.some((e) => e.tipoMetrica === 'DENSIDAD_DEFECTOS' && e.campo === 'meta'));
  assert.ok(err.some((e) => e.tipoMetrica === 'COBERTURA_PRUEBAS' && e.campo === 'umbralAdvertencia'));
  assert.ok(err.some((e) => e.tipoMetrica === 'TASA_EXITO_PRUEBAS' && e.campo === 'umbralCritico'));
  assert.ok(err.some((e) => e.tipoMetrica === 'CUMPLIMIENTO_SQA' && e.campo === 'meta'));
});

test('CU-02 FA-02.02: ValidadorUmbrales detecta métricas repetidas o desconocidas', () => {
  const duplicadas = [
    ...validas,
    { tipo: 'DENSIDAD_DEFECTOS', meta: 2, umbralAdvertencia: 4, umbralCritico: 6 },
  ];
  const errDup = v.validarCompletitud(duplicadas);
  assert.ok(errDup.some((e) => e.tipoMetrica === 'DENSIDAD_DEFECTOS' && e.mensaje.includes('repetida')));

  const desconocida = [
    ...validas.slice(1),
    { tipo: 'METRICA_INVENTADA', meta: 10, umbralAdvertencia: 5, umbralCritico: 1 },
  ];
  const errDesc = v.validarCompletitud(desconocida);
  assert.ok(errDesc.some((e) => e.campo === 'tipo' && e.mensaje.includes('desconocido')));
});

// =========================================================================
// 3. Validación de Coherencia de Umbrales y Rangos (FA-02.01)
// =========================================================================
test('CU-02 FA-02.01: Umbrales cruzados en métricas MAYOR_ES_MEJOR (Cobertura, Éxito, Cumplimiento)', () => {
  // meta > advertencia > crítico es lo esperado.
  // Caso 1: Crítico mayor o igual a Advertencia
  const criticoCruzado = { ...validas[1], umbralAdvertencia: 70, umbralCritico: 75 };
  const errCrit = errores(criticoCruzado);
  assert.ok(errCrit.some((e) => e.campo === 'umbralCritico'));

  // Caso 2: Advertencia mayor o igual a Meta
  const advMayorQueMeta = { ...validas[2], meta: 90, umbralAdvertencia: 95, umbralCritico: 80 };
  const errAdv = errores(advMayorQueMeta);
  assert.ok(errAdv.some((e) => e.campo === 'umbralAdvertencia'));

  // Caso 3: Valores idénticos (meta == advertencia)
  const identicos = { ...validas[3], meta: 80, umbralAdvertencia: 80, umbralCritico: 60 };
  const errIdenticos = errores(identicos);
  assert.ok(errIdenticos.some((e) => e.campo === 'umbralAdvertencia'));
});

test('CU-02 FA-02.01: Umbrales cruzados en métrica MENOR_ES_MEJOR (Densidad de Defectos)', () => {
  // meta < advertencia < crítico es lo esperado.
  // Caso 1: Advertencia menor que Meta
  const advMenorQueMeta = { ...validas[0], meta: 3, umbralAdvertencia: 2, umbralCritico: 5 };
  const errAdv = errores(advMenorQueMeta);
  assert.ok(errAdv.some((e) => e.campo === 'umbralAdvertencia'));

  // Caso 2: Crítico menor que Advertencia
  const critMenorQueAdv = { ...validas[0], meta: 1, umbralAdvertencia: 5, umbralCritico: 4 };
  const errCrit = errores(critMenorQueAdv);
  assert.ok(errCrit.some((e) => e.campo === 'umbralCritico'));
});

test('CU-02 FA-02.01: Valores fuera de los límites de rango válidos', () => {
  // Porcentajes > 100% o < 0%
  const cobExcedida = { ...validas[1], meta: 105, umbralAdvertencia: 70, umbralCritico: 50 };
  const errCob105 = errores(cobExcedida);
  assert.ok(errCob105.some((e) => e.campo === 'meta' && e.mensaje.includes('entre 0 y 100')));

  const cobNegativa = { ...validas[1], meta: 80, umbralAdvertencia: 70, umbralCritico: -5 };
  const errCobNeg = errores(cobNegativa);
  assert.ok(errCobNeg.some((e) => e.campo === 'umbralCritico' && e.mensaje.includes('entre 0 y 100')));

  // Densidad de defectos < 0
  const densNegativa = { ...validas[0], meta: -0.5, umbralAdvertencia: 2, umbralCritico: 4 };
  const errDensNeg = errores(densNegativa);
  assert.ok(errDensNeg.some((e) => e.campo === 'meta' && e.mensaje.includes('mayor o igual a 0')));
});

// =========================================================================
// 4. Evaluación del Semáforo y Vista Previa (FN-04)
// =========================================================================
test('CU-02 FN-04: MetricaCalidad.evaluarEstado clasifica correctamente según los umbrales configurados', () => {
  // Cobertura de pruebas (MAYOR_ES_MEJOR: adv=70, crit=50)
  const metricaCob = new MetricaCalidad(validas[1]);
  assert.strictEqual(metricaCob.evaluarEstado(85), EstadoSemaforo.VERDE);
  assert.strictEqual(metricaCob.evaluarEstado(70), EstadoSemaforo.VERDE); // Inclusivo en advertencia
  assert.strictEqual(metricaCob.evaluarEstado(69.9), EstadoSemaforo.AMARILLO);
  assert.strictEqual(metricaCob.evaluarEstado(50), EstadoSemaforo.AMARILLO); // Inclusivo en crítico
  assert.strictEqual(metricaCob.evaluarEstado(49.9), EstadoSemaforo.ROJO);
  assert.strictEqual(metricaCob.evaluarEstado(0), EstadoSemaforo.ROJO);

  // Densidad de defectos (MENOR_ES_MEJOR: adv=3, crit=5)
  const metricaDens = new MetricaCalidad(validas[0]);
  assert.strictEqual(metricaDens.evaluarEstado(0.5), EstadoSemaforo.VERDE);
  assert.strictEqual(metricaDens.evaluarEstado(3.0), EstadoSemaforo.VERDE); // Inclusivo en advertencia
  assert.strictEqual(metricaDens.evaluarEstado(3.1), EstadoSemaforo.AMARILLO);
  assert.strictEqual(metricaDens.evaluarEstado(5.0), EstadoSemaforo.AMARILLO); // Inclusivo en crítico
  assert.strictEqual(metricaDens.evaluarEstado(5.1), EstadoSemaforo.ROJO);
  assert.strictEqual(metricaDens.evaluarEstado(12.0), EstadoSemaforo.ROJO);
});

test('CU-02 FN-04: generarVistaPrevia genera exactamente los 12 rangos para el semáforo visual', () => {
  const metricas = validas.map((m) => new MetricaCalidad(m));
  const { rangos } = generarVistaPrevia(metricas);

  assert.strictEqual(rangos.length, 12);

  // Cada una de las 4 métricas debe tener exactamente 3 estados (VERDE, AMARILLO, ROJO)
  for (const tipo of Object.keys(TipoMetrica)) {
    const rangosMetrica = rangos.filter((r) => r.tipoMetrica === tipo);
    assert.strictEqual(rangosMetrica.length, 3);
    const estados = new Set(rangosMetrica.map((r) => r.estado));
    assert.ok(estados.has(EstadoSemaforo.VERDE));
    assert.ok(estados.has(EstadoSemaforo.AMARILLO));
    assert.ok(estados.has(EstadoSemaforo.ROJO));
  }
});
