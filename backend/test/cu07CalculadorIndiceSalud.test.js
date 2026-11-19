const { test } = require('node:test');
const assert = require('node:assert');
const CalculadorIndiceSalud = require('../src/services/CalculadorIndiceSalud');
const { MedicionMetrica, UmbralMetrica } = require('../src/domain/models');

const calc = new CalculadorIndiceSalud();
const umbral = (tipo, meta, adv, crit, sentido, unidad) =>
  new UmbralMetrica({ id: tipo, tipoMetrica: tipo, valorMeta: meta, umbralAdvertencia: adv, umbralCritico: crit, sentido, unidad });

const UMBRALES = [
  umbral('DENSIDAD_DEFECTOS', 1, 2, 3.5, 'MENOR_ES_MEJOR', 'defectos/KLOC'),
  umbral('COBERTURA_PRUEBAS', 80, 70, 60, 'MAYOR_ES_MEJOR', '%'),
  umbral('TASA_EXITO_PRUEBAS', 95, 90, 80, 'MAYOR_ES_MEJOR', '%'),
  umbral('CUMPLIMIENTO_SQA', 90, 80, 70, 'MAYOR_ES_MEJOR', '%')
];

// Mide con el semáforo que le corresponde al valor (como hace ServicioTableroSalud.reevaluarSemaforo)
const medir = (tipo, valor) => new MedicionMetrica({
  tipoMetrica: tipo,
  valorCalculado: valor,
  nivelSemaforo: calc.evaluarNivelSemaforo(valor, UMBRALES.find(u => u.tipoMetrica === tipo))
});

test('el semáforo se evalúa por métrica contra su umbral (TI-018)', () => {
  assert.strictEqual(calc.evaluarNivelSemaforo(0.22, UMBRALES[0]), 'VERDE_OPTIMO');
  assert.strictEqual(calc.evaluarNivelSemaforo(2, UMBRALES[0]), 'VERDE_OPTIMO'); // inclusivo del lado "mejor"
  assert.strictEqual(calc.evaluarNivelSemaforo(3, UMBRALES[0]), 'AMARILLO_ADVERTENCIA');
  assert.strictEqual(calc.evaluarNivelSemaforo(4, UMBRALES[0]), 'ROJO_CRITICO');
  assert.strictEqual(calc.evaluarNivelSemaforo(12.5, UMBRALES[3]), 'ROJO_CRITICO');
  assert.strictEqual(calc.evaluarNivelSemaforo(null, UMBRALES[3]), null);
  assert.strictEqual(calc.evaluarNivelSemaforo(50, undefined), null);
});

test('índice 25% con densidad óptima y las otras 3 críticas (TI-018)', () => {
  const m = [medir('DENSIDAD_DEFECTOS', 0.22), medir('COBERTURA_PRUEBAS', 50), medir('TASA_EXITO_PRUEBAS', 70), medir('CUMPLIMIENTO_SQA', 12.5)];
  assert.strictEqual(calc.determinarEstadoIndice(m), 'CALCULADO');
  assert.strictEqual(calc.calcularIndiceSaludDeterminista(m), 25);
  const d = calc.generarDesgloseImpacto(m, UMBRALES);
  assert.deepStrictEqual(d.map(x => x.impacto), ['NEGATIVO', 'NEGATIVO', 'NEGATIVO', 'POSITIVO']);
});

test('con 1 a 3 métricas el índice es "Insuficiente" y el desglose lista las 4 (TI-016)', () => {
  const m = [medir('DENSIDAD_DEFECTOS', 0.22), medir('COBERTURA_PRUEBAS', 50), medir('TASA_EXITO_PRUEBAS', 70)];
  assert.strictEqual(calc.determinarEstadoIndice(m), 'INSUFICIENTE');
  assert.strictEqual(calc.calcularIndiceSaludDeterminista(m), null);
  const d = calc.generarDesgloseImpacto(m, UMBRALES);
  assert.strictEqual(d.length, 4);
  const falta = d.find(x => x.tipoMetrica === 'CUMPLIMIENTO_SQA');
  assert.strictEqual(falta.impacto, 'SIN_DATOS');
  assert.strictEqual(falta.valorMedido, null);
  assert.strictEqual(d[d.length - 1], falta); // las métricas sin datos van al final
});

test('sin ninguna medición el índice es "Sin datos" y el desglose sigue mostrando las 4 (TI-016)', () => {
  assert.strictEqual(calc.determinarEstadoIndice([]), 'SIN_DATOS');
  const d = calc.generarDesgloseImpacto([], UMBRALES);
  assert.strictEqual(d.length, 4);
  assert(d.every(x => x.impacto === 'SIN_DATOS'));
});
