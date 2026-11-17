const assert = require('assert');
const CalculadorIndiceSalud = require('../src/services/CalculadorIndiceSalud');
const { MedicionMetrica, UmbralMetrica, NivelSemaforo, TipoMetrica } = require('../src/domain/models');

console.log('🧪 Iniciando pruebas unitarias para CalculadorIndiceSalud...');

const calculador = new CalculadorIndiceSalud();

// 1. Probar verificación de mediciones completas
const medicionesIncompletas = [
  new MedicionMetrica({ id: '1', proyectoId: 'p1', tipoMetrica: TipoMetrica.DENSIDAD_DEFECTOS, valorCalculado: 0.8, nivelSemaforo: NivelSemaforo.VERDE_OPTIMO }),
  new MedicionMetrica({ id: '2', proyectoId: 'p1', tipoMetrica: TipoMetrica.COBERTURA_PRUEBAS, valorCalculado: 75, nivelSemaforo: NivelSemaforo.AMARILLO_ADVERTENCIA })
];

assert.strictEqual(calculador.verificarMedicionesCompletas(medicionesIncompletas), false, 'Debe detectar mediciones incompletas');
assert.strictEqual(calculador.calcularIndiceSaludDeterminista(medicionesIncompletas), null, 'Índice debe ser null si faltan mediciones (FA-04.01)');
assert.strictEqual(calculador.determinarEstadoSaludGlobal(medicionesIncompletas), NivelSemaforo.SIN_DATOS, 'Estado debe ser SIN_DATOS (FA-04.01)');

// 2. Probar cálculo determinista con las 4 mediciones
// 2 Verdes (100%), 1 Amarillo (50%), 1 Rojo (0%)
// Promedio ponderado: (100 * 0.25) + (100 * 0.25) + (50 * 0.25) + (0 * 0.25) = 25 + 25 + 12.5 + 0 = 62.5%
const medicionesCompletas = [
  new MedicionMetrica({ id: '1', proyectoId: 'p1', tipoMetrica: TipoMetrica.DENSIDAD_DEFECTOS, valorCalculado: 0.8, nivelSemaforo: NivelSemaforo.VERDE_OPTIMO }),
  new MedicionMetrica({ id: '2', proyectoId: 'p1', tipoMetrica: TipoMetrica.COBERTURA_PRUEBAS, valorCalculado: 72, nivelSemaforo: NivelSemaforo.AMARILLO_ADVERTENCIA }),
  new MedicionMetrica({ id: '3', proyectoId: 'p1', tipoMetrica: TipoMetrica.TASA_EXITO_PRUEBAS, valorCalculado: 98, nivelSemaforo: NivelSemaforo.VERDE_OPTIMO }),
  new MedicionMetrica({ id: '4', proyectoId: 'p1', tipoMetrica: TipoMetrica.CUMPLIMIENTO_SQA, valorCalculado: 60, nivelSemaforo: NivelSemaforo.ROJO_CRITICO })
];

assert.strictEqual(calculador.verificarMedicionesCompletas(medicionesCompletas), true, 'Debe verificar que están completas');
const indice = calculador.calcularIndiceSaludDeterminista(medicionesCompletas);
assert.strictEqual(indice, 62.5, `El índice determinista debe ser 62.5%, obtenido: ${indice}`);

// 3. Probar ordenamiento del desglose de impacto (Rojo primero, luego Amarillo, luego Verde)
const umbrales = [
  new UmbralMetrica({ id: 'u1', tipoMetrica: TipoMetrica.DENSIDAD_DEFECTOS, valorMeta: 1.0, umbralAdvertencia: 2.0, umbralCritico: 3.5, sentido: 'MENOR_ES_MEJOR', unidad: 'def/KLOC' }),
  new UmbralMetrica({ id: 'u2', tipoMetrica: TipoMetrica.COBERTURA_PRUEBAS, valorMeta: 80, umbralAdvertencia: 70, umbralCritico: 60, sentido: 'MAYOR_ES_MEJOR', unidad: '%' }),
  new UmbralMetrica({ id: 'u3', tipoMetrica: TipoMetrica.TASA_EXITO_PRUEBAS, valorMeta: 95, umbralAdvertencia: 90, umbralCritico: 80, sentido: 'MAYOR_ES_MEJOR', unidad: '%' }),
  new UmbralMetrica({ id: 'u4', tipoMetrica: TipoMetrica.CUMPLIMIENTO_SQA, valorMeta: 90, umbralAdvertencia: 80, umbralCritico: 70, sentido: 'MAYOR_ES_MEJOR', unidad: '%' })
];

const desglose = calculador.generarDesgloseImpacto(medicionesCompletas, umbrales);
assert.strictEqual(desglose.length, 4);
assert.strictEqual(desglose[0].tipoMetrica, TipoMetrica.CUMPLIMIENTO_SQA, 'El rojo crítico debe ser ordenado en primer lugar de prioridad');
assert.strictEqual(desglose[0].impacto, 'NEGATIVO');
assert.strictEqual(desglose[1].tipoMetrica, TipoMetrica.COBERTURA_PRUEBAS, 'El amarillo advertencia debe ser segundo');
assert.strictEqual(desglose[1].impacto, 'NEUTRO');
assert.strictEqual(desglose[2].impacto, 'POSITIVO');
assert.strictEqual(desglose[3].impacto, 'POSITIVO');

console.log('✅ Todas las pruebas de lógica matemática y ordenamiento pasaron satisfactoriamente.');
