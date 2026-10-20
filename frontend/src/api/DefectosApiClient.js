const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// 400 (campos faltantes), 404 (sin proyecto) y 409 (sin umbrales) traen un body que la vista muestra; 500 lanza.
async function request(path, options) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (res.ok || [400, 404, 409].includes(res.status)) return { status: res.status, data: body };
  throw new Error(body?.mensaje || `Error ${res.status}`);
}

export const obtenerTablero = (proyectoId) => request(`/proyectos/${proyectoId}/defectos`);

export const registrarDefecto = (proyectoId, dto) =>
  request(`/proyectos/${proyectoId}/defectos`, { method: 'POST', body: JSON.stringify(dto) });

export const descartarRegistro = (proyectoId) =>
  request(`/proyectos/${proyectoId}/defectos/descartar`, { method: 'POST' });

export const actualizarDefecto = (proyectoId, defectoId, dto) =>
  request(`/proyectos/${proyectoId}/defectos/${defectoId}`, { method: 'PUT', body: JSON.stringify(dto) });

export const actualizarEstadoDefecto = (proyectoId, defectoId, estado, notasResolucion = null) =>
  request(`/proyectos/${proyectoId}/defectos/${defectoId}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado, notasResolucion }),
  });
