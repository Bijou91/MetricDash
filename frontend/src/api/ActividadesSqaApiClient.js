const RAW_BASE = import.meta.env.VITE_API_URL;
const BASE = RAW_BASE ? (RAW_BASE.endsWith('/api') ? RAW_BASE : `${RAW_BASE.replace(/\/+$/, '')}/api`) : '/api';

async function request(ruta, opciones) {
  let res;
  try {
    res = await fetch(`${BASE}${ruta}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    });
  } catch {
    throw new Error('Error de almacenamiento o comunicación: no se pudo conectar con el servidor. Intente nuevamente.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status >= 500) {
    throw new Error(data.mensaje || 'Error interno de persistencia en la base de datos. Intente nuevamente.');
  }
  return { status: res.status, ok: res.ok, data };
}

// FN-01: Obtiene el plan base de actividades SQA del proyecto junto con miembros, periodo, rondas e indicadores.
export function obtenerPlan(proyectoId) {
  return request(`/proyectos/${proyectoId}/actividades-sqa`);
}

// FN-02 / FN-03: Planifica una actividad SQA (responsableId, fechaPlanificada, artefacto, autorId, revisoresIds).
export function planificar(proyectoId, dto) {
  return request(`/proyectos/${proyectoId}/actividades-sqa/planificar`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// FN-04: Inicia una actividad SQA y obtiene su plantilla de checklist (o rondas disponibles si es PRUEBAS).
export function iniciar(actividadId) {
  return request(`/actividades-sqa/${actividadId}/iniciar`, {
    method: 'POST',
  });
}

// FN-07 a FN-09: Cierra una revisión por pares con los resultados del checklist y el dictamen elegido.
export function cerrar(actividadId, dto) {
  return request(`/actividades-sqa/${actividadId}/cerrar`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// FA-04.01: Registra la evidencia de una actividad de PRUEBAS (ronda CU-05) o AUDITORIA (enlace al entregable).
export function registrarEvidencia(actividadId, dto) {
  return request(`/actividades-sqa/${actividadId}/evidencia`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// Consulta el acta emitida de una revisión por pares cerrada.
export function obtenerActa(actividadId) {
  return request(`/actividades-sqa/${actividadId}/acta`);
}

