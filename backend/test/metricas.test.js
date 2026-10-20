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

// =========================================================================
// 5. Casos Límite y de Borde (Edge Cases)
// =========================================================================
test('CU-02 CASO LÍMITE: ValidadorUmbrales en cotas exactas 0%, 100% y 0 def/KLOC', () => {
  // Cotas extremas válidas: 0% como umbral crítico en porcentaje, 100% como meta
  const limitesPorcentaje = {
    tipo: 'COBERTURA_PRUEBAS',
    meta: 100.0,
    umbralAdvertencia: 50.0,
    umbralCritico: 0.0,
  };
  assert.deepStrictEqual(v.validarRango(limitesPorcentaje), []);
  assert.deepStrictEqual(v.validarCoherencia(limitesPorcentaje), []);

  // Cota extrema válida: 0.0 defectos/KLOC como meta ideal
  const limitesDensidad = {
    tipo: 'DENSIDAD_DEFECTOS',
    meta: 0.0,
    umbralAdvertencia: 2.0,
    umbralCritico: 4.0,
  };
  assert.deepStrictEqual(v.validarRango(limitesDensidad), []);
  assert.deepStrictEqual(v.validarCoherencia(limitesDensidad), []);

  // Densidad alta (no restringida por 100%)
  const densidadAlta = {
    tipo: 'DENSIDAD_DEFECTOS',
    meta: 5.0,
    umbralAdvertencia: 25.0,
    umbralCritico: 80.0,
  };
  assert.deepStrictEqual(v.validarRango(densidadAlta), []);
  assert.deepStrictEqual(v.validarCoherencia(densidadAlta), []);
});

test('CU-02 CASO LÍMITE: ValidadorUmbrales rechaza micro-desviaciones fuera de frontera (-0.001 y 100.001)', () => {
  // Micro-desviación inferior en porcentaje
  const microBajoCero = { tipo: 'COBERTURA_PRUEBAS', meta: 80, umbralAdvertencia: 70, umbralCritico: -0.001 };
  const errBajoCero = v.validarRango(microBajoCero);
  assert.strictEqual(errBajoCero.length, 1);
  assert.strictEqual(errBajoCero[0].campo, 'umbralCritico');
  assert.ok(errBajoCero[0].mensaje.includes('entre 0 y 100'));

  // Micro-desviación superior en porcentaje
  const microSobreCien = { tipo: 'TASA_EXITO_PRUEBAS', meta: 100.001, umbralAdvertencia: 90, umbralCritico: 80 };
  const errSobreCien = v.validarRango(microSobreCien);
  assert.strictEqual(errSobreCien.length, 1);
  assert.strictEqual(errSobreCien[0].campo, 'meta');
  assert.ok(errSobreCien[0].mensaje.includes('entre 0 y 100'));

  // Micro-desviación inferior en densidad de defectos
  const microDensidadNeg = { tipo: 'DENSIDAD_DEFECTOS', meta: -0.001, umbralAdvertencia: 2.0, umbralCritico: 4.0 };
  const errDensidadNeg = v.validarRango(microDensidadNeg);
  assert.strictEqual(errDensidadNeg.length, 1);
  assert.strictEqual(errDensidadNeg[0].campo, 'meta');
  assert.ok(errDensidadNeg[0].mensaje.includes('mayor o igual a 0'));
});

test('CU-02 CASO LÍMITE: ValidadorUmbrales coherencia en igualdad de frontera y micro-separación', () => {
  // Igualdad en frontera meta === advertencia
  const metaIgualAdv = { tipo: 'COBERTURA_PRUEBAS', meta: 75.0, umbralAdvertencia: 75.0, umbralCritico: 60.0 };
  const errMetaAdv = v.validarCoherencia(metaIgualAdv);
  assert.ok(errMetaAdv.some((e) => e.campo === 'umbralAdvertencia'));

  // Igualdad en frontera advertencia === crítico
  const advIgualCrit = { tipo: 'CUMPLIMIENTO_SQA', meta: 90.0, umbralAdvertencia: 70.0, umbralCritico: 70.0 };
  const errAdvCrit = v.validarCoherencia(advIgualCrit);
  assert.ok(errAdvCrit.some((e) => e.campo === 'umbralCritico'));

  // Igualdad total meta === advertencia === crítico
  const todosIguales = { tipo: 'COBERTURA_PRUEBAS', meta: 70.0, umbralAdvertencia: 70.0, umbralCritico: 70.0 };
  const errTodos = v.validarCoherencia(todosIguales);
  assert.strictEqual(errTodos.length, 2);

  // Micro-separación válida (MAYOR_ES_MEJOR con diferencia mínima 0.001)
  const microSeparacionMayor = {
    tipo: 'COBERTURA_PRUEBAS',
    meta: 70.002,
    umbralAdvertencia: 70.001,
    umbralCritico: 70.000,
  };
  assert.deepStrictEqual(v.validarCoherencia(microSeparacionMayor), []);

  // Micro-separación válida (MENOR_ES_MEJOR con diferencia mínima 0.001)
  const microSeparacionMenor = {
    tipo: 'DENSIDAD_DEFECTOS',
    meta: 1.000,
    umbralAdvertencia: 1.001,
    umbralCritico: 1.002,
  };
  assert.deepStrictEqual(v.validarCoherencia(microSeparacionMenor), []);
});

test('CU-02 CASO LÍMITE: ValidadorUmbrales maneja el valor 0 como numérico válido y rechaza no-finitos', () => {
  // El valor 0 es falsy en JS, pero debe ser aceptado como número válido
  const conCeros = [
    { tipo: 'DENSIDAD_DEFECTOS', meta: 0, umbralAdvertencia: 2, umbralCritico: 4 },
    { tipo: 'COBERTURA_PRUEBAS', meta: 80, umbralAdvertencia: 50, umbralCritico: 0 },
    { tipo: 'TASA_EXITO_PRUEBAS', meta: 90, umbralAdvertencia: 80, umbralCritico: 70 },
    { tipo: 'CUMPLIMIENTO_SQA', meta: 85, umbralAdvertencia: 75, umbralCritico: 60 },
  ];
  assert.deepStrictEqual(v.validarCompletitud(conCeros), []);

  // Valores no finitos: Infinity, -Infinity
  const conInfinito = [
    { tipo: 'DENSIDAD_DEFECTOS', meta: 1, umbralAdvertencia: 3, umbralCritico: Infinity },
    ...validas.slice(1),
  ];
  const errInf = v.validarCompletitud(conInfinito);
  assert.ok(errInf.some((e) => e.campo === 'umbralCritico'));

  const conMenosInf = [
    { tipo: 'COBERTURA_PRUEBAS', meta: -Infinity, umbralAdvertencia: 70, umbralCritico: 50 },
    ...validas.slice(1),
  ];
  const errMenosInf = v.validarCompletitud(conMenosInf);
  assert.ok(errMenosInf.some((e) => e.campo === 'meta'));
});

test('CU-02 CASO LÍMITE: MetricaCalidad.evaluarEstado transiciones de frontera exacta (micro-épsilon y límites absolutos)', () => {
  // MAYOR_ES_MEJOR: adv=70.0, crit=50.0
  const metricaCob = new MetricaCalidad(validas[1]);

  // Frontera exacta de advertencia (70.0)
  assert.strictEqual(metricaCob.evaluarEstado(70.0), EstadoSemaforo.VERDE);
  assert.strictEqual(metricaCob.evaluarEstado(70.001), EstadoSemaforo.VERDE);
  assert.strictEqual(metricaCob.evaluarEstado(69.999), EstadoSemaforo.AMARILLO);

  // Frontera exacta de crítico (50.0)
  assert.strictEqual(metricaCob.evaluarEstado(50.0), EstadoSemaforo.AMARILLO);
  assert.strictEqual(metricaCob.evaluarEstado(50.001), EstadoSemaforo.AMARILLO);
  assert.strictEqual(metricaCob.evaluarEstado(49.999), EstadoSemaforo.ROJO);

  // Límites absolutos
  assert.strictEqual(metricaCob.evaluarEstado(100.0), EstadoSemaforo.VERDE);
  assert.strictEqual(metricaCob.evaluarEstado(0.0), EstadoSemaforo.ROJO);

  // MENOR_ES_MEJOR: adv=3.0, crit=5.0
  const metricaDens = new MetricaCalidad(validas[0]);

  // Límite óptimo absoluto
  assert.strictEqual(metricaDens.evaluarEstado(0.0), EstadoSemaforo.VERDE);

  // Frontera exacta de advertencia (3.0)
  assert.strictEqual(metricaDens.evaluarEstado(3.0), EstadoSemaforo.VERDE);
  assert.strictEqual(metricaDens.evaluarEstado(2.999), EstadoSemaforo.VERDE);
  assert.strictEqual(metricaDens.evaluarEstado(3.001), EstadoSemaforo.AMARILLO);

  // Frontera exacta de crítico (5.0)
  assert.strictEqual(metricaDens.evaluarEstado(5.0), EstadoSemaforo.AMARILLO);
  assert.strictEqual(metricaDens.evaluarEstado(4.999), EstadoSemaforo.AMARILLO);
  assert.strictEqual(metricaDens.evaluarEstado(5.001), EstadoSemaforo.ROJO);

  // Valores extremos y no válidos
  assert.strictEqual(metricaDens.evaluarEstado(999.0), EstadoSemaforo.ROJO);
  assert.strictEqual(metricaDens.evaluarEstado(null), null);
  assert.strictEqual(metricaDens.evaluarEstado(undefined), null);
  assert.strictEqual(metricaDens.evaluarEstado('3.0'), null);
  assert.strictEqual(metricaDens.evaluarEstado(NaN), null);
});

