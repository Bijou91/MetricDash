const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => null);
  // Si devuelve 400 (FA-02.02 datos incompletos) o 409 (FA-02.01 monoproyecto) se devuelve el body para manejo en UI
  if (res.ok || res.status === 400 || res.status === 409) return { status: res.status, ok: res.ok, data: body };
  if (res.status === 404) return { status: 404, ok: false, data: body };
  throw new Error(body?.mensaje || `Error ${res.status}`);
}

export const obtenerPeriodoActivo = async () => {
  const resp = await request('/periodos/activo');
  return resp.data;
};

export const obtenerProyectoPeriodoActivo = async () => {
  const resp = await request('/proyectos/activo');
  return resp.data;
};

export const registrarProyecto = async (datosProyecto) => {
  const resp = await request('/proyectos', {
    method: 'POST',
    body: JSON.stringify(datosProyecto),
  });
  return resp;
};

export default {
  obtenerPeriodoActivo,
  obtenerProyectoPeriodoActivo,
  registrarProyecto,
};
