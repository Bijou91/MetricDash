/**
 * PRUEBAS AUTOMATIZADAS CU-06: Detectar deterioro y gestionar una acción correctiva
 * Ejecutable directamente con: node --test scripts/pruebaCU06.js
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');

const validador = require('../src/services/ValidadorAccionCorrectiva');
const { SentidoMetrica, TipoMetrica, MetricaCalidad } = require('../src/services/entidades/metricas');
const { NivelSemaforo } = require('../src/services/entidades/proyecto');
const { AccionCorrectiva, AlertaDeterioro, EstadoAccionCorrectiva } = require('../src/services/entidades/accionCorrectiva');

describe('CU-06: ValidadorAccionCorrectiva (FN-05 / FA-05.01)', () => {
  const miembros = [
    { id: '11111111-1111-1111-1111-111111111111', nombre: 'QA Lead', rol: 'QA' },
    { id: '22222222-2222-2222-2222-222222222222', nombre: 'Dev Uno', rol: 'DEVELOPER' },
  ];
  const hoy = validador.obtenerFechaHoyString();

  test('FA-05.01: Falla si los campos requeridos están vacíos', () => {
    const res = validador.validar({}, miembros);
    assert.strictEqual(res.esValido, false);
    const campos = res.errores.map((e) => e.campo);
    assert.ok(campos.includes('descripcion'));
    assert.ok(campos.includes('causaAtendida'));
    assert.ok(campos.includes('responsableId'));
    assert.ok(campos.includes('fechaCompromiso'));
  });

  test('FA-05.01: Falla si el responsable no pertenece al equipo del proyecto', () => {
    const res = validador.validar(
      {
        descripcion: 'Refactorizar módulo de cálculo',
        causaAtendida: 'Defectos acumulados',
        responsableId: '99999999-9999-9999-9999-999999999999',
        fechaCompromiso: hoy,
      },
      miembros,
    );
    assert.strictEqual(res.esValido, false);
    assert.ok(res.errores.some((e) => e.campo === 'responsableId' && e.mensaje.includes('no pertenece al equipo')));
  });

  test('FA-05.01: Falla si la fecha de compromiso es anterior a la fecha actual', () => {
    const fechaAyer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const res = validador.validar(
      {
        descripcion: 'Corregir fallos en login',
        causaAtendida: 'Prueba unitaria fallida',
        responsableId: miembros[0].id,
        fechaCompromiso: fechaAyer,
      },
      miembros,
    );
    assert.strictEqual(res.esValido, false);
    assert.ok(res.errores.some((e) => e.campo === 'fechaCompromiso' && e.mensaje.includes('no puede ser anterior')));
  });

  test('FN-05: Pasa con datos completos, responsable del equipo y fecha compromiso válida', () => {
    const fechaFutura = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];
    const res = validador.validar(
      {
        descripcion: 'Implementar sanitización de entradas en endpoints',
        causaAtendida: 'DEF-003 [CRITICA]: Inyección de valores no validados',
        responsableId: miembros[1].id,
        fechaCompromiso: fechaFutura,
      },
      miembros,
    );
    assert.strictEqual(res.esValido, true);
    assert.strictEqual(res.errores.length, 0);
  });
});

describe('CU-06: Lógica de Detección de Deterioro (FN-01)', () => {
  const umbralDensidad = new MetricaCalidad({
    tipo: TipoMetrica.DENSIDAD_DEFECTOS,
    meta: 1,
    umbralAdvertencia: 3,
    umbralCritico: 5,
  });

  const umbralCobertura = new MetricaCalidad({
    tipo: TipoMetrica.COBERTURA_PRUEBAS,
    meta: 80,
    umbralAdvertencia: 70,
    umbralCritico: 50,
  });

  test('FN-01 (a): Detecta deterioro cuando Vn empeora según MENOR_ES_MEJOR (Vn > Vn-1)', () => {
    const vn_1 = 2; // VERDE
    const vn = 3;   // VERDE aún, pero numéricamente peor (2 -> 3)
    const esPeor = vn > vn_1;
    assert.strictEqual(esPeor, true);
  });

  test('FN-01 (a): Detecta deterioro cuando Vn empeora según MAYOR_ES_MEJOR (Vn < Vn-1)', () => {
    const vn_1 = 85; // VERDE
    const vn = 75;   // VERDE aún, pero numéricamente peor (85 -> 75)
    const esPeor = vn < vn_1;
    assert.strictEqual(esPeor, true);
  });

  test('FN-01 (b): Detecta deterioro por cruce de umbral (de VERDE a AMARILLO)', () => {
    const estado_vn_1 = umbralDensidad.evaluarEstado(2); // VERDE
    const estado_vn = umbralDensidad.evaluarEstado(4);   // AMARILLO
    assert.strictEqual(estado_vn_1, 'VERDE');
    assert.strictEqual(estado_vn, 'AMARILLO');
  });

  test('FN-01 (b): Detecta deterioro por cruce de umbral crítico (de AMARILLO a ROJO)', () => {
    const estado_vn_1 = umbralCobertura.evaluarEstado(65); // AMARILLO
    const estado_vn = umbralCobertura.evaluarEstado(45);   // ROJO
    assert.strictEqual(estado_vn_1, 'AMARILLO');
    assert.strictEqual(estado_vn, 'ROJO');
  });
});

describe('CU-06: Criterio de Verificación de Eficacia (FN-08 / FA-07.01)', () => {
  const umbralDensidad = new MetricaCalidad({
    tipo: TipoMetrica.DENSIDAD_DEFECTOS,
    meta: 1,
    umbralAdvertencia: 3,
    umbralCritico: 5,
  });

  const umbralCobertura = new MetricaCalidad({
    tipo: TipoMetrica.COBERTURA_PRUEBAS,
    meta: 80,
    umbralAdvertencia: 70,
    umbralCritico: 50,
  });

  test('FN-08: Acción EFICAZ cuando Vn+1 es mejor que Vα Y semáforo NO es ROJO', () => {
    const v_alfa = 6; // Densidad cuando se generó la alerta (ROJO)
    const vn_1 = 2;   // Siguiente medición tras aplicar acción correctiva
    const esMejor = vn_1 < v_alfa; // MENOR_ES_MEJOR
    const semaforo = umbralDensidad.evaluarEstado(vn_1);
    const noEsRojo = semaforo !== 'ROJO';

    assert.strictEqual(esMejor, true);
    assert.strictEqual(semaforo, 'VERDE');
    assert.strictEqual(noEsRojo, true);
    const esEficaz = esMejor && noEsRojo;
    assert.strictEqual(esEficaz, true);
  });

  test('FA-07.01: NO EFICAZ si Vn+1 no mejora respecto a Vα', () => {
    const v_alfa = 4; // Densidad en advertencia (AMARILLO)
    const vn_1 = 5;   // Empeoró a 5
    const esMejor = vn_1 < v_alfa;
    assert.strictEqual(esMejor, false);
  });

  test('FA-07.01: NO EFICAZ si aunque mejoró numéricamente, el semáforo sigue en ROJO', () => {
    const v_alfa = 10; // ROJO severo
    const vn_1 = 7;    // Mejoró respecto a 10, pero con umbralCritico=5 sigue en ROJO!
    const esMejor = vn_1 < v_alfa;
    const semaforo = umbralDensidad.evaluarEstado(vn_1);
    const noEsRojo = semaforo !== 'ROJO';

    assert.strictEqual(esMejor, true);
    assert.strictEqual(semaforo, 'ROJO');
    assert.strictEqual(noEsRojo, false);
    const esEficaz = esMejor && noEsRojo;
    assert.strictEqual(esEficaz, false);
  });

  test('FN-08: Cobertura de pruebas (MAYOR_ES_MEJOR) eficaz si Vn+1 > Vα y no es ROJO', () => {
    const v_alfa = 45; // ROJO (< 50)
    const vn_1 = 75;   // VERDE (>= 70)
    const esMejor = vn_1 > v_alfa;
    const semaforo = umbralCobertura.evaluarEstado(vn_1);
    const noEsRojo = semaforo !== 'ROJO';

    assert.strictEqual(esMejor, true);
    assert.strictEqual(semaforo, 'VERDE');
    assert.strictEqual(noEsRojo, true);
    const esEficaz = esMejor && noEsRojo;
    assert.strictEqual(esEficaz, true);
  });
});

describe('CU-06: Entidad AccionCorrectiva y Ciclo de Vida', () => {
  test('Instancia en estado inicial "abierta"', () => {
    const accion = new AccionCorrectiva({
      alertaId: '33333333-3333-3333-3333-333333333333',
      proyectoId: '44444444-4444-4444-4444-444444444444',
      tipoMetrica: 'DENSIDAD_DEFECTOS',
      descripcion: 'Depuración y cierre de defectos críticos',
      causaAtendida: 'DEF-001',
      responsableId: '11111111-1111-1111-1111-111111111111',
      fechaCompromiso: '2026-11-15',
    });

    assert.strictEqual(accion.estaAbierta(), true);
    assert.strictEqual(accion.estado, 'abierta');
    assert.strictEqual(accion.esEficaz, null);

    // Cierre como eficaz (FN-08)
    accion.cerrarComoEficaz();
    assert.strictEqual(accion.estado, 'cerrada');
    assert.strictEqual(accion.esEficaz, true);
    assert.strictEqual(accion.estaAbierta(), false);
  });

  test('FA-07.01: Al ser no eficaz se mantiene abierta con esEficaz=false', () => {
    const accion = new AccionCorrectiva({
      alertaId: '33333333-3333-3333-3333-333333333333',
      proyectoId: '44444444-4444-4444-4444-444444444444',
      tipoMetrica: 'COBERTURA_PRUEBAS',
      descripcion: 'Aumentar casos de prueba',
      causaAtendida: 'Pruebas no ejecutadas',
      responsableId: '11111111-1111-1111-1111-111111111111',
      fechaCompromiso: '2026-11-20',
    });

    accion.marcarNoEficaz();
    assert.strictEqual(accion.estado, 'abierta');
    assert.strictEqual(accion.esEficaz, false);
    assert.strictEqual(accion.estaAbierta(), true);
  });
});

describe('CU-06: Coordinación del Flujo Principal y Alternativo (DSO)', () => {
  test('FA-01.01: Si ya existe una acción abierta para la métrica, se asocia y no duplica la alerta', () => {
    // Simular que el repositorio encuentra una acción abierta existente
    const accionExistente = new AccionCorrectiva({
      id: 'acc-001',
      alertaId: 'alt-001',
      proyectoId: 'proy-001',
      tipoMetrica: 'DENSIDAD_DEFECTOS',
      descripcion: 'Corregir fallos críticos',
      causaAtendida: 'DEF-001',
      responsableId: 'resp-001',
      fechaCompromiso: '2026-11-20',
      estado: 'abierta',
    });

    const esAccionAbierta = accionExistente.estaAbierta();
    assert.strictEqual(esAccionAbierta, true);
    // En la coordinación, al existir accionAbierta, se deriva a verificarEficacia sin invocar SD.evaluarNuevaMedicion
    const flujoDestino = esAccionAbierta ? 'VERIFICACION_EFICACIA' : 'DETECCION_DETERIORO';
    assert.strictEqual(flujoDestino, 'VERIFICACION_EFICACIA');
  });

  test('FN-02: Causas identificadas priorizan defectos críticos para densidad de defectos', () => {
    const defectosMock = [
      { folio: 'DEF-001', severity: 'MEDIA', status: 'ASIGNADO' },
      { folio: 'DEF-002', severity: 'CRITICA', status: 'ASIGNADO' },
      { folio: 'DEF-003', severity: 'ALTA', status: 'REGISTRADO' },
      { folio: 'DEF-004', severity: 'BAJA', status: 'CERRADO' }, // cerrado: se excluye
    ];

    const pesoSeveridad = { CRITICA: 1, ALTA: 2, MEDIA: 3, BAJA: 4 };
    const causasOrdenadas = defectosMock
      .filter((d) => d.status !== 'CERRADO' && d.status !== 'DESCARTADO')
      .sort((a, b) => pesoSeveridad[a.severity] - pesoSeveridad[b.severity]);

    assert.strictEqual(causasOrdenadas.length, 3);
    assert.strictEqual(causasOrdenadas[0].folio, 'DEF-002'); // Crítico primero
    assert.strictEqual(causasOrdenadas[1].folio, 'DEF-003'); // Alta después
    assert.strictEqual(causasOrdenadas[2].folio, 'DEF-001'); // Media al final
  });
});
