import React, { useState, useEffect } from 'react';
import TableroSaludApiClient from '../services/TableroSaludApiClient';
import SemaforoMetricasWidget from '../components/SemaforoMetricasWidget';
import PanelAlertasActivasWidget from '../components/PanelAlertasActivasWidget';
import PrevisualizacionReporteWidget from '../components/PrevisualizacionReporteWidget';

export default function VistaTableroReporteSalud() {
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionadoId, setProyectoSeleccionadoId] = useState('');
  const [tablero, setTablero] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  // Estados de Previsualización y Generación
  const [modoPrevisualizacion, setModoPrevisualizacion] = useState(false);
  const [previsualizacion, setPrevisualizacion] = useState(null);
  const [notasEjecutivas, setNotasEjecutivas] = useState('');
  const [generando, setGenerando] = useState(false);

  // Historial de reportes guardados
  const [historial, setHistorial] = useState([]);

  // Cargar lista de proyectos al iniciar
  useEffect(() => {
    TableroSaludApiClient.listarProyectos()
      .then((data) => {
        setProyectos(data);
        if (data && data.length > 0) {
          setProyectoSeleccionadoId(data[0].id);
        }
      })
      .catch((err) => {
        setMensajeError(`Error al conectar con la base de datos o backend: ${err.message}`);
      });
  }, []);

  // Cargar tablero cada vez que cambia el proyecto seleccionado
  useEffect(() => {
    if (proyectoSeleccionadoId) {
      cargarTableroPrincipal(proyectoSeleccionadoId);
    }
  }, [proyectoSeleccionadoId]);

  // FN-01 & FN-02: Consulta del tablero principal
  const cargarTableroPrincipal = async (id) => {
    setCargando(true);
    setMensajeError('');
    setMensajeExito('');
    setModoPrevisualizacion(false);
    try {
      const data = await TableroSaludApiClient.obtenerTableroActual(id);
      setTablero(data);
      cargarHistorial(id);
    } catch (err) {
      setMensajeError(err.message || 'Error al cargar el tablero consolidado');
      setTablero(null);
    } finally {
      setCargando(false);
    }
  };

  const cargarHistorial = async (id) => {
    try {
      const hist = await TableroSaludApiClient.obtenerHistorialReportes(id);
      setHistorial(hist);
    } catch (e) {
      console.warn('No se pudo cargar el historial de reportes:', e.message);
    }
  };

  // FN-03, FN-04, FA-04.01, FN-05: Solicitar previsualización del reporte
  const solicitarPrevisualizacionReporte = async () => {
    setCargando(true);
    setMensajeError('');
    setMensajeExito('');
    try {
      const prev = await TableroSaludApiClient.generarPrevisualizacion(proyectoSeleccionadoId);
      setPrevisualizacion(prev);
      setNotasEjecutivas('');
      setModoPrevisualizacion(true);
    } catch (err) {
      setMensajeError(err.message || 'Error al obtener la previsualización del reporte');
    } finally {
      setCargando(false);
    }
  };

  // FA-02.01: Finalizar consulta sin reporte / cancelar previsualización
  const finalizarConsultaSinReporte = () => {
    setModoPrevisualizacion(false);
    setPrevisualizacion(null);
    setNotasEjecutivas('');
  };

  // FN-06, FA-06.01, FN-07, FE-01: Confirmar y generar reporte
  const confirmarGeneracionReporte = async () => {
    setGenerando(true);
    setMensajeError('');
    try {
      const resultado = await TableroSaludApiClient.generarReporteSalud(proyectoSeleccionadoId, {
        notasEjecutivas
      });

      if (resultado.exito) {
        setMensajeExito(`¡Reporte de salud #${resultado.reporteRegistrado.versionReporte} generado y guardado en historial!`);
        
        // Descargar PDF automáticamente
        if (resultado.archivoPDF && resultado.archivoPDF.base64) {
          descargarArchivoPDF(resultado.archivoPDF);
        }

        // Refrescar historial y salir de previsualización
        cargarHistorial(proyectoSeleccionadoId);
        setModoPrevisualizacion(false);
        setPrevisualizacion(null);
        setNotasEjecutivas('');
      }
    } catch (err) {
      // FE-01: Manejo de excepción rollback
      setMensajeError(err.message || 'Error al generar o guardar el reporte de salud. Por favor, reintente.');
    } finally {
      setGenerando(false);
    }
  };

  // Descarga del PDF en el navegador
  const descargarArchivoPDF = (archivo) => {
    try {
      const byteCharacters = atob(archivo.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = archivo.nombreArchivo || 'Reporte_Salud.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error al iniciar descarga del PDF en navegador:', e);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>
      {/* Encabezado */}
      <header style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, color: '#1e3a8a', fontSize: '1.6rem' }}>MetricDash SQA</h1>
            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              CU-07 Tablero y Reporte de Salud
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Monitoreo en semáforo de las 4 métricas de calidad y generación formal versionada a PDF.
          </p>
        </div>

        {/* Selector de Proyecto Activo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="selectorProyecto" style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
            Proyecto:
          </label>
          <select
            id="selectorProyecto"
            value={proyectoSeleccionadoId}
            onChange={(e) => setProyectoSeleccionadoId(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '0.85rem',
              color: '#0f172a'
            }}
          >
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.id === '99999999-9999-9999-9999-999999999999' ? '(Caso FA-04.01)' : ''}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Notificaciones de Error y Éxito */}
      {mensajeError && (
        <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '4px', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          <strong>Error (FE-01):</strong> {mensajeError}
        </div>
      )}

      {mensajeExito && (
        <div style={{ background: '#ecfdf5', borderLeft: '4px solid #10b981', color: '#065f46', padding: '0.75rem 1rem', borderRadius: '4px', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          <strong>Éxito (FN-07):</strong> {mensajeExito}
        </div>
      )}

      {cargando && !tablero && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
          Cargando tablero y datos de salud...
        </div>
      )}

      {/* Vista de Previsualización (FN-03, FN-04, FN-05) */}
      {modoPrevisualizacion && previsualizacion ? (
        <PrevisualizacionReporteWidget
          previsualizacion={previsualizacion}
          notasEjecutivas={notasEjecutivas}
          onCambioNotas={setNotasEjecutivas}
          onConfirmar={confirmarGeneracionReporte}
          onCancelar={finalizarConsultaSinReporte}
          generando={generando}
        />
      ) : (
        /* Vista del Tablero Principal (FN-01 & FN-02) */
        tablero && (
          <div>
            {/* Barra superior de Resumen y Acciones */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Estado de Salud Consolidado
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '2px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1e3a8a' }}>
                    {tablero.indiceSaludGeneral_nullable !== null
                      ? `Índice: ${tablero.indiceSaludGeneral_nullable}%`
                      : 'Índice: Sin datos / Insuficiente'}
                  </h2>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: tablero.estadoSaludGlobal === 'VERDE_OPTIMO' ? '#dcfce7' : tablero.estadoSaludGlobal === 'AMARILLO_ADVERTENCIA' ? '#fef3c7' : '#fee2e2',
                      color: tablero.estadoSaludGlobal === 'VERDE_OPTIMO' ? '#15803d' : tablero.estadoSaludGlobal === 'AMARILLO_ADVERTENCIA' ? '#b45309' : '#b91c1c'
                    }}
                  >
                    {tablero.estadoSaludGlobal}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={solicitarPrevisualizacionReporte}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  📄 Generar Reporte de Salud (FN-03)
                </button>
              </div>
            </div>

            {/* 1. Widgets Semáforo de las 4 Métricas (FN-02) */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
                  1. Indicadores de Calidad en Semáforo (4 Métricas)
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Mediciones derivadas de CU-03, CU-04 y CU-05
                </span>
              </div>
              <SemaforoMetricasWidget indicadores={tablero.indicadores} />
            </div>

            {/* 2. Panel de Alertas Activas o de Deterioro (CU-06) */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f172a' }}>
                2. Alertas Activas de Calidad o Deterioro (CU-06)
              </h3>
              <PanelAlertasActivasWidget alertas={tablero.alertasActivas} />
            </div>

            {/* 3. Historial de Cortes y Reportes Guardados (FN-07) */}
            <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: '#0f172a' }}>
                3. Historial de Reportes Versionados (evaluation_cutoffs)
              </h3>
              {historial && historial.length > 0 ? (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '0.6rem 0.8rem' }}>Versión / Corte</th>
                        <th style={{ padding: '0.6rem 0.8rem' }}>Fecha</th>
                        <th style={{ padding: '0.6rem 0.8rem' }}>Estado de Salud</th>
                        <th style={{ padding: '0.6rem 0.8rem' }}>Notas Ejecutivas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((corte) => (
                        <tr key={corte.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem 0.8rem', fontWeight: 'bold', color: '#1e3a8a' }}>
                            #{corte.cutoff_number} - {corte.cutoff_name}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#64748b' }}>
                            {new Date(corte.cutoff_date).toLocaleDateString('es-ES')}
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9' }}>
                              {corte.health_status}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.8rem', color: '#334155', maxWidth: '300px' }}>
                            {corte.notes || <em style={{ color: '#94a3b8' }}>Sin notas</em>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', background: '#f8fafc', padding: '1rem', borderRadius: '6px' }}>
                  Aún no se han generado cortes históricos para este proyecto.
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
