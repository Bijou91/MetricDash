const { OrigenDecision } = require('./entidades/cierrePeriodo');

// FN-08: una decisión por cada resolución (también los arrastres) y una con los acuerdos de la retrospectiva.
function construirDecisiones(resoluciones, retrospectiva) {
  return [
    ...resoluciones.map((r) => ({
      origen: OrigenDecision.RESOLUCION_PENDIENTE,
      descripcion: `${r.opcion} ${r.tipo}: ${r.descripcion ?? r.registroId}`,
      justificacion: r.justificacion,
    })),
    { origen: OrigenDecision.RETROSPECTIVA, descripcion: retrospectiva.acuerdos, justificacion: null },
  ];
}

// FN-08: bitácora del periodo con actividades, evidencias, defectos, acciones correctivas y decisiones.
function compilar(cierre, registros) {
  const evidencias = [
    ...registros.actividades.filter((a) => a.evidenciaRef).map((a) => `${a.nombre}: ${a.evidenciaRef}`),
    ...registros.actas.map((a) => `Acta de revisión ${a.dictamen ?? ''} (actividad ${a.actividadId})${a.minutesUrl ? `: ${a.minutesUrl}` : ''}`),
    ...registros.rondasPruebas.map((r) => `Ronda de pruebas ${r.version} (${r.nombreCorte}): cobertura ${r.coberturaPruebas}%, éxito ${r.tasaExitoPruebas}%`),
  ];
  return {
    actividades: registros.actividades,
    evidencias,
    defectos: registros.defectos,
    accionesCorrectivas: registros.accionesCorrectivas,
    decisiones: construirDecisiones(cierre.resoluciones, cierre.retrospectiva),
  };
}

module.exports = { compilar, construirDecisiones };
