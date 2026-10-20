const test = require('node:test');
const assert = require('node:assert');
const v = require('../src/services/ValidadorUmbrales');
const { generarVistaPrevia } = require('../src/services/ConfiguracionMetricasService');
const { MetricaCalidad } = require('../src/domain/metricas');

const validas = [
  { tipo: 'DENSIDAD_DEFECTOS', meta: 1, umbralAdvertencia: 3, umbralCritico: 5 },
  { tipo: 'COBERTURA_PRUEBAS', meta: 80, umbralAdvertencia: 70, umbralCritico: 50 },
  { tipo: 'TASA_EXITO_PRUEBAS', meta: 95, umbralAdvertencia: 90, umbralCritico: 80 },
  { tipo: 'CUMPLIMIENTO_SQA', meta: 90, umbralAdvertencia: 75, umbralCritico: 60 },
];
const errores = (m) => [...v.validarCoherencia(new MetricaCalidad(m)), ...v.validarRango(new MetricaCalidad(m))];

test('configuración completa y coherente no tiene errores', () => {
  assert.deepStrictEqual(v.validarCompletitud(validas), []);
  assert.deepStrictEqual(validas.flatMap(errores), []);
});

test('FA-02.02: métrica faltante o campo vacío', () => {
  const e = v.validarCompletitud([{ ...validas[0], meta: null }, ...validas.slice(1, 3)]);
  assert.ok(e.some((x) => x.tipoMetrica === 'DENSIDAD_DEFECTOS' && x.campo === 'meta'));
  assert.ok(e.some((x) => x.tipoMetrica === 'CUMPLIMIENTO_SQA' && x.campo === 'tipo'));
  assert.strictEqual(v.validarCompletitud(undefined).length, 1);
});

test('FA-02.01: umbrales cruzados o fuera de rango', () => {
  assert.strictEqual(errores({ ...validas[1], umbralCritico: 75 }).length, 1); // crítico > advertencia
  assert.strictEqual(errores({ ...validas[0], umbralAdvertencia: 6 }).length, 1); // menor-es-mejor cruzado
  assert.ok(errores({ ...validas[1], meta: 120 }).some((x) => x.campo === 'meta'));
  assert.ok(errores({ ...validas[0], meta: -1 }).some((x) => x.campo === 'meta'));
});

test('vista previa: 12 rangos coherentes con evaluarEstado', () => {
  const metricas = validas.map((m) => new MetricaCalidad(m));
  const { rangos } = generarVistaPrevia(metricas);
  assert.strictEqual(rangos.length, 12);
  const cob = metricas[1];
  assert.deepStrictEqual([75, 70, 60, 50, 40].map((x) => cob.evaluarEstado(x)), ['VERDE', 'VERDE', 'AMARILLO', 'AMARILLO', 'ROJO']);
  const dens = metricas[0];
  assert.deepStrictEqual([2, 3, 4, 5, 6].map((x) => dens.evaluarEstado(x)), ['VERDE', 'VERDE', 'AMARILLO', 'AMARILLO', 'ROJO']);
});
