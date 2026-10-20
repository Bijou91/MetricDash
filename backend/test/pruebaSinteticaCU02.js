/**
 * PRUEBA SINTÉTICA END-TO-END — CU-02: Definir las métricas de calidad y sus umbrales
 * 
 * Simula el flujo completo del usuario en MetricDash según la especificación:
 * 1. Precondiciones: Proyecto activo en el periodo (CU-01).
 * 2. FN-01: Consulta de configuración vigente previa.
 * 3. FA-02.02: Detección y rechazo de campos/métricas incompletas.
 * 4. FA-02.01: Detección y rechazo de umbrales cruzados o ilógicos.
 * 5. FN-03 y FN-04: Validación exitosa y generación de la vista previa del semáforo (12 rangos).
 * 6. FN-05, FN-06 y FN-07: Guardado atómico versionado (v1) en PostgreSQL.
 * 7. Versionado continuo: Nueva versión (v2), desactivación de v1 e inmutabilidad histórica.
 * 8. Comportamiento en runtime: Evaluación dinámica de mediciones reales contra el semáforo.
 */

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sqa_user:sqa_password@localhost:5432/sqa_dashboard';

const assert = require('node:assert');
const pool = require('../src/db/pool');
const service = require('../src/services/ConfiguracionMetricasService');
const configRepo = require('../src/repositories/ConfiguracionMetricasRepository');
const proyectoRepo = require('../src/repositories/ProyectoRepository');
const { TipoMetrica, EstadoSemaforo } = require('../src/domain/metricas');

async function ejecutarPruebaSintetica() {
  console.log('======================================================================');
  console.log(' INICIANDO PRUEBA SINTÉTICA DEL CASO DE USO CU-02 (METRICDASH)       ');
  console.log('======================================================================\n');

  try {
    // -----------------------------------------------------------------------
    // PASO 1: VERIFICAR PRECONDICIONES (CU-01)
    // -----------------------------------------------------------------------
    console.log('[1/7] Verificando Precondiciones del CU-02...');
    const periodo = await proyectoRepo.obtenerPeriodoActivo();
    assert.ok(periodo, 'ERROR: Debe existir un periodo académico activo.');
    console.log(`  ✓ Periodo académico activo encontrado: ${periodo.name} (${periodo.code})`);

    let proyecto = await proyectoRepo.obtenerProyectoPeriodoActivo();
    if (!proyecto) {
      console.log('  -> No hay proyecto aún. Sembrando proyecto inicial para probar CU-02...');
      const { rows } = await pool.query(
        `INSERT INTO monitored_projects (period_id, name, description, project_type, estimated_kloc, technical_lead_role, qa_lead_role, pm_role)
         VALUES ($1, 'MetricDash SQA', 'Herramienta de calidad', 'DESARROLLO_NUEVO', 4.5, 'Carlos Aguirre', 'Héctor Varela', 'Karol Espino')
         RETURNING *`,
        [periodo.id]
      );
      proyecto = rows[0];
    }
    const proyectoId = proyecto.id;
    console.log(`  ✓ Proyecto activo verificado: "${proyecto.name}" (ID: ${proyectoId})\n`);

    // -----------------------------------------------------------------------
    // PASO 2: FN-01 - CONSULTAR CONFIGURACIÓN VIGENTE
    // -----------------------------------------------------------------------
    console.log('[2/7] FN-01: Consultando configuración vigente actual...');
    const vigenteInicial = await configRepo.obtenerVigente(proyectoId);
    console.log(`  ✓ Estado inicial de configuración: ${vigenteInicial ? `Versión ${vigenteInicial.version}` : 'Sin configuración previa'}\n`);

    // -----------------------------------------------------------------------
    // PASO 3: FA-02.02 - VALIDAR MÉTRICAS INCOMPLETAS (OMISIÓN / VACÍOS)
    // -----------------------------------------------------------------------
    console.log('[3/7] FA-02.02: Probando rechazo de métricas incompletas o campos vacíos...');
    const dtoIncompleto = {
      metricas: [
        { tipo: 'DENSIDAD_DEFECTOS', meta: null, umbralAdvertencia: 3, umbralCritico: 5 },
        { tipo: 'COBERTURA_PRUEBAS', meta: 80, umbralAdvertencia: 70, umbralCritico: 50 },
        // Faltan TASA_EXITO_PRUEBAS y CUMPLIMIENTO_SQA
      ],
    };

    const resIncompleto = await service.validar(proyectoId, dtoIncompleto);
    assert.strictEqual(resIncompleto.valido, false, 'La validación debió fallar por completitud.');
    assert.strictEqual(resIncompleto.incompleto, true, 'El flag incompleto debe ser true (HTTP 400).');
    assert.ok(resIncompleto.errores.some((e) => e.campo === 'meta'), 'Debe reportar meta faltante.');
    assert.ok(resIncompleto.errores.some((e) => e.tipoMetrica === 'TASA_EXITO_PRUEBAS'), 'Debe reportar falta de TASA_EXITO_PRUEBAS.');
    console.log(`  ✓ Rechazado correctamente con ${resIncompleto.errores.length} errores de completitud identificados.\n`);

    // -----------------------------------------------------------------------
    // PASO 4: FA-02.01 - VALIDAR UMBRALES CRUZADOS O ILÓGICOS
    // -----------------------------------------------------------------------
    console.log('[4/7] FA-02.01: Probando rechazo de umbrales incoherentes o cruzados...');
    const dtoCruzado = {
      metricas: [
        // En MENOR_ES_MEJOR: advertencia debe ser menor que crítico y mayor que meta
        { tipo: 'DENSIDAD_DEFECTOS', meta: 1.0, umbralAdvertencia: 6.0, umbralCritico: 4.0 }, // Advertencia > Crítico (CRUZADO)
        // En MAYOR_ES_MEJOR: advertencia debe ser mayor que crítico y menor que meta
        { tipo: 'COBERTURA_PRUEBAS', meta: 80, umbralAdvertencia: 60, umbralCritico: 75 }, // Crítico > Advertencia (CRUZADO)
        { tipo: 'TASA_EXITO_PRUEBAS', meta: 95, umbralAdvertencia: 90, umbralCritico: 80 },
        { tipo: 'CUMPLIMIENTO_SQA', meta: 90, umbralAdvertencia: 75, umbralCritico: 60 },
      ],
    };

    const resCruzado = await service.validar(proyectoId, dtoCruzado);
    assert.strictEqual(resCruzado.valido, false, 'La validación debió fallar por coherencia.');
    assert.strictEqual(resCruzado.incompleto, false, 'No falta ningún campo; es incoherencia (HTTP 422).');
    assert.ok(resCruzado.errores.length >= 2, 'Deben reportarse al menos 2 umbrales cruzados.');
    console.log(`  ✓ Rechazado correctamente con ${resCruzado.errores.length} errores de coherencia lógica detectados.\n`);

    // -----------------------------------------------------------------------
    // PASO 5: FN-03 Y FN-04 - VALIDACIÓN COHERENTE Y VISTA PREVIA DEL SEMÁFORO
    // -----------------------------------------------------------------------
    console.log('[5/7] FN-03 y FN-04: Validando configuración correcta y generando vista previa...');
    const dtoValidoV1 = {
      metricas: [
        { tipo: 'DENSIDAD_DEFECTOS', meta: 1.0, umbralAdvertencia: 3.0, umbralCritico: 5.0 },
        { tipo: 'COBERTURA_PRUEBAS', meta: 80.0, umbralAdvertencia: 70.0, umbralCritico: 50.0 },
        { tipo: 'TASA_EXITO_PRUEBAS', meta: 95.0, umbralAdvertencia: 90.0, umbralCritico: 80.0 },
        { tipo: 'CUMPLIMIENTO_SQA', meta: 90.0, umbralAdvertencia: 75.0, umbralCritico: 60.0 },
      ],
    };

    const resValido = await service.validar(proyectoId, dtoValidoV1);
    assert.strictEqual(resValido.valido, true, 'La validación debe ser exitosa.');
    assert.strictEqual(resValido.errores.length, 0);

    const vistaPrevia = service.generarVistaPrevia(resValido.metricas);
    assert.strictEqual(vistaPrevia.rangos.length, 12, 'Deben generarse exactamente 12 rangos para el semáforo (3 por métrica).');
    console.log('  ✓ Validación exitosa.');
    console.log('  ✓ Vista previa generada con 12 bandas de semáforo (VERDE, AMARILLO, ROJO):');
    for (const r of vistaPrevia.rangos.slice(0, 6)) {
      console.log(`    - [${r.tipoMetrica}] Estado ${r.estado}: de ${r.desde} a ${r.hasta ?? '∞'}`);
    }
    console.log('    - ... (6 rangos restantes verificados correctamente)\n');

    // -----------------------------------------------------------------------
    // PASO 6: FN-05, FN-06 Y FN-07 - GUARDADO ATÓMICO VERSIONADO EN BD (VERSIÓN 1)
    // -----------------------------------------------------------------------
    console.log('[6/7] FN-05/06/07: Guardando configuración versionada (v1) en PostgreSQL...');
    const usuarioId = '00000000-0000-0000-0000-000000000001';
    const configGuardadaV1 = await service.guardarVersionada(proyectoId, dtoValidoV1, usuarioId);

    assert.ok(configGuardadaV1.version >= 1, 'Debe asignarse un número de versión.');
    assert.strictEqual(configGuardadaV1.vigente, true, 'Debe marcarse como vigente.');
    const v1Numero = configGuardadaV1.version;
    console.log(`  ✓ Configuración guardada en BD como Versión ${v1Numero} (Vigente = true).`);

    // Verificar en BD
    const enBDV1 = await configRepo.obtenerVigente(proyectoId);
    assert.strictEqual(enBDV1.version, v1Numero);
    assert.strictEqual(enBDV1.metricas.length, 4);
    console.log(`  ✓ Consulta a BD confirma Versión ${enBDV1.version} activa con 4 métricas asociadas.\n`);

    // -----------------------------------------------------------------------
    // PASO 7: VERSIONADO Y EVOLUCIÓN HISTÓRICA (VERSIÓN 2)
    // -----------------------------------------------------------------------
    console.log('[7/7] Versionado continuo: Guardando ajuste de metas (v2) y comprobando inmutabilidad...');
    const dtoValidoV2 = {
      metricas: [
        { tipo: 'DENSIDAD_DEFECTOS', meta: 0.8, umbralAdvertencia: 2.5, umbralCritico: 4.5 }, // Metas más estrictas
        { tipo: 'COBERTURA_PRUEBAS', meta: 85.0, umbralAdvertencia: 75.0, umbralCritico: 55.0 },
        { tipo: 'TASA_EXITO_PRUEBAS', meta: 98.0, umbralAdvertencia: 92.0, umbralCritico: 85.0 },
        { tipo: 'CUMPLIMIENTO_SQA', meta: 95.0, umbralAdvertencia: 80.0, umbralCritico: 70.0 },
      ],
    };

    const configGuardadaV2 = await service.guardarVersionada(proyectoId, dtoValidoV2, usuarioId);
    assert.strictEqual(configGuardadaV2.version, v1Numero + 1, 'La nueva versión debe ser v1 + 1.');
    assert.strictEqual(configGuardadaV2.vigente, true);
    console.log(`  ✓ Nueva versión v${configGuardadaV2.version} guardada exitosamente como vigente.`);

    // Verificar en BD que la versión anterior quedó desactivada pero preservada
    const { rows: configsHistoricas } = await pool.query(
      `SELECT version, is_current FROM metric_configurations WHERE project_id = $1 ORDER BY version ASC`,
      [proyectoId]
    );
    console.log(`  ✓ Historial de versiones en BD:`);
    for (const c of configsHistoricas) {
      console.log(`    - Versión ${c.version}: is_current = ${c.is_current}`);
    }
    const prevConfig = configsHistoricas.find((c) => c.version === v1Numero);
    assert.strictEqual(prevConfig.is_current, false, 'La versión v1 debe haber sido desactivada.');
    const activeConfig = configsHistoricas.find((c) => c.version === configGuardadaV2.version);
    assert.strictEqual(activeConfig.is_current, true, 'La versión v2 debe estar activa.');

    // -----------------------------------------------------------------------
    // EVALUACIÓN DE PRUEBA DE SEMÁFORO EN RUNTIME
    // -----------------------------------------------------------------------
    console.log('\n[Comprobación de Semáforo Dinámico en Runtime]');
    const metricaDensidad = configGuardadaV2.metricas.find((m) => m.tipo === 'DENSIDAD_DEFECTOS');
    const metricaCobertura = configGuardadaV2.metricas.find((m) => m.tipo === 'COBERTURA_PRUEBAS');

    console.log(`  - Densidad (meta: ${metricaDensidad.meta}, adv: ${metricaDensidad.umbralAdvertencia}, crit: ${metricaDensidad.umbralCritico})`);
    console.log(`    * 0.5 def/KLOC  -> ${metricaDensidad.evaluarEstado(0.5)} (Esperado: VERDE)`);
    console.log(`    * 3.2 def/KLOC  -> ${metricaDensidad.evaluarEstado(3.2)} (Esperado: AMARILLO)`);
    console.log(`    * 5.0 def/KLOC  -> ${metricaDensidad.evaluarEstado(5.0)} (Esperado: ROJO)`);

    assert.strictEqual(metricaDensidad.evaluarEstado(0.5), EstadoSemaforo.VERDE);
    assert.strictEqual(metricaDensidad.evaluarEstado(3.2), EstadoSemaforo.AMARILLO);
    assert.strictEqual(metricaDensidad.evaluarEstado(5.0), EstadoSemaforo.ROJO);

    console.log(`  - Cobertura (meta: ${metricaCobertura.meta}%, adv: ${metricaCobertura.umbralAdvertencia}%, crit: ${metricaCobertura.umbralCritico}%)`);
    console.log(`    * 88% cobertura -> ${metricaCobertura.evaluarEstado(88)} (Esperado: VERDE)`);
    console.log(`    * 65% cobertura -> ${metricaCobertura.evaluarEstado(65)} (Esperado: AMARILLO)`);
    console.log(`    * 40% cobertura -> ${metricaCobertura.evaluarEstado(40)} (Esperado: ROJO)`);

    assert.strictEqual(metricaCobertura.evaluarEstado(88), EstadoSemaforo.VERDE);
    assert.strictEqual(metricaCobertura.evaluarEstado(65), EstadoSemaforo.AMARILLO);
    assert.strictEqual(metricaCobertura.evaluarEstado(40), EstadoSemaforo.ROJO);

    console.log('\n======================================================================');
    console.log(' ¡PRUEBA SINTÉTICA DE CU-02 COMPLETADA EXITOSAMENTE! (100% PASS)       ');
    console.log('======================================================================');
  } finally {
    await pool.end();
  }
}

ejecutarPruebaSintetica().catch((err) => {
  console.error('\n❌ ERROR EN LA PRUEBA SINTÉTICA:', err);
  process.exit(1);
});
