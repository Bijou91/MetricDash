const { DictamenRevision } = require('./entidades/actividadSQA');
const { SeveridadDefecto, PrioridadDefecto } = require('./entidades/defecto');

function validarCierreRevision(dto = {}) {
  const errores = [];

  // 1. Dictamen obligatorio
  const dictamen = dto.verdict || dto.dictamen;
  if (!dictamen || !Object.values(DictamenRevision).includes(String(dictamen).toUpperCase())) {
    errores.push({
      campo: 'verdict',
      mensaje: `El dictamen de la revisión es obligatorio y debe ser uno de: ${Object.values(DictamenRevision).join(', ')}.`,
    });
  }

  // 2. Resumen de hallazgos
  const resumen = (dto.findingsSummary || dto.resumenHallazgos || '').trim();
  if (!resumen) {
    errores.push({
      campo: 'findingsSummary',
      mensaje: 'El resumen del acta de revisión es obligatorio.',
    });
  }

  // 3. FA-05.01: Verificación de hallazgos ítem por ítem
  const hallazgos = Array.isArray(dto.checklistResults || dto.hallazgos)
    ? (dto.checklistResults || dto.hallazgos)
    : [];

  const erroresHallazgos = [];
  hallazgos.forEach((h, index) => {
    if (h.cumple === false || h.cumple === 'false') {
      const faltantes = [];
      if (!h.observacion || !String(h.observacion).trim()) {
        faltantes.push('observacion');
      }
      if (!h.severidad || !Object.values(SeveridadDefecto).includes(h.severidad)) {
        faltantes.push('severidad');
      }
      if (!h.prioridad || !Object.values(PrioridadDefecto).includes(h.prioridad)) {
        faltantes.push('prioridad');
      }

      if (faltantes.length > 0) {
        erroresHallazgos.push({
          itemId: h.itemId || `item-${index + 1}`,
          faltantes,
          mensaje: `El ítem '${h.itemId || index + 1}' marcado como 'no cumple' requiere observación descriptiva, severidad y prioridad.`,
        });
      }
    }
  });

  if (erroresHallazgos.length > 0) {
    errores.push({
      campo: 'checklistResults',
      detalles: erroresHallazgos,
      mensaje: 'Existen hallazgos incompletos que impiden cerrar la actividad.',
    });
  }

  return {
    esValido: errores.length === 0,
    errores,
  };
}

function validarCierreEvidencia(categoria, dto = {}) {
  const errores = [];
  const cat = String(categoria).toUpperCase();

  if (cat === 'TEST') {
    const rondaId = dto.testSuiteId || dto.rondaPruebasId || dto.evidenceUrl;
    if (!rondaId || !String(rondaId).trim()) {
      errores.push({
        campo: 'testSuiteId',
        mensaje: 'Debe seleccionar o vincular una ronda de pruebas registrada para cerrar la actividad.',
      });
    }
  } else if (cat === 'AUDIT') {
    const url = (dto.evidenceUrl || dto.enlaceEntregable || '').trim();
    if (!url) {
      errores.push({
        campo: 'evidenceUrl',
        mensaje: 'Debe ingresar el enlace al entregable o bitácora de la auditoría.',
      });
    }
  }

  return {
    esValido: errores.length === 0,
    errores,
  };
}

module.exports = {
  validarCierreRevision,
  validarCierreEvidencia,
};
