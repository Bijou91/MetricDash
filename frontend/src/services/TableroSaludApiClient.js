class TableroSaludApiClient {
  constructor(baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  async listarProyectos() {
    const res = await fetch(`${this.baseUrl}/api/proyectos`);
    if (!res.ok) throw new Error(`Error ${res.status}: Fallo al listar proyectos`);
    return res.json();
  }

  // FN-01 & FN-02: Obtener estado consolidado del tablero
  async obtenerTableroActual(proyectoId) {
    const res = await fetch(`${this.baseUrl}/api/proyectos/${proyectoId}/tablero-salud`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Error ${res.status} al consultar tablero`);
    }
    return res.json();
  }

  // FN-03, FN-04, FA-04.01, FN-05: Solicitar previsualización
  async generarPrevisualizacion(proyectoId) {
    const res = await fetch(`${this.baseUrl}/api/proyectos/${proyectoId}/reportes-salud/previsualizacion`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Error ${res.status} al obtener previsualización`);
    }
    return res.json();
  }

  // FN-06, FA-06.01, FN-07, FE-01: Generar reporte versionado y PDF
  async generarReporteSalud(proyectoId, { notasEjecutivas }) {
    const res = await fetch(`${this.baseUrl}/api/proyectos/${proyectoId}/reportes-salud`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notasEjecutivas: notasEjecutivas || ''
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al generar o guardar el reporte de salud. Por favor, reintente.');
    }
    return res.json();
  }

  async obtenerHistorialReportes(proyectoId) {
    const res = await fetch(`${this.baseUrl}/api/proyectos/${proyectoId}/reportes-salud/historial`);
    if (!res.ok) throw new Error('Error al consultar historial de reportes');
    return res.json();
  }
}

export default new TableroSaludApiClient();
