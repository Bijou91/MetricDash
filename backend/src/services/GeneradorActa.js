const { ActaRevision } = require('./entidades/actividadSqa');

// FN-08b: Emite el acta formal de la revisión por pares con su dictamen, síntesis de hallazgos y folios de defectos asociados.
function emitirActa(revision, defectos = [], foliosReferenciados = []) {
  const totalItems = Array.isArray(revision.resultados) ? revision.resultados.length : 0;
  const hallazgos = revision.obtenerHallazgos ? revision.obtenerHallazgos() : [];
  const itemsNoCumple = hallazgos.length;
  const itemsCumple = totalItems - itemsNoCumple;

  const foliosNuevos = defectos.map((d) => d.folio).filter(Boolean);
  const todosFolios = [...new Set([...foliosNuevos, ...foliosReferenciados.filter(Boolean)])];
  const defectosIds = defectos.map((d) => d.id).filter(Boolean);

  let resumenHallazgos;
  if (itemsNoCumple === 0) {
    resumenHallazgos = `Revisión por pares completada satisfactoriamente (${itemsCumple}/${totalItems} criterios cumplidos). Sin hallazgos ni defectos detectados.`;
  } else {
    const detalle = hallazgos
      .map((h, i) => `${i + 1}) [${h.severidad}/${h.prioridad}] ${h.observacion}`)
      .join(' | ');
    const refFolios = todosFolios.length > 0 ? ` Folios de defectos vinculados: ${todosFolios.join(', ')}.` : '';
    resumenHallazgos = `Se identificaron ${itemsNoCumple} hallazgo(s) de ${totalItems} criterios evaluados.${refFolios} Detalle: ${detalle}`;
  }

  return new ActaRevision({
    actividadId: revision.actividadId,
    revisionId: revision.id,
    fechaEmision: revision.fechaRevision || new Date(),
    dictamen: revision.dictamen,
    resumenHallazgos,
    foliosDefectos: todosFolios,
    defectosIds,
    minutesUrl: `acta://peer-review/${revision.actividadId}`,
    totalItems,
    itemsCumple,
    itemsNoCumple,
  });
}

module.exports = { emitirActa };

