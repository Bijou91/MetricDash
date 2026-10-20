/**
 * PRUEBAS DE IMPLEMENTACIÓN (integración) — CU-01, CU-02 y CU-03 contra el API y PostgreSQL reales.
 *
 * Requiere un periodo activo SIN proyecto registrado: la prueba registra su propio proyecto y al final
 * lo elimina con el botón "Reiniciar" de CU-01 (que también comprueba el borrado en cascada).
 * FE-01 se provoca con una restricción CHECK (false) temporal en la tabla que se escribe al final de cada guardado.
 *
 * Uso: API_URL=http://localhost:4000 DATABASE_URL=postgresql://... node scripts/pruebasImplementacion.js [resultados.json]
 */
const fs = require('fs');
const assert = require('node:assert');
const { Pool } = require('pg');

const API = `${process.env.API_URL || 'http://localhost:4000'}/api`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://sqa_user:sqa_password@localhost:5432/sqa_dashboard' });
const resultados = [];
const ctx = {};

async function http(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const contar = async (tabla, where = '', params = []) =>
  (await pool.query(`SELECT count(*)::int AS n FROM ${tabla} ${where}`, params)).rows[0].n;

async function prueba(id, fn) {
  try {
    const actual = await fn();
    resultados.push({ id, aprobada: true, actual });
    console.log(`✔ ${id} ${actual}`);
  } catch (err) {
    resultados.push({ id, aprobada: false, actual: `Falló: ${err.message}` });
    console.log(`✖ ${id} ${err.message}`);
  }
}

// Simula la caída de la BD al escribir en `tabla`: cualquier INSERT nuevo viola la restricción.
async function conFallaEn(tabla, fn) {
  await pool.query(`ALTER TABLE ${tabla} ADD CONSTRAINT prueba_fe01 CHECK (false) NOT VALID`);
  try {
    return await fn();
  } finally {
    await pool.query(`ALTER TABLE ${tabla} DROP CONSTRAINT IF EXISTS prueba_fe01`);
  }
}

const registro = {
  name: 'MetricDash Prueba Integración',
  estimatedKloc: 1,
  projectType: 'DESARROLLO_NUEVO',
  members: [
    { role: 'QA', memberName: 'Héctor Varela' },
    { role: 'TECNICO', memberName: 'Carlos Aguirre' },
    { role: 'GESTION_PROYECTO', memberName: 'Karol Espino' },
  ],
};
const metricas = (v) => ({
  metricas: [
    { tipo: 'DENSIDAD_DEFECTOS', meta: 1, umbralAdvertencia: 3, umbralCritico: 5 },
    { tipo: 'COBERTURA_PRUEBAS', meta: 80, umbralAdvertencia: 70, umbralCritico: 50 },
    { tipo: 'TASA_EXITO_PRUEBAS', meta: 95, umbralAdvertencia: 90, umbralCritico: v === 2 ? 85 : 80 },
    { tipo: 'CUMPLIMIENTO_SQA', meta: 90, umbralAdvertencia: 75, umbralCritico: 60 },
  ],
});
const defecto = (descripcion, extra = {}) => ({
  reportadoPorId: ctx.qa,
  asignadoAId: ctx.tecnico,
  severidad: 'MEDIA',
  prioridad: 'ALTA',
  faseDeteccion: 'INTEGRACION_Y_PRUEBAS',
  faseOrigen: 'CONSTRUCCION_SOFTWARE',
  descripcionDetallada: descripcion,
  ...extra,
});

async function main() {
  const previo = await http('GET', '/proyectos/activo');
  if (previo.body?.existe) {
    throw new Error('El periodo activo ya tiene un proyecto. Ejecute las pruebas sobre una base sin proyecto registrado.');
  }

  // ------------------------------------------------------------------ CU-01
  await prueba('INT-001', async () => {
    const r = await http('POST', '/proyectos', { ...registro, members: registro.members.slice(0, 2) });
    assert.strictEqual(r.status, 400);
    assert.ok(r.body.errores.some((e) => e.campo === 'rol_GESTION_PROYECTO'));
    assert.strictEqual(await contar('monitored_projects'), 0);
    return 'Respondió 400 señalando el rol rol_GESTION_PROYECTO; en la BD no se creó ningún proyecto.';
  });

  await prueba('INT-002', () => conFallaEn('evaluation_cutoffs', async () => {
    const r = await http('POST', '/proyectos', registro);
    assert.strictEqual(r.status, 500);
    const quedan = await Promise.all(['monitored_projects', 'project_members', 'sqa_activities', 'configuration_baselines'].map((t) => contar(t)));
    assert.deepStrictEqual(quedan, [0, 0, 0, 0]);
    return `Respondió 500 con "${r.body.mensaje}"; tras el ROLLBACK quedaron 0 proyectos, 0 miembros, 0 actividades y 0 líneas base.`;
  }));

  await prueba('INT-003', async () => {
    const r = await http('POST', '/proyectos', registro);
    assert.strictEqual(r.status, 201);
    ctx.proyectoId = r.body.proyectoId;
    const p = [ctx.proyectoId];
    const [miembros, actividades, lineas] = await Promise.all([
      contar('project_members', 'WHERE project_id = $1', p),
      contar('sqa_activities', 'WHERE project_id = $1', p),
      contar('configuration_baselines', 'WHERE project_id = $1', p),
    ]);
    const corte = (await pool.query('SELECT * FROM evaluation_cutoffs WHERE project_id = $1', p)).rows;
    assert.strictEqual(miembros, 3);
    assert.ok(actividades >= 8);
    assert.strictEqual(lineas, 1);
    assert.strictEqual(corte.length, 1);
    const m = (await pool.query('SELECT id, role FROM project_members WHERE project_id = $1', p)).rows;
    ctx.qa = m.find((x) => x.role === 'QA').id;
    ctx.tecnico = m.find((x) => x.role === 'TECNICO').id;
    return `Respondió 201; en la BD quedaron 1 proyecto, ${miembros} miembros, ${actividades} actividades del plan, ${lineas} línea base y el corte "${corte[0].cutoff_name}" en ${corte[0].health_status}.`;
  });

  await prueba('INT-004', async () => {
    const r = await http('POST', '/proyectos', { ...registro, name: 'Segundo proyecto' });
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.limiteExcedido, true);
    const activo = await http('GET', '/proyectos/activo');
    assert.strictEqual(activo.body.proyecto.id, ctx.proyectoId);
    assert.strictEqual(await contar('monitored_projects'), 1);
    return `Respondió 409 con limiteExcedido = true; GET /proyectos/activo regresa el proyecto ya registrado ("${activo.body.proyecto.name}") y sigue habiendo 1 proyecto.`;
  });

  await prueba('INT-005', async () => {
    const act = (await pool.query('SELECT id FROM sqa_activities WHERE project_id = $1 LIMIT 1', [ctx.proyectoId])).rows[0];
    const r = await http('PATCH', `/proyectos/actividades/${act.id}`, { status: 'REALIZADA' });
    assert.strictEqual(r.status, 200);
    const fila = (await pool.query('SELECT status, execution_date FROM sqa_activities WHERE id = $1', [act.id])).rows[0];
    const corte = (await pool.query('SELECT executed_sqa_acts FROM evaluation_cutoffs WHERE project_id = $1', [ctx.proyectoId])).rows[0];
    assert.strictEqual(fila.status, 'DONE');
    assert.ok(fila.execution_date);
    assert.strictEqual(corte.executed_sqa_acts, 1);
    return 'Respondió 200; la actividad quedó en DONE con fecha de ejecución y el corte registra 1 actividad SQA ejecutada.';
  });

  // ------------------------------------------------------------------ CU-02 y precondición de CU-03
  await prueba('INT-006', async () => {
    const r = await http('GET', `/proyectos/${ctx.proyectoId}/metricas/vigente`);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body, null);
    return 'Respondió 200 con null: el formulario se muestra vacío para la primera configuración.';
  });

  await prueba('INT-007', async () => {
    const r = await http('POST', `/proyectos/${ctx.proyectoId}/defectos`, defecto('Prueba sin umbrales configurados'));
    assert.strictEqual(r.status, 409);
    assert.strictEqual(await contar('defects'), 0);
    return `Respondió 409 con "${r.body.mensaje}"; no se guardó ningún defecto.`;
  });

  await prueba('INT-008', async () => {
    const r = await http('POST', `/proyectos/${ctx.proyectoId}/metricas/validar`, { metricas: metricas(1).metricas.slice(0, 3) });
    assert.strictEqual(r.status, 400);
    assert.ok(r.body.errores.some((e) => e.tipoMetrica === 'CUMPLIMIENTO_SQA'));
    return 'Respondió 400 señalando que falta CUMPLIMIENTO_SQA.';
  });

  await prueba('INT-009', async () => {
    const dto = metricas(1);
    dto.metricas[1] = { ...dto.metricas[1], umbralCritico: 80 };
    dto.metricas[0] = { ...dto.metricas[0], umbralAdvertencia: 6 };
    const r = await http('POST', `/proyectos/${ctx.proyectoId}/metricas/validar`, dto);
    assert.strictEqual(r.status, 422);
    const campos = r.body.errores.map((e) => `${e.tipoMetrica}.${e.campo}`);
    assert.ok(campos.includes('COBERTURA_PRUEBAS.umbralCritico'));
    assert.ok(campos.includes('DENSIDAD_DEFECTOS.umbralCritico'));
    return `Respondió 422 con los errores: ${campos.join(', ')}.`;
  });

  await prueba('INT-010', async () => {
    const r = await http('POST', `/proyectos/${ctx.proyectoId}/metricas/validar`, metricas(1));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.vistaPrevia.rangos.length, 12);
    assert.strictEqual(await contar('metric_configurations'), 0);
    const cob = r.body.vistaPrevia.rangos.filter((x) => x.tipoMetrica === 'COBERTURA_PRUEBAS').map((x) => `${x.estado} ${x.desde}-${x.hasta}`);
    return `Respondió 200 con 12 rangos (cobertura: ${cob.join(', ')}); la vista previa no guarda nada en la BD.`;
  });

  await prueba('INT-011', async () => {
    const r = await http('POST', `/proyectos/${ctx.proyectoId}/metricas`, metricas(1));
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.version, 1);
    const umbrales = await contar('metric_thresholds t JOIN metric_configurations c ON c.id = t.configuration_id', 'WHERE c.project_id = $1 AND c.is_current', [ctx.proyectoId]);
    assert.strictEqual(umbrales, 4);
    return 'Respondió 201 con la versión 1; en la BD quedó 1 configuración vigente con 4 umbrales.';
  });

  await prueba('INT-012', async () => {
    const r = await http('POST', `/proyectos/${ctx.proyectoId}/metricas`, metricas(2));
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.version, 2);
    const v = (await pool.query('SELECT version, is_current FROM metric_configurations WHERE project_id = $1 ORDER BY version', [ctx.proyectoId])).rows;
    assert.deepStrictEqual(v.map((x) => [x.version, x.is_current]), [[1, false], [2, true]]);
    const vig = await http('GET', `/proyectos/${ctx.proyectoId}/metricas/vigente`);
    assert.strictEqual(vig.body.version, 2);
    return 'Respondió 201 con la versión 2; la versión 1 quedó con is_current = false y GET vigente regresa la versión 2.';
  });

  await prueba('INT-013', () => conFallaEn('metric_thresholds', async () => {
    const r = await http('POST', `/proyectos/${ctx.proyectoId}/metricas`, metricas(1));
    assert.strictEqual(r.status, 500);
    const v = (await pool.query('SELECT version, is_current FROM metric_configurations WHERE project_id = $1 ORDER BY version', [ctx.proyectoId])).rows;
    assert.deepStrictEqual(v.map((x) => [x.version, x.is_current]), [[1, false], [2, true]]);
    return `Respondió 500 con "${r.body.mensaje}"; tras el ROLLBACK no existe la versión 3 y la versión 2 sigue vigente.`;
  }));

  // ------------------------------------------------------------------ CU-03
  const urlDefectos = () => `/proyectos/${ctx.proyectoId}/defectos`;
  const medicion = async () => (await pool.query(
    'SELECT q.defect_density, q.health_status FROM quality_metrics q JOIN evaluation_cutoffs c ON c.id = q.cutoff_id WHERE c.project_id = $1',
    [ctx.proyectoId])).rows[0];

  await prueba('INT-014', async () => {
    const r = await http('POST', urlDefectos(), defecto('', { prioridad: '', faseOrigen: '' }));
    assert.strictEqual(r.status, 400);
    assert.deepStrictEqual(r.body.camposFaltantes.sort(), ['descripcionDetallada', 'faseOrigen', 'prioridad']);
    assert.strictEqual(await contar('defects'), 0);
    return `Respondió 400 con camposFaltantes = [${r.body.camposFaltantes.join(', ')}]; no se guardó ningún defecto.`;
  });

  await prueba('INT-015', async () => {
    const r = await http('POST', urlDefectos(), defecto('El botón guardar de métricas no responde cuando la red es lenta'));
    assert.strictEqual(r.status, 201);
    const d = r.body.defectoRegistrado;
    assert.strictEqual(d.folio, 'DEF-001');
    assert.strictEqual(d.estado, 'ASIGNADO');
    assert.strictEqual(r.body.densidadDefectosActualizada, 1);
    const m = await medicion();
    assert.strictEqual(Number(m.defect_density), 1);
    assert.strictEqual(m.health_status, 'VERDE_OPTIMO');
    return `Respondió 201 con ${d.folio} ASIGNADO a ${d.asignadoNombre}; densidad 1 defecto/KLOC en VERDE_OPTIMO, guardada en quality_metrics.`;
  });

  await prueba('INT-016', async () => {
    const r = await http('POST', urlDefectos(), defecto('El botón guardar de las métricas no responde cuando la red está lenta'));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.requiereConfirmacionDuplicado, true);
    const c = r.body.coincidenciasDetectadas[0];
    assert.strictEqual(c.folio, 'DEF-001');
    assert.strictEqual(await contar('defects'), 1);
    return `Respondió 200 con requiereConfirmacionDuplicado = true y la coincidencia ${c.folio} (${c.porcentajeSimilitud}% de similitud); sigue habiendo 1 defecto.`;
  });

  await prueba('INT-017', async () => {
    const r = await http('POST', `${urlDefectos()}/descartar`);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.descartado, true);
    assert.strictEqual(await contar('defects'), 1);
    return 'Respondió 200 con descartado = true; sigue habiendo 1 defecto en la BD.';
  });

  await prueba('INT-018', async () => {
    const r = await http('POST', urlDefectos(), defecto('El botón guardar de las métricas no responde cuando la red está lenta', { confirmarIncidenciaDistinta: true }));
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.defectoRegistrado.folio, 'DEF-002');
    const fila = (await pool.query("SELECT confirmed_not_duplicate FROM defects WHERE folio = 'DEF-002'")).rows[0];
    assert.strictEqual(fila.confirmed_not_duplicate, true);
    assert.strictEqual(r.body.densidadDefectosActualizada, 2);
    return 'Respondió 201 con DEF-002 marcado como no duplicado (confirmed_not_duplicate = true); densidad 2 en VERDE_OPTIMO.';
  });

  await prueba('INT-019', async () => {
    const r = await http('POST', urlDefectos(), defecto('El registro de proyecto acepta un KLOC negativo desde la API', { severidad: 'CRITICA', faseOrigen: 'DISENO_COMPONENTES' }));
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.nivelSemaforo, 'VERDE_OPTIMO');
    assert.strictEqual(r.body.alertaEmitida.porDefectoCritico, true);
    assert.strictEqual(r.body.alertaEmitida.porUmbralExcedido, false);
    return `Respondió 201 con DEF-003; densidad 3 (aún VERDE_OPTIMO) y alerta: "${r.body.alertaEmitida.mensajeAlerta}"`;
  });

  await prueba('INT-020', async () => {
    const r = await http('POST', urlDefectos(), defecto('La exportación del reporte PDF omite la tabla de actividades', { faseOrigen: 'ANALISIS_REQUERIMIENTOS' }));
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.densidadDefectosActualizada, 4);
    assert.strictEqual(r.body.nivelSemaforo, 'AMARILLO_ADVERTENCIA');
    assert.strictEqual(r.body.alertaEmitida.porUmbralExcedido, true);
    return `Respondió 201 con DEF-004; densidad 4 en AMARILLO_ADVERTENCIA y alerta: "${r.body.alertaEmitida.mensajeAlerta}"`;
  });

  await prueba('INT-021', async () => {
    const r5 = await http('POST', urlDefectos(), defecto('El semáforo no se actualiza al cambiar de pestaña', { faseOrigen: 'INTEGRACION_Y_PRUEBAS' }));
    assert.strictEqual(r5.body.densidadDefectosActualizada, 5);
    assert.strictEqual(r5.body.nivelSemaforo, 'AMARILLO_ADVERTENCIA');
    const r = await http('POST', urlDefectos(), defecto('La sesión expira sin aviso durante la captura de umbrales', { faseOrigen: 'DISENO_COMPONENTES' }));
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.densidadDefectosActualizada, 6);
    assert.strictEqual(r.body.nivelSemaforo, 'ROJO_CRITICO');
    assert.strictEqual(r.body.alertaEmitida.nivelSemaforo, 'ROJO_CRITICO');
    const m = await medicion();
    assert.strictEqual(m.health_status, 'ROJO_CRITICO');
    return `DEF-005 dejó la densidad en 5 (AMARILLO) y DEF-006 en 6: respondió 201 en ROJO_CRITICO con alerta "${r.body.alertaEmitida.mensajeAlerta}"; quality_metrics quedó en ROJO_CRITICO.`;
  });

  // NOT VALID no revisa la fila existente, pero el UPDATE del upsert sí se valida y falla.
  await prueba('INT-022', () => conFallaEn('quality_metrics', async () => {
    const r = await http('POST', urlDefectos(), defecto('El tablero no muestra la fecha de la última medición', { faseOrigen: 'ANALISIS_REQUERIMIENTOS' }));
    assert.strictEqual(r.status, 500);
    assert.strictEqual(await contar('defects'), 6);
    assert.strictEqual(Number((await medicion()).defect_density), 6);
    return `Respondió 500 con "${r.body.mensaje}"; tras el ROLLBACK siguen 6 defectos (no existe DEF-007) y la densidad guardada sigue en 6.`;
  }));

  await prueba('INT-023', async () => {
    const r = await http('GET', urlDefectos());
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.defectos.length, 6);
    assert.strictEqual(r.body.densidadDefectos, 6);
    assert.strictEqual(r.body.nivelSemaforo, 'ROJO_CRITICO');
    assert.strictEqual(r.body.miembros.length, 3);
    return `Respondió 200 con ${r.body.miembros.length} miembros, ${r.body.defectos.length} defectos (${r.body.defectos.map((d) => d.folio).join(', ')}), densidad 6 y ROJO_CRITICO.`;
  });

  // ------------------------------------------------------------------ CU-01 reiniciar (cascada sobre CU-02 y CU-03)
  await prueba('INT-024', async () => {
    const r = await http('DELETE', `/proyectos/${ctx.proyectoId}`);
    assert.strictEqual(r.status, 200);
    const tablas = ['monitored_projects', 'project_members', 'sqa_activities', 'evaluation_cutoffs', 'metric_configurations', 'metric_thresholds', 'defects', 'quality_metrics'];
    const n = await Promise.all(tablas.map((t) => contar(t)));
    assert.deepStrictEqual(n, tablas.map(() => 0));
    ctx.proyectoId = null;
    return `Respondió 200; quedaron en 0 las tablas ${tablas.join(', ')}.`;
  });
}

main()
  .catch((err) => {
    console.error('\n❌', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (ctx.proyectoId) await http('DELETE', `/proyectos/${ctx.proyectoId}`).catch(() => {});
    if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(resultados, null, 2));
    const fallidas = resultados.filter((r) => !r.aprobada).length;
    console.log(`\n${resultados.length - fallidas}/${resultados.length} pruebas aprobadas`);
    if (fallidas) process.exitCode = 1;
    await pool.end();
  });
