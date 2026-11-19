// Rutas relativas (/api/...): en desarrollo las atiende el proxy de Vite, lo que también funciona
// detrás de un túnel público. VITE_API_URL es opcional y solo se usa si se define explícitamente.
const RAW_URL = import.meta.env.VITE_API_URL;
const API_URL = RAW_URL ? RAW_URL.replace(/\/+$/, '') : '';

async function leerError(res, mensajePorDefecto) {
  const errorData = await res.json().catch(() => ({}));
  return new Error(errorData.error || mensajePorDefecto);
}

class TableroSaludApiClient {
  async listarProyectos() {
    const res = await fetch(`${API_URL}/api/proyectos`);
    if (!res.ok) throw new Error(`Error ${res.status}: Fallo al listar proyectos`);
    return res.json();
  }

  // Estado consolidado del tablero
  async obtenerTableroActual(proyectoId) {
    const res = await fetch(`${API_URL}/api/proyectos/${proyectoId}/tablero-salud`);
    if (!res.ok) throw await leerError(res, `Error ${res.status} al consultar el tablero`);
    return res.json();
  }

  // Previsualización del reporte
  async generarPrevisualizacion(proyectoId) {
    const res = await fetch(`${API_URL}/api/proyectos/${proyectoId}/reportes-salud/previsualizacion`);
    if (!res.ok) throw await leerError(res, `Error ${res.status} al obtener la previsualización`);
    return res.json();
  }

  // Generar reporte versionado y PDF
  async generarReporteSalud(proyectoId, { notasEjecutivas }) {
    const res = await fetch(`${API_URL}/api/proyectos/${proyectoId}/reportes-salud`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notasEjecutivas: notasEjecutivas || '' })
    });
    if (!res.ok) throw await leerError(res, 'Error al generar o guardar el reporte de salud. Por favor, reintente.');
    return res.json();
  }

  async obtenerHistorialReportes(proyectoId) {
    const res = await fetch(`${API_URL}/api/proyectos/${proyectoId}/reportes-salud/historial`);
    if (!res.ok) throw new Error('Error al consultar el historial de reportes');
    return res.json();
  }

  // Descarga un reporte previo (el PDF se vuelve a compilar con el desglose guardado)
  async descargarPdfReporte(proyectoId, reporteId) {
    const res = await fetch(`${API_URL}/api/proyectos/${proyectoId}/reportes-salud/${reporteId}/pdf`);
    if (!res.ok) throw await leerError(res, 'No se pudo descargar el PDF del reporte.');
    return res.blob();
  }
}

export default new TableroSaludApiClient();
