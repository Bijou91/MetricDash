const { ErrorValidacion } = require('./entidades/proyecto');
const { ResolucionPendiente, Retrospectiva, CAMPOS_RETROSPECTIVA } = require('./entidades/cierrePeriodo');
const { TipoActividad } = require('./entidades/actividadSqa');

// FN-05 / FA-05.01. Los campos "resoluciones.<registroId>" regresan a FN-03; los "retrospectiva.<campo>" a FN-04.
function validar(dto, pendientes) {
  return [
    ...validarResoluciones(dto?.resoluciones, pendientes),
    ...validarRetrospectiva(dto?.retrospectiva),
  ];
}

function validarResoluciones(resoluciones, pendientes) {
  const lista = Array.isArray(resoluciones) ? resoluciones : [];
  const porId = new Map(pendientes.map((p) => [p.registroId, p]));
  const errores = [];
  const vistos = new Set();

  for (const r of lista) {
    const campo = `resoluciones.${r?.registroId}`;
    const pendiente = porId.get(r?.registroId);
    if (!pendiente) {
      errores.push(new ErrorValidacion(campo, 'La resolución no corresponde a un pendiente vigente del periodo.'));
      continue;
    }
    if (vistos.has(r.registroId)) {
      errores.push(new ErrorValidacion(campo, 'El pendiente tiene más de una resolución.'));
      continue;
    }
    vistos.add(r.registroId);

    const resolucion = new ResolucionPendiente({ ...r, tipo: pendiente.tipo });
    if (!pendiente.opcionesPermitidas().includes(resolucion.opcion)) {
      let mensaje = 'La opción elegida no está permitida para este pendiente.';
      if (resolucion.requiereEvidencia()) {
        mensaje = pendiente.tipoActividad === TipoActividad.REVISION_PARES
          ? 'Una revisión por pares solo puede arrastrarse o cancelarse: se completa con el checklist y el acta del CU-04.'
          : 'Solo se puede cerrar una actividad de pruebas o auditoría con evidencia registrada.';
      }
      errores.push(new ErrorValidacion(campo, mensaje));
    } else if (resolucion.requiereJustificacion() && !resolucion.justificacion) {
      errores.push(new ErrorValidacion(campo, 'Cancelar o cerrar requiere una justificación.'));
    }
  }

  for (const p of pendientes) {
    if (!vistos.has(p.registroId)) {
      errores.push(new ErrorValidacion(`resoluciones.${p.registroId}`, 'El pendiente no está resuelto.'));
    }
  }
  return errores;
}

function validarRetrospectiva(datos) {
  return new Retrospectiva(datos).camposFaltantes().map((c) =>
    new ErrorValidacion(`retrospectiva.${c}`, `El campo "${CAMPOS_RETROSPECTIVA[c]}" es obligatorio.`));
}

module.exports = { validar, validarResoluciones, validarRetrospectiva };
