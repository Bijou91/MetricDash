const { SeveridadDefecto, PrioridadDefecto } = require('./entidades/defecto');
const {
  TipoActividad,
  DictamenRevision,
  ErrorValidacion,
  normalizarFechaISO,
} = require('./entidades/actividadSqa');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// FA-03.01: Valida campos obligatorios de planificación (responsableId, fechaPlanificada, artefacto).
function validarPlanificacion(dto = {}, miembros = []) {
  const errores = [];
  if (!dto || typeof dto !== 'object') {
    return [new ErrorValidacion('planificacion', 'Los datos de planificación son obligatorios.')];
  }

  if (!dto.responsableId || !UUID_REGEX.test(String(dto.responsableId))) {
    errores.push(new ErrorValidacion('responsableId', 'El responsable de la actividad es obligatorio.'));
  } else if (Array.isArray(miembros) && miembros.length > 0 && !miembros.some((m) => m.id === dto.responsableId)) {
    errores.push(new ErrorValidacion('responsableId', 'El responsable seleccionado no pertenece al equipo del proyecto.'));
  }

  const fechaIso = normalizarFechaISO(dto.fechaPlanificada);
  if (!fechaIso) {
    errores.push(new ErrorValidacion('fechaPlanificada', 'La fecha planificada es obligatoria y debe tener formato válido (YYYY-MM-DD).'));
  }

  if (typeof dto.artefacto !== 'string' || !dto.artefacto.trim()) {
    errores.push(new ErrorValidacion('artefacto', 'El nombre o identificador del artefacto a evaluar es obligatorio.'));
  }

  return errores;
}

// FA-03.01: Verifica que la fecha planificada no sea anterior a la fecha actual ni esté fuera del periodo académico activo.
function validarFechaEnPeriodo(fecha, periodo, fechaActual = new Date()) {
  const fechaIso = normalizarFechaISO(fecha);
  if (!fechaIso) {
    return new ErrorValidacion('fechaPlanificada', 'La fecha planificada no es válida.');
  }

  const hoyIso = normalizarFechaISO(fechaActual) || new Date().toISOString().slice(0, 10);
  if (fechaIso < hoyIso) {
    return new ErrorValidacion('fechaPlanificada', `La fecha planificada (${fechaIso}) no puede ser anterior a la fecha actual (${hoyIso}).`);
  }

  if (periodo) {
    const inicioIso = normalizarFechaISO(periodo.start_date || periodo.fechaInicio);
    const finIso = normalizarFechaISO(periodo.end_date || periodo.fechaFin);
    if (inicioIso && fechaIso < inicioIso) {
      return new ErrorValidacion('fechaPlanificada', `La fecha planificada (${fechaIso}) está antes del inicio del periodo académico activo (${inicioIso}).`);
    }
    if (finIso && fechaIso > finIso) {
      return new ErrorValidacion('fechaPlanificada', `La fecha planificada (${fechaIso}) excede el fin del periodo académico activo (${finIso}).`);
    }
  }

  return null;
}

// FA-03.01: Para revisiones por pares, exige autor y al menos un revisor distinto del autor.
function validarRevisores(autorId, revisoresIds, miembros = []) {
  if (!autorId || !UUID_REGEX.test(String(autorId))) {
    return new ErrorValidacion('autorId', 'El autor del artefacto es obligatorio para una revisión por pares.');
  }
  if (Array.isArray(miembros) && miembros.length > 0 && !miembros.some((m) => m.id === autorId)) {
    return new ErrorValidacion('autorId', 'El autor seleccionado no pertenece al equipo del proyecto.');
  }

  if (!Array.isArray(revisoresIds) || revisoresIds.length === 0) {
    return new ErrorValidacion('revisoresIds', 'Debe seleccionar al menos un revisor para la revisión por pares.');
  }

  const revisoresValidos = revisoresIds.filter((id) => id && UUID_REGEX.test(String(id)));
  if (revisoresValidos.length === 0) {
    return new ErrorValidacion('revisoresIds', 'Los identificadores de los revisores no son válidos.');
  }

  if (Array.isArray(miembros) && miembros.length > 0) {
    const idsEquipo = new Set(miembros.map((m) => m.id));
    if (revisoresValidos.some((id) => !idsEquipo.has(id))) {
      return new ErrorValidacion('revisoresIds', 'Todos los revisores deben pertenecer al equipo del proyecto.');
    }
  }

  const distintosDelAutor = revisoresValidos.filter((id) => id !== autorId);
  if (distintosDelAutor.length === 0) {
    return new ErrorValidacion('revisoresIds', 'La revisión por pares requiere al menos un revisor distinto del autor del artefacto.');
  }

  return null;
}

// Si un ítem se marca como "no cumple", exige observación no vacía, severidad y prioridad válidas.
function validarHallazgo(resultado = {}) {
  const errores = [];
  if (!resultado || resultado.cumple !== false) return errores;

  const ref = resultado.itemId ? `:${resultado.itemId}` : '';
  if (typeof resultado.observacion !== 'string' || !resultado.observacion.trim()) {
    errores.push(new ErrorValidacion(`observacion${ref}`, 'La descripción de la observación es obligatoria cuando el ítem no cumple.'));
  }
  if (!Object.values(SeveridadDefecto).includes(resultado.severidad)) {
    errores.push(new ErrorValidacion(`severidad${ref}`, 'Debe asignar una severidad válida al hallazgo (BAJA, MEDIA, ALTA o CRITICA).'));
  }
  if (!Object.values(PrioridadDefecto).includes(resultado.prioridad)) {
    errores.push(new ErrorValidacion(`prioridad${ref}`, 'Debe asignar una prioridad válida al hallazgo (BAJA, MEDIA, ALTA o INMEDIATA).'));
  }
  return errores;
}

function validarDictamen(dictamen) {
  if (!Object.values(DictamenRevision).includes(dictamen)) {
    return new ErrorValidacion('dictamen', 'Debe elegir un dictamen válido para el cierre de la revisión (APROBADO, APROBADO_CONDICIONADO o RECHAZADO).');
  }
  return null;
}

// En actividades de PRUEBAS exige seleccionar la ronda de resultados registrada;
// en actividades de AUDITORIA exige ingresar el enlace al entregable.
function validarEvidencia(tipo, dto = {}) {
  const errores = [];
  if (tipo === TipoActividad.PRUEBAS || tipo === 'TEST') {
    if (!dto.evidenciaRondaId || !UUID_REGEX.test(String(dto.evidenciaRondaId))) {
      errores.push(new ErrorValidacion('evidenciaRondaId', 'Debe seleccionar la ronda de resultados de pruebas registrada como evidencia.'));
    }
  } else {
    const enlace = typeof dto.evidenciaEnlace === 'string' ? dto.evidenciaEnlace.trim() : '';
    if (!enlace) {
      errores.push(new ErrorValidacion('evidenciaEnlace', 'Debe ingresar el enlace o referencia al entregable de auditoría como evidencia.'));
    }
  }
  return errores;
}

module.exports = {
  validarPlanificacion,
  validarFechaEnPeriodo,
  validarRevisores,
  validarHallazgo,
  validarDictamen,
  validarEvidencia,
};

