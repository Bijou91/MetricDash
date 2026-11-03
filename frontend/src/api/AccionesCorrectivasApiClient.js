const RAW_URL = import.meta.env.VITE_API_URL;
const API_URL = RAW_URL ? RAW_URL.replace(/\/+$/, '') : '';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (res.ok || [400, 404, 409, 422].includes(res.status)) {
    return { status: res.status, ok: res.ok, data };
  }
  throw new Error(data?.mensaje || `Error en la petición HTTP: ${res.status}`);
}

export const obtenerAlertas = (proyectoId) =>
  request(`/proyectos/${proyectoId}/alertas`);

export const obtenerAlerta = (alertaId) =>
  request(`/alertas/${alertaId}`);

export const obtenerAccionesCorrectivas = (proyectoId) =>
  request(`/proyectos/${proyectoId}/acciones-correctivas`);

export const guardarAccionCorrectiva = (proyectoId, dto) =>
  request(`/proyectos/${proyectoId}/acciones-correctivas`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });

export const actualizarAccionCorrectiva = (accionId, dto) =>
  request(`/acciones-correctivas/${accionId}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });

export const registrarMedicion = (proyectoId, dto) =>
  request(`/proyectos/${proyectoId}/mediciones`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });

export const obtenerMiembros = async (proyectoId) => {
  const res = await request(`/proyectos/${proyectoId}/defectos`);
  return res.data?.miembros || [];
};

