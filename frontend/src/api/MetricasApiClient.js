const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// 400/422 traen un ResultadoValidacionDTO ({ valido: false, errores }); se devuelven en vez de lanzar.
async function request(path, options) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (res.ok || res.status === 400 || res.status === 422) return body;
  throw new Error(body?.mensaje || `Error ${res.status}`);
}

export const obtenerVigente = (proyectoId) => request(`/proyectos/${proyectoId}/metricas/vigente`);

export const validar = (proyectoId, dto) =>
  request(`/proyectos/${proyectoId}/metricas/validar`, { method: 'POST', body: JSON.stringify(dto) });

export const guardar = (proyectoId, dto) =>
  request(`/proyectos/${proyectoId}/metricas`, { method: 'POST', body: JSON.stringify(dto) });
