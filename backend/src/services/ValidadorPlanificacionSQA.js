const { CategoriaActividad } = require('./entidades/actividadSQA');

function aFechaSoloDia(f) {
  const d = new Date(f);
  d.setHours(0, 0, 0, 0);
  return d;
}

function validarPlanificacion({
  dto = {},
  actividad = {},
  miembros = [],
  periodo = {},
  fechaHoy = new Date(),
}) {
  const errores = [];
  const idsMiembros = new Set(miembros.map((m) => String(m.id)));

  // 1. Responsable obligatorio y perteneciente al equipo
  const responsableId = dto.responsibleMemberId || dto.responsableId;
  if (!responsableId) {
    errores.push({ campo: 'responsibleMemberId', mensaje: 'El responsable de la actividad es obligatorio.' });
  } else if (!idsMiembros.has(String(responsableId))) {
    errores.push({ campo: 'responsibleMemberId', mensaje: 'El responsable debe ser un miembro registrado del equipo.' });
  }

  // 2. Artefacto obligatorio
  const artefacto = (dto.artifact || dto.artefacto || '').trim();
  if (!artefacto) {
    errores.push({ campo: 'artifact', mensaje: 'El artefacto a evaluar es obligatorio.' });
  }

  // 3. Fecha planificada
  const fechaPlan = dto.plannedDate || dto.fechaPlanificada;
  if (!fechaPlan) {
    errores.push({ campo: 'plannedDate', mensaje: 'La fecha planificada es obligatoria.' });
  } else {
    const dPlan = aFechaSoloDia(fechaPlan);
    if (Number.isNaN(dPlan.getTime())) {
      errores.push({ campo: 'plannedDate', mensaje: 'La fecha planificada no tiene un formato válido.' });
    } else {
      const dHoy = aFechaSoloDia(fechaHoy);
      if (dPlan < dHoy) {
        errores.push({ campo: 'plannedDate', mensaje: 'La fecha planificada no puede ser anterior a la fecha actual.' });
      }

      if (periodo && periodo.start_date && periodo.end_date) {
        const dInicioPeriodo = aFechaSoloDia(periodo.start_date);
        const dFinPeriodo = aFechaSoloDia(periodo.end_date);
        if (dPlan < dInicioPeriodo || dPlan > dFinPeriodo) {
          errores.push({
            campo: 'plannedDate',
            mensaje: `La fecha planificada debe encontrarse dentro del periodo académico activo (${periodo.start_date} al ${periodo.end_date}).`,
          });
        }
      }
    }
  }

  // 4. Reglas específicas para Revisión por Pares (REVIEW)
  const esReview = actividad.category === CategoriaActividad.REVIEW || actividad.category === 'REVIEW';
  if (esReview) {
    const autorId = dto.authorId || dto.autorId;
    if (!autorId) {
      errores.push({ campo: 'authorId', mensaje: 'El autor del artefacto es obligatorio en revisiones por pares.' });
    } else if (!idsMiembros.has(String(autorId))) {
      errores.push({ campo: 'authorId', mensaje: 'El autor debe ser un miembro registrado del equipo.' });
    }

    const revisores = Array.isArray(dto.reviewerIds || dto.revisoresIds)
      ? (dto.reviewerIds || dto.revisoresIds)
      : [];

    if (revisores.length === 0) {
      errores.push({ campo: 'reviewerIds', mensaje: 'Debe asignar al menos un revisor para la revisión por pares.' });
    } else {
      const revisoresValidos = revisores.filter((r) => idsMiembros.has(String(r)));
      if (revisoresValidos.length !== revisores.length) {
        errores.push({ campo: 'reviewerIds', mensaje: 'Todos los revisores deben pertenecer al equipo del proyecto.' });
      }

      // FA-03.01: Debe existir al menos un revisor distinto del autor
      const tieneRevisorDistinto = revisores.some((r) => String(r) !== String(autorId));
      if (!tieneRevisorDistinto) {
        errores.push({
          campo: 'reviewerIds',
          mensaje: 'La revisión por pares debe contar con al menos un revisor distinto del autor.',
        });
      }
    }
  }

  return {
    esValido: errores.length === 0,
    errores,
  };
}

module.exports = {
  validarPlanificacion,
};
