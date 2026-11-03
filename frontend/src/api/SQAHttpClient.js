const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// 400 (campos faltantes), 404 (sin proyecto), 409 (sin umbrales) y 422 (inconsistencia numérica) traen body útil; 500 lanza.
async function request(path, options) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (res.ok || [400, 404, 409, 422].includes(res.status)) {
    return { status: res.status, data: body };
  }
  throw new Error(body?.mensaje || `Error ${res.status}`);
}

export const obtenerCortes = (proyectoId) => request(`/proyectos/${proyectoId}/cortes`);

export const postRegistroPruebas = (proyectoId, dto) =>
  request(`/proyectos/${proyectoId}/pruebas`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });

