/**
 * PRUEBAS AUTOMATIZADAS CU-08: Cerrar el periodo y generar la bitácora de SQA
 * Ejecutable directamente con: node --test scripts/pruebaCU08.js
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');

const validador = require('../src/services/ValidadorCierrePeriodo');
const calculador = require('../src/services/CalculadorIndiceSalud');
const exportadorReporte = require('../src/services/ExportadorReportePDF');
const exportadorBitacora = require('../src/services/ExportadorBitacoraPDF');
const generadorBitacora = require('../src/services/GeneradorBitacoraSqa');
const { ConfiguracionMetricas } = require('../src/services/entidades/metricas');
const {
  Pendiente, ResolucionPendiente, Retrospectiva, MetricaCongelada, TipoPendiente,
} = require('../src/services/entidades/cierrePeriodo');

const RETRO = { queFuncionoBien: 'a', queDebeMejorar: 'b', leccionesAprendidas: 'c', acuerdos: 'd' };
const pend = (tipo, registroId, extra = {}) => new Pendiente({ tipo, registroId, descripcion: registroId, estadoActual: 'X', ...extra });

describe('CU-08: Pendiente.opcionesPermitidas() (FN-03 a-d)', () => {
  test('Defecto: arrastrar, cancelar o cerrar', () => {
    assert.deepStrictEqual(pend('DEFECTO', 'd').opcionesPermitidas(), ['ARRASTRAR', 'CANCELAR', 'CERRAR']);
  });
  test('Actividad de pruebas con evidencia puede cerrarse; sin evidencia no', () => {
    assert.ok(pend('ACTIVIDAD_SQA', 'a', { tipoActividad: 'PRUEBAS', evidencia: 'http://x' }).opcionesPermitidas().includes('CERRAR'));
    assert.ok(!pend('ACTIVIDAD_SQA', 'a', { tipoActividad: 'AUDITORIA' }).opcionesPermitidas().includes('CERRAR'));
  });
  test('Revisión por pares, acción correctiva y alerta: sin CERRAR', () => {
    assert.ok(!pend('ACTIVIDAD_SQA', 'a', { tipoActividad: 'REVISION_PARES', evidencia: 'x' }).opcionesPermitidas().includes('CERRAR'));
    assert.deepStrictEqual(pend('ACCION_CORRECTIVA', 'c').opcionesPermitidas(), ['ARRASTRAR', 'CANCELAR']);
    assert.deepStrictEqual(pend('ALERTA_DETERIORO', 'l').opcionesPermitidas(), ['ARRASTRAR', 'CANCELAR']);
  });
});

describe('CU-08: ResolucionPendiente.estadoDestino()', () => {
  const casos = [
    ['ACTIVIDAD_SQA', 'CERRAR', 'REALIZADA'], ['ACTIVIDAD_SQA', 'CANCELAR', 'CANCELADA'],
    ['DEFECTO', 'CERRAR', 'CERRADO'], ['DEFECTO', 'CANCELAR', 'DESCARTADO'],
    ['ACCION_CORRECTIVA', 'CANCELAR', 'cancelada'], ['ALERTA_DETERIORO', 'CANCELAR', 'DESCARTADA'],
    ['DEFECTO', 'ARRASTRAR', null],
  ];
  for (const [tipo, opcion, esperado] of casos) {
    test(`${tipo} + ${opcion} -> ${esperado}`, () => {
      assert.strictEqual(new ResolucionPendiente({ tipo, opcion }).estadoDestino(), esperado);
    });
  }
});

describe('CU-08: ValidadorCierrePeriodo (FN-05 / FA-05.01)', () => {
  const pendientes = [
    pend('DEFECTO', 'd1'),
    pend('ACTIVIDAD_SQA', 'a1', { tipoActividad: 'PRUEBAS' }),
  ];

  test('Datos completos: sin errores', () => {
    const dto = {
      resoluciones: [
        { registroId: 'd1', opcion: 'CANCELAR', justificacion: 'duplicado' },
        { registroId: 'a1', opcion: 'ARRASTRAR' },
      ],
      retrospectiva: RETRO,
    };
    assert.deepStrictEqual(validador.validar(dto, pendientes), []);
  });

  test('Pendiente sin resolver, cancelación sin justificación y retrospectiva incompleta', () => {
    const dto = { resoluciones: [{ registroId: 'd1', opcion: 'CANCELAR', justificacion: '   ' }], retrospectiva: { ...RETRO, acuerdos: '' } };
    const campos = validador.validar(dto, pendientes).map((e) => e.campo).sort();
    assert.deepStrictEqual(campos, ['resoluciones.a1', 'resoluciones.d1', 'retrospectiva.acuerdos']);
  });

  test('Cerrar actividad sin evidencia: error de evidencia', () => {
    const dto = { resoluciones: [{ registroId: 'd1', opcion: 'ARRASTRAR' }, { registroId: 'a1', opcion: 'CERRAR', justificacion: 'ok' }], retrospectiva: RETRO };
    const [error] = validador.validar(dto, pendientes);
    assert.strictEqual(error.campo, 'resoluciones.a1');
    assert.match(error.mensaje, /evidencia/);
  });

  test('Cerrar una revisión por pares: solo puede arrastrarse o cancelarse', () => {
    const revision = [pend('ACTIVIDAD_SQA', 'r1', { tipoActividad: 'REVISION_PARES', evidencia: 'acta' })];
    const dto = { resoluciones: [{ registroId: 'r1', opcion: 'CERRAR', justificacion: 'ok' }], retrospectiva: RETRO };
    const [error] = validador.validar(dto, revision);
    assert.strictEqual(error.campo, 'resoluciones.r1');
    assert.match(error.mensaje, /revisión por pares solo puede arrastrarse o cancelarse/);
  });

  test('Resolución de un registro que no es pendiente', () => {
    const dto = { resoluciones: [{ registroId: 'd1', opcion: 'ARRASTRAR' }, { registroId: 'a1', opcion: 'ARRASTRAR' }, { registroId: 'zz', opcion: 'ARRASTRAR' }], retrospectiva: RETRO };
    assert.deepStrictEqual(validador.validar(dto, pendientes).map((e) => e.campo), ['resoluciones.zz']);
  });
});

describe('CU-08: índice de salud con métricas congeladas (reglas del CU-07, FA-07.01)', () => {
  const congelada = (tipoMetrica, estadoSemaforo, valorFinal = 1) => new MetricaCongelada({ tipoMetrica, estadoSemaforo, valorFinal });
  const tipos = ['DENSIDAD_DEFECTOS', 'COBERTURA_PRUEBAS', 'TASA_EXITO_PRUEBAS', 'CUMPLIMIENTO_SQA'];

  test('4 métricas con datos: promedio VERDE=100, AMARILLO=50, ROJO=0', () => {
    const m = [congelada(tipos[0], 'VERDE_OPTIMO'), congelada(tipos[1], 'VERDE_OPTIMO'), congelada(tipos[2], 'AMARILLO_ADVERTENCIA'), congelada(tipos[3], 'ROJO_CRITICO')]
      .map((x) => x.comoMedicion());
    assert.strictEqual(calculador.calcularIndiceSaludDeterminista(m), 62.5);
    assert.strictEqual(calculador.determinarEstadoSaludGlobal(m), 'AMARILLO_ADVERTENCIA');
    assert.strictEqual(calculador.obtenerLeyendaIndice(m), null);
  });

  test('"Insuficiente" si solo algunas tienen datos; "Sin datos" si ninguna', () => {
    const algunas = [congelada(tipos[0], 'VERDE_OPTIMO'), ...tipos.slice(1).map((t) => new MetricaCongelada({ tipoMetrica: t }))].map((x) => x.comoMedicion());
    assert.strictEqual(calculador.calcularIndiceSaludDeterminista(algunas), null);
    assert.strictEqual(calculador.obtenerLeyendaIndice(algunas), 'Insuficiente');
    const ninguna = tipos.map((t) => new MetricaCongelada({ tipoMetrica: t }).comoMedicion());
    assert.strictEqual(calculador.obtenerLeyendaIndice(ninguna), 'Sin datos');
  });

  test('Desglose: 4 métricas ordenadas ROJO > AMARILLO > VERDE > SIN_DATOS', () => {
    const config = new ConfiguracionMetricas({ metricas: tipos.map((tipo) => ({ tipo, meta: 1, umbralAdvertencia: 1, umbralCritico: 1 })) });
    const m = [congelada(tipos[0], 'VERDE_OPTIMO'), new MetricaCongelada({ tipoMetrica: tipos[1] }), congelada(tipos[2], 'ROJO_CRITICO'), congelada(tipos[3], 'AMARILLO_ADVERTENCIA')]
      .map((x) => x.comoMedicion());
    const desglose = calculador.generarDesgloseImpacto(m, config);
    assert.deepStrictEqual(desglose.map((d) => d.impacto), ['NEGATIVO', 'NEGATIVO', 'POSITIVO', 'SIN_DATOS']);
  });

  test('MetricaCongelada es de solo lectura', () => {
    const m = congelada(tipos[0], 'VERDE_OPTIMO', 2);
    assert.throws(() => { 'use strict'; m.valorFinal = 5; });
  });
});

describe('CU-08: bitácora y PDFs (FN-07 / FN-08)', () => {
  const resoluciones = [
    new ResolucionPendiente({ tipo: TipoPendiente.DEFECTO, registroId: 'd1', descripcion: 'DEF-1', opcion: 'CANCELAR', justificacion: 'duplicado' }),
    new ResolucionPendiente({ tipo: TipoPendiente.ACCION_CORRECTIVA, registroId: 'c1', descripcion: 'Refactor', opcion: 'ARRASTRAR' }),
  ];
  const retrospectiva = new Retrospectiva(RETRO);

  test('Decisiones: una por resolución (incluye arrastres) y una con los acuerdos', () => {
    const decisiones = generadorBitacora.construirDecisiones(resoluciones, retrospectiva);
    assert.deepStrictEqual(decisiones.map((d) => d.origen), ['RESOLUCION_PENDIENTE', 'RESOLUCION_PENDIENTE', 'RETROSPECTIVA']);
    assert.strictEqual(decisiones[2].descripcion, 'd');
  });

  test('Se compilan los PDF del reporte final y de la bitácora', async () => {
    const reporte = {
      versionReporte: 5, nombreVersion: 'CP5-Reporte final', indiceSaludGeneral: null, leyendaIndice: 'Insuficiente',
      estadoSalud: 'SIN_DATOS', klocActual: 2, actividadesPlaneadas: 4, actividadesEjecutadas: 2,
      notasEjecutivas: retrospectiva.comoNotasEjecutivas(), fechaGeneracion: new Date(),
    };
    const pdfReporte = await exportadorReporte.compilarPDF(reporte, []);
    assert.strictEqual(pdfReporte.contenidoBytes.subarray(0, 4).toString(), '%PDF');

    const bitacora = {
      periodo: '2026-2',
      ...generadorBitacora.compilar({ resoluciones, retrospectiva }, {
        actividades: [{ nombre: 'Pruebas', tipo: 'PRUEBAS', fase: 'X', estado: 'REALIZADA', evidenciaRef: 'http://e' }],
        defectos: [], accionesCorrectivas: [], actas: [], rondasPruebas: [],
      }),
    };
    assert.deepStrictEqual(bitacora.evidencias, ['Pruebas: http://e']);
    const pdfBitacora = await exportadorBitacora.compilarPDF(bitacora);
    assert.strictEqual(pdfBitacora.nombreArchivo, 'Bitacora_SQA_2026-2.pdf');
    assert.strictEqual(pdfBitacora.contenidoBytes.subarray(0, 4).toString(), '%PDF');
  });
});
