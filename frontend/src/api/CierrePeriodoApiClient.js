const RAW_URL = import.meta.env.VITE_API_URL;
const API_URL = RAW_URL ? RAW_URL.replace(/\/+$/, '') : '';

// 400 (FA-05.01), 404 y 409 (FE-02 / periodo cerrado) traen { mensaje, errores }; se devuelven con su status.
async function request(path, options) {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (res.ok || [400, 404, 409].includes(res.status)) return { status: res.status, data: body };
  throw new Error(body?.mensaje || `Error ${res.status}`);
}

export const obtenerPendientes = (proyectoId) => request(`/proyectos/${proyectoId}/cierre/pendientes`);

export const validarCierre = (proyectoId, dto) =>
  request(`/proyectos/${proyectoId}/cierre/validacion`, { method: 'POST', body: JSON.stringify(dto) });

export const confirmarCierre = (proyectoId, dto) =>
  request(`/proyectos/${proyectoId}/cierre`, { method: 'POST', body: JSON.stringify(dto) });

// FN-09: descarga el PDF con el nombre que envía el servidor.
async function descargar(path) {
  const res = await fetch(`${API_URL}/api${path}`);
  if (!res.ok) throw new Error(`No se pudo descargar el documento (Error ${res.status}).`);
  const nombre = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'documento.pdf';
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  a.click();
  URL.revokeObjectURL(url);
}

export const descargarReporteFinal = (cierreId) => descargar(`/cierres/${cierreId}/reporte.pdf`);
export const descargarBitacora = (cierreId) => descargar(`/cierres/${cierreId}/bitacora.pdf`);
