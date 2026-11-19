/**
 * PRUEBAS DE INTEGRACIÓN CU-08 — Cerrar el periodo y generar la bitácora de SQA, contra el API y PostgreSQL reales.
 *
 * Requiere un periodo activo ABIERTO y SIN proyecto registrado (igual que pruebasImplementacion.js): la prueba
 * registra su propio proyecto (CU-01 y CU-02 por API), prepara pendientes, cierra el periodo y al final deja la
 * base como estaba: reabre el periodo (status = 'ABIERTO') y elimina el proyecto con el "Reiniciar" del CU-01.
 * FE-01 se provoca con una restricción CHECK (false) temporal en sqa_logbooks, que es lo último que se escribe.
 *
 * Uso: API_URL=http://localhost:4000 DATABASE_URL=postgresql://... node scripts/pruebasIntegracionCU08.js [resultados.json]
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
  const tipo = res.headers.get('content-type') || '';
  if (tipo.includes('application/pdf')) return { status: res.status, tipo, bytes: Buffer.from(await res.arrayBuffer()) };
  return { status: res.status, tipo, body: await res.json().catch(() => null) };
}

const q = async (sql, params = []) => (await pool.query(sql, params)).rows;
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

async function conFallaEn(tabla, fn) {
  await pool.query(`ALTER TABLE ${tabla} ADD CONSTRAINT prueba_fe01 CHECK (false) NOT VALID`);
  try {
    return await fn();
  } finally {
    await pool.query(`ALTER TABLE ${tabla} DROP CONSTRAINT IF EXISTS prueba_fe01`);
  }
}

// Estado de todo lo que el cierre puede tocar: sirve para comprobar que FN-05 y FE-01 no guardan nada.
async function fotografia() {
  const p = [ctx.proyectoId];
  return JSON.stringify({
    actividades: await q('SELECT id, status FROM sqa_activities WHERE project_id = $1 ORDER BY id', p),
    defectos: await q(`SELECT d.id, d.status, d.resolution_notes FROM defects d JOIN evaluation_cutoffs c ON c.id = d.cutoff_id
                        WHERE c.project_id = $1 ORDER BY d.id`, p),
    acciones: await q('SELECT id, status FROM corrective_actions WHERE project_id = $1 ORDER BY id', p),
    alertas: await q('SELECT id, status FROM quality_alerts WHERE project_id = $1 ORDER BY id', p),
    mediciones: await contar('metric_measurements', 'WHERE project_id = $1', p),
    cortes: await contar('evaluation_cutoffs', 'WHERE project_id = $1', p),
    periodo: (await q('SELECT status FROM academic_periods WHERE id = $1', [ctx.periodoId]))[0].status,
    cierres: await contar('period_closures'),
  });
}

const RETRO = {
  queFuncionoBien: 'Las revisiones por pares detectaron defectos temprano.',
  queDebeMejorar: 'Registrar la evidencia de las pruebas el mismo día.',
  leccionesAprendidas: 'Planear las auditorías desde el inicio del periodo.',
  acuerdos: 'Cada actividad de pruebas se cierra con su ronda de resultados.',
};

// FN-03: opción elegida por cada pendiente; lo no listado se arrastra.
function resolver(pendientes, especiales) {
  return pendientes.map((p) => ({
    registroId: p.registroId,
    ...(especiales[p.registroId] ?? { opcion: 'ARRASTRAR' }),
  }));
}

async function preparar() {
  const previo = await http('GET', '/proyectos/activo');
  if (previo.body?.existe) {
    throw new Error('El periodo activo ya tiene un proyecto. Ejecute las pruebas sobre una base sin proyecto registrado.');
  }
  const [periodo] = await q('SELECT id, status FROM academic_periods WHERE is_active = true ORDER BY created_at DESC LIMIT 1');
  if (!periodo || periodo.status !== 'ABIERTO') throw new Error('Se requiere un periodo activo ABIERTO.');
  ctx.periodoId = periodo.id;

  // CU-01 y CU-02 por API.
  const reg = await http('POST', '/proyectos', {
    name: 'MetricDash Prueba Cierre CU-08',
    estimatedKloc: 1,
    projectType: 'DESARROLLO_NUEVO',
    members: [
      { role: 'QA', memberName: 'Héctor Varela' },
      { role: 'TECNICO', memberName: 'Carlos Aguirre' },
      { role: 'GESTION_PROYECTO', memberName: 'Karol Espino' },
    ],
  });
  assert.strictEqual(reg.status, 201, `CU-01 respondió ${reg.status}`);
  ctx.proyectoId = reg.body.proyectoId;
  const miembros = await q('SELECT id, role FROM project_members WHERE project_id = $1', [ctx.proyectoId]);
  ctx.qa = miembros.find((m) => m.role === 'QA').id;
  ctx.tecnico = miembros.find((m) => m.role === 'TECNICO').id;
  ctx.gestion = miembros.find((m) => m.role === 'GESTION_PROYECTO').id;

  const met = await http('POST', `/proyectos/${ctx.proyectoId}/metricas`, {
    metricas: [
      { tipo: 'DENSIDAD_DEFECTOS', meta: 1, umbralAdvertencia: 3, umbralCritico: 5 },
      { tipo: 'COBERTURA_PRUEBAS', meta: 80, umbralAdvertencia: 70, umbralCritico: 50 },
      { tipo: 'TASA_EXITO_PRUEBAS', meta: 95, umbralAdvertencia: 90, umbralCritico: 80 },
      { tipo: 'CUMPLIMIENTO_SQA', meta: 90, umbralAdvertencia: 75, umbralCritico: 60 },
    ],
  });
  assert.strictEqual(met.status, 201, `CU-02 respondió ${met.status}`);

  // Actividades del plan base: una de pruebas con evidencia (se cerrará), una revisión (se cancelará),
  // una auditoría sin evidencia (no puede cerrarse) y una ya realizada (no es pendiente).
  const acts = await q('SELECT id, category FROM sqa_activities WHERE project_id = $1 ORDER BY created_at, title', [ctx.proyectoId]);
  const deCategoria = (c) => acts.filter((a) => a.category === c);
  ctx.actPruebas = deCategoria('TEST')[0].id;
  ctx.actRevision = deCategoria('REVIEW')[0].id;
  ctx.actAuditoria = deCategoria('AUDIT')[0].id;
  ctx.actRealizada = deCategoria('REVIEW')[1].id;
  await pool.query(`UPDATE sqa_activities SET evidence_url = 'https://repo/ronda-1' WHERE id = $1`, [ctx.actPruebas]);
  await pool.query(`UPDATE sqa_activities SET status = 'DONE', execution_date = CURRENT_DATE WHERE id = $1`, [ctx.actRealizada]);

  // CU-03 por API: tres defectos pendientes (densidad 3/KLOC) y uno ya cerrado.
  const fases = ['ANALISIS_REQUERIMIENTOS', 'DISENO_COMPONENTES', 'CONSTRUCCION_SOFTWARE', 'INTEGRACION_Y_PRUEBAS'];
  const ids = [];
  for (const [i, fase] of fases.entries()) {
    const r = await http('POST', `/proyectos/${ctx.proyectoId}/defectos`, {
      reportadoPorId: ctx.qa,
      asignadoAId: ctx.tecnico,
      severidad: 'MEDIA',
      prioridad: 'ALTA',
      faseDeteccion: 'INTEGRACION_Y_PRUEBAS',
      faseOrigen: fase,
      descripcionDetallada: `Defecto de prueba ${i + 1} del cierre`,
      confirmarIncidenciaDistinta: true,
    });
    assert.strictEqual(r.status, 201, `CU-03 respondió ${r.status}: ${JSON.stringify(r.body)}`);
    ids.push(r.body.defectoRegistrado.id);
  }
  [ctx.defDescartar, ctx.defCerrar, ctx.defArrastrar, ctx.defYaCerrado] = ids;
  await pool.query(`UPDATE defects SET status = 'CERRADO' WHERE id = $1`, [ctx.defYaCerrado]);

  // CU-06: una alerta pospuesta (ACTIVA) y otra EN_PROCESO con su acción correctiva abierta.
  const alerta = (estado) => q(
    `INSERT INTO quality_alerts (project_id, metric_type, initial_value, current_value, severity_status, message, status)
     VALUES ($1, 'COBERTURA_PRUEBAS', 60, 55, 'AMARILLO_ADVERTENCIA', $2, $3) RETURNING id`,
    [ctx.proyectoId, `Alerta de prueba ${estado}`, estado],
  );
  ctx.alertaActiva = (await alerta('ACTIVA'))[0].id;
  ctx.alertaEnProceso = (await alerta('EN_PROCESO'))[0].id;
  ctx.accion = (await q(
    `INSERT INTO corrective_actions (alert_id, project_id, metric_type, description, cause_addressed, assigned_to, commitment_date)
     VALUES ($1, $2, 'COBERTURA_PRUEBAS', 'Ampliar casos de prueba', 'Pruebas fallidas', $3, CURRENT_DATE + 7) RETURNING id`,
    [ctx.alertaEnProceso, ctx.proyectoId, ctx.qa],
  ))[0].id;
}

async function main() {
  await preparar();
  const base = `/proyectos/${ctx.proyectoId}/cierre`;

  await prueba('CU8-INT-01', async () => {
    const r = await http('GET', `${base}/pendientes`);
    assert.strictEqual(r.status, 200);
    ctx.pendientes = r.body;
    const ids = new Set(r.body.map((p) => p.registroId));
    const esperados = await q(
      `SELECT id FROM sqa_activities WHERE project_id = $1 AND status IN ('PLANNED','IN_PROGRESS','PLANIFICADA','EN_CURSO')
       UNION ALL SELECT d.id FROM defects d JOIN evaluation_cutoffs c ON c.id = d.cutoff_id
                  WHERE c.project_id = $1 AND d.status NOT IN ('CERRADO','DESCARTADO')
       UNION ALL SELECT id FROM corrective_actions WHERE project_id = $1 AND status = 'abierta'
       UNION ALL SELECT id FROM quality_alerts WHERE project_id = $1 AND status = 'ACTIVA'`,
      [ctx.proyectoId],
    );
    assert.strictEqual(r.body.length, esperados.length);
    for (const e of esperados) assert.ok(ids.has(e.id), `falta el pendiente ${e.id}`);
    for (const fuera of [ctx.actRealizada, ctx.defYaCerrado, ctx.alertaEnProceso]) assert.ok(!ids.has(fuera));
    assert.ok(ids.has(ctx.alertaActiva) && ids.has(ctx.accion));
    assert.strictEqual(r.body.find((p) => p.registroId === ctx.actPruebas).evidencia, 'https://repo/ronda-1');
    const porTipo = r.body.reduce((acc, p) => ({ ...acc, [p.tipo]: (acc[p.tipo] ?? 0) + 1 }), {});
    return `Respondió 200 con ${r.body.length} pendientes (${Object.entries(porTipo).map(([t, n]) => `${n} ${t}`).join(', ')}); `
      + 'no aparecen la actividad realizada, el defecto CERRADO ni la alerta EN_PROCESO.';
  });

  await prueba('CU8-INT-02', async () => {
    const antes = await fotografia();
    const r = await http('POST', `${base}/validacion`, { resoluciones: [], retrospectiva: { queFuncionoBien: 'algo' } });
    assert.strictEqual(r.status, 400);
    const campos = r.body.errores.map((e) => e.campo);
    assert.strictEqual(campos.filter((c) => c.startsWith('resoluciones.')).length, ctx.pendientes.length);
    assert.deepStrictEqual(campos.filter((c) => c.startsWith('retrospectiva.')).sort(),
      ['retrospectiva.acuerdos', 'retrospectiva.leccionesAprendidas', 'retrospectiva.queDebeMejorar']);
    assert.strictEqual(await fotografia(), antes);
    return `Respondió 400 (FA-05.01) con ${ctx.pendientes.length} pendientes sin resolver y 3 campos de la retrospectiva vacíos; no cambió nada en la BD.`;
  });

  await prueba('CU8-INT-03', async () => {
    const r = await http('POST', `${base}/validacion`, {
      resoluciones: resolver(ctx.pendientes, {
        [ctx.actAuditoria]: { opcion: 'CERRAR', justificacion: 'Se hizo' },
        [ctx.actRevision]: { opcion: 'CERRAR', justificacion: 'Se hizo' },
        [ctx.defDescartar]: { opcion: 'CANCELAR', justificacion: '   ' },
      }),
      retrospectiva: RETRO,
    });
    assert.strictEqual(r.status, 400);
    const msg = Object.fromEntries(r.body.errores.map((e) => [e.campo, e.mensaje]));
    assert.match(msg[`resoluciones.${ctx.actAuditoria}`], /evidencia/);
    assert.match(msg[`resoluciones.${ctx.actRevision}`], /revisión por pares solo puede arrastrarse o cancelarse/);
    assert.match(msg[`resoluciones.${ctx.defDescartar}`], /justificación/);
    assert.strictEqual(r.body.errores.length, 3);
    return 'Respondió 400 con 3 errores: auditoría cerrada sin evidencia, revisión por pares cerrada y cancelación sin justificación.';
  });

  ctx.solicitud = {
    resoluciones: resolver(ctx.pendientes, {
      [ctx.actPruebas]: { opcion: 'CERRAR', justificacion: 'Ronda 1 ejecutada y registrada.' },
      [ctx.actRevision]: { opcion: 'CANCELAR', justificacion: 'El artefacto se eliminó del alcance.' },
      [ctx.defDescartar]: { opcion: 'CANCELAR', justificacion: 'No es un defecto: comportamiento esperado.' },
      [ctx.defCerrar]: { opcion: 'CERRAR', justificacion: 'Corregido en el commit a1b2c3.' },
      [ctx.accion]: { opcion: 'CANCELAR', justificacion: 'La causa ya no aplica.' },
      [ctx.alertaActiva]: { opcion: 'CANCELAR', justificacion: 'Falso positivo de la medición.' },
    }),
    retrospectiva: RETRO,
  };

  await prueba('CU8-INT-04', async () => {
    const antes = await fotografia();
    const r = await http('POST', `${base}/validacion`, ctx.solicitud);
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.valoresFinales.length, 4);
    assert.strictEqual(r.body.resoluciones.length, ctx.pendientes.length);
    const dens = r.body.valoresFinales.find((m) => m.tipoMetrica === 'DENSIDAD_DEFECTOS');
    assert.strictEqual(dens.valorFinal, 3); // 4 defectos registrados, 1 descartado, KLOC = 1
    assert.strictEqual(await fotografia(), antes);
    ctx.resumen = r.body;
    const vf = r.body.valoresFinales.map((m) => `${m.tipoMetrica}=${m.valorFinal ?? 'null'} ${m.estadoSemaforo}`).join(', ');
    return `Respondió 200 con el resumen (${vf}); la simulación hizo ROLLBACK y la BD quedó igual.`;
  });

  await prueba('CU8-INT-05', async () => {
    const antes = await fotografia();
    const r = await http('POST', base, ctx.solicitud);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.errores[0].campo, 'cerradoPor');
    assert.strictEqual(await fotografia(), antes);
    return 'Sin miembro que cierra respondió 400 (campo cerradoPor) y no se guardó nada.';
  });

  await prueba('CU8-INT-06', () => conFallaEn('sqa_logbooks', async () => {
    const antes = await fotografia();
    const r = await http('POST', base, { ...ctx.solicitud, cerradoPor: ctx.gestion });
    assert.strictEqual(r.status, 500);
    assert.strictEqual(await fotografia(), antes);
    return `FE-01: respondió 500 con "${r.body.mensaje}"; tras el ROLLBACK el periodo sigue ABIERTO, sin cambios en los pendientes, sin mediciones ni cortes nuevos y sin cierre guardado.`;
  }));

  await prueba('CU8-INT-07', async () => {
    const cortesAntes = await contar('evaluation_cutoffs', 'WHERE project_id = $1', [ctx.proyectoId]);
    const r = await http('POST', base, { ...ctx.solicitud, cerradoPor: ctx.gestion });
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    ctx.cierreId = r.body.cierreId;
    const [cierre] = await q('SELECT * FROM period_closures WHERE id = $1', [ctx.cierreId]);
    assert.strictEqual(cierre.closed_by, ctx.gestion);
    assert.strictEqual((await q('SELECT status FROM academic_periods WHERE id = $1', [ctx.periodoId]))[0].status, 'CERRADO');
    const estado = async (tabla, id) => (await q(`SELECT status FROM ${tabla} WHERE id = $1`, [id]))[0].status;
    assert.strictEqual(await estado('sqa_activities', ctx.actPruebas), 'DONE');
    assert.strictEqual(await estado('sqa_activities', ctx.actRevision), 'CANCELADA');
    assert.strictEqual(await estado('sqa_activities', ctx.actAuditoria), 'PLANNED'); // arrastrada: sin cambios
    assert.strictEqual(await estado('defects', ctx.defDescartar), 'DESCARTADO');
    assert.strictEqual(await estado('defects', ctx.defCerrar), 'CERRADO');
    assert.strictEqual(await estado('defects', ctx.defArrastrar), 'ASIGNADO');
    assert.strictEqual(await estado('corrective_actions', ctx.accion), 'cancelada');
    assert.strictEqual(await estado('quality_alerts', ctx.alertaActiva), 'DESCARTADA');
    const notas = (await q('SELECT resolution_notes FROM defects WHERE id = $1', [ctx.defDescartar]))[0].resolution_notes;
    assert.match(notas, /comportamiento esperado/);
    const res = await q('SELECT resolution, origin_period_id FROM pending_resolutions WHERE closure_id = $1', [ctx.cierreId]);
    assert.strictEqual(res.length, ctx.pendientes.length);
    assert.ok(res.every((x) => x.origin_period_id === ctx.periodoId));
    const arrastres = res.filter((x) => x.resolution === 'ARRASTRAR').length;
    assert.strictEqual(await contar('retrospectives', 'WHERE closure_id = $1', [ctx.cierreId]), 1);
    assert.strictEqual(await contar('frozen_metrics', 'WHERE closure_id = $1', [ctx.cierreId]), 4);
    assert.strictEqual(await contar('sqa_logbooks', 'WHERE closure_id = $1', [ctx.cierreId]), 1);
    const [corte] = await q('SELECT cutoff_number, cutoff_name, notes FROM evaluation_cutoffs WHERE id = $1', [cierre.report_cutoff_id]);
    assert.strictEqual(corte.cutoff_number, cortesAntes + 1);
    assert.match(corte.notes, /Acuerdos del equipo/);
    return `Respondió 201; el periodo quedó CERRADO y se aplicaron las resoluciones (actividad de pruebas DONE, revisión CANCELADA, `
      + `defectos DESCARTADO y CERRADO, acción cancelada, alerta DESCARTADA); se guardaron ${res.length} resoluciones (${arrastres} arrastres `
      + `con periodo de origen), la retrospectiva, 4 métricas congeladas, la bitácora y el reporte final como corte "${corte.cutoff_name}".`;
  });

  await prueba('CU8-INT-08', async () => {
    const fm = Object.fromEntries((await q('SELECT metric_type, final_value, health_status FROM frozen_metrics WHERE closure_id = $1', [ctx.cierreId]))
      .map((m) => [m.metric_type, m]));
    assert.strictEqual(Number(fm.DENSIDAD_DEFECTOS.final_value), 3);
    const [{ exigibles, realizadas }] = await q(
      `SELECT count(*) FILTER (WHERE status <> 'CANCELADA')::int AS exigibles,
              count(*) FILTER (WHERE status IN ('DONE','REALIZADA'))::int AS realizadas
         FROM sqa_activities WHERE project_id = $1`, [ctx.proyectoId]);
    assert.strictEqual(Number(fm.CUMPLIMIENTO_SQA.final_value), Math.round((realizadas / exigibles) * 10000) / 100);
    for (const t of ['COBERTURA_PRUEBAS', 'TASA_EXITO_PRUEBAS']) {
      assert.strictEqual(fm[t].final_value, null);
      assert.strictEqual(fm[t].health_status, 'SIN_DATOS');
    }
    const [c] = await q('SELECT health_index, index_legend FROM period_closures WHERE id = $1', [ctx.cierreId]);
    assert.strictEqual(c.health_index, null);
    assert.strictEqual(c.index_legend, 'Insuficiente');
    return `Densidad congelada en 3 (el descartado deja de contar), cumplimiento en ${fm.CUMPLIMIENTO_SQA.final_value}% `
      + `(${realizadas} de ${exigibles} exigibles, sin la cancelada); FA-07.01: cobertura y tasa de éxito sin mediciones quedaron `
      + 'en null / SIN_DATOS y el índice quedó "Insuficiente".';
  });

  await prueba('CU8-INT-09', async () => {
    const rep = await http('GET', `/cierres/${ctx.cierreId}/reporte.pdf`);
    const bit = await http('GET', `/cierres/${ctx.cierreId}/bitacora.pdf`);
    for (const d of [rep, bit]) {
      assert.strictEqual(d.status, 200);
      assert.strictEqual(d.tipo, 'application/pdf');
      assert.strictEqual(d.bytes.subarray(0, 4).toString(), '%PDF');
    }
    if (process.env.PDF_DIR) {
      fs.writeFileSync(`${process.env.PDF_DIR}/reporte_final.pdf`, rep.bytes);
      fs.writeFileSync(`${process.env.PDF_DIR}/bitacora.pdf`, bit.bytes);
    }
    const otro = await http('GET', '/cierres/00000000-0000-0000-0000-000000000000/reporte.pdf');
    assert.strictEqual(otro.status, 404);
    return `Se descargaron el reporte final (${rep.bytes.length} bytes) y la bitácora (${bit.bytes.length} bytes) como PDF; un cierre inexistente responde 404.`;
  });

  await prueba('CU8-INT-10', async () => {
    const r = await http('POST', base, { ...ctx.solicitud, cerradoPor: ctx.gestion });
    assert.strictEqual(r.status, 409);
    const p = await http('GET', `${base}/pendientes`);
    assert.strictEqual(p.status, 409);
    assert.strictEqual(await contar('period_closures', 'WHERE period_id = $1', [ctx.periodoId]), 1);
    return `FE-02: un segundo cierre respondió 409 ("${r.body.mensaje}") y consultar pendientes también; sigue habiendo un solo cierre.`;
  });

  await prueba('CU8-INT-11', async () => {
    const r = await http('POST', `/proyectos/${ctx.proyectoId}/defectos`, {
      reportadoPorId: ctx.qa, asignadoAId: ctx.tecnico, severidad: 'BAJA', prioridad: 'BAJA',
      faseDeteccion: 'INTEGRACION_Y_PRUEBAS', faseOrigen: 'CONSTRUCCION_SOFTWARE',
      descripcionDetallada: 'Defecto después del cierre', confirmarIncidenciaDistinta: true,
    });
    assert.strictEqual(r.status, 409);
    const g = await http('GET', `/proyectos/${ctx.proyectoId}/defectos`);
    assert.strictEqual(g.status, 200);
    await assert.rejects(pool.query(`UPDATE frozen_metrics SET final_value = 0 WHERE closure_id = $1`, [ctx.cierreId]), /solo lectura/);
    return 'Postcondición: registrar un defecto con el periodo CERRADO respondió 409 (las consultas siguen en 200) y la BD rechaza modificar las métricas congeladas.';
  });
}

// Deja la base como estaba: periodo ABIERTO y sin el proyecto de prueba (el cierre se borra en cascada).
async function limpiar() {
  if (ctx.periodoId) await pool.query(`UPDATE academic_periods SET status = 'ABIERTO' WHERE id = $1`, [ctx.periodoId]);
  if (!ctx.proyectoId) return;
  const r = await http('DELETE', `/proyectos/${ctx.proyectoId}`);
  if (r.status !== 200) throw new Error(`No se pudo eliminar el proyecto de prueba (${r.status}: ${r.body?.mensaje ?? ''})`);
  ctx.proyectoId = null;
}

main()
  .catch((err) => {
    console.error('\n❌', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prueba('CU8-INT-12', async () => {
      await limpiar();
      const n = await Promise.all(['period_closures', 'pending_resolutions', 'frozen_metrics', 'sqa_logbooks', 'retrospectives', 'monitored_projects']
        .map((t) => contar(t)));
      assert.deepStrictEqual(n, [0, 0, 0, 0, 0, 0]);
      return 'Limpieza: el periodo se reabrió y el "Reiniciar" del CU-01 eliminó el proyecto con su cierre en cascada.';
    });
    if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(resultados, null, 2));
    const fallidas = resultados.filter((r) => !r.aprobada).length;
    console.log(`\n${resultados.length - fallidas}/${resultados.length} pruebas aprobadas`);
    if (fallidas) process.exitCode = 1;
    await pool.end();
  });
