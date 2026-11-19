const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (res.ok || [400, 404, 409, 422].includes(res.status)) {
    return { status: res.status, data: body };
  }
  throw new Error(body?.mensaje || `Error de comunicación (${res.status})`);
}

export const obtenerContextoActividades = (proyectoId) =>
  request(`/proyectos/${proyectoId}/actividades-sqa`);

export const planificarActividad = (proyectoId, actividadId, dto) =>
  request(`/proyectos/${proyectoId}/actividades-sqa/${actividadId}/planificar`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });

export const obtenerChecklist = (proyectoId, actividadId) =>
  request(`/proyectos/${proyectoId}/actividades-sqa/${actividadId}/checklist`);

export const buscarDuplicados = (proyectoId, actividadId, hallazgos) =>
  request(`/proyectos/${proyectoId}/actividades-sqa/${actividadId}/buscar-duplicados`, {
    method: 'POST',
    body: JSON.stringify({ hallazgos }),
  });

export const cerrarRevision = (proyectoId, actividadId, dto) =>
  request(`/proyectos/${proyectoId}/actividades-sqa/${actividadId}/cerrar-revision`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });

export const cerrarEvidencia = (proyectoId, actividadId, dto) =>
  request(`/proyectos/${proyectoId}/actividades-sqa/${actividadId}/cerrar-evidencia`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
