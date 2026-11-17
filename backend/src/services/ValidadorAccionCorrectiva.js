const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function obtenerFechaHoyString() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function validar(dto = {}, miembros = []) {
  const errores = [];
  const idsMiembros = new Set((miembros || []).map((m) => m.id));

  // 1. Descripción
  const descripcion = dto.descripcion != null ? String(dto.descripcion).trim() : '';
  if (!descripcion) {
    errores.push({
      campo: 'descripcion',
      mensaje: 'La descripción de la acción correctiva es obligatoria.',
    });
  }

  // 2. Causa atendida
  const causa = (dto.causaAtendida != null ? String(dto.causaAtendida) : (dto.causa != null ? String(dto.causa) : '')).trim();
  if (!causa) {
    errores.push({
      campo: 'causaAtendida',
      mensaje: 'Debe especificar la causa que atiende la acción correctiva.',
    });
  }

  // 3. Responsable
  if (!dto.responsableId || !UUID_REGEX.test(dto.responsableId)) {
    errores.push({
      campo: 'responsableId',
      mensaje: 'Debe seleccionar un responsable válido del equipo.',
    });
  } else if (idsMiembros.size > 0 && !idsMiembros.has(dto.responsableId)) {
    errores.push({
      campo: 'responsableId',
      mensaje: 'El responsable seleccionado no pertenece al equipo del proyecto.',
    });
  }

  // 4. Fecha de compromiso (no anterior a la fecha actual)
  const fechaStr = dto.fechaCompromiso ? String(dto.fechaCompromiso).split('T')[0] : '';
  if (!fechaStr || !FECHA_REGEX.test(fechaStr)) {
    errores.push({
      campo: 'fechaCompromiso',
      mensaje: 'La fecha de compromiso es obligatoria y debe tener formato YYYY-MM-DD.',
    });
  } else {
    const hoyStr = obtenerFechaHoyString();
    if (fechaStr < hoyStr) {
      errores.push({
        campo: 'fechaCompromiso',
        mensaje: `La fecha de compromiso (${fechaStr}) no puede ser anterior a la fecha actual (${hoyStr}).`,
      });
    }
  }

  return {
    esValido: errores.length === 0,
    errores,
  };
}

module.exports = {
  validar,
  obtenerFechaHoyString,
};

