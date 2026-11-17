import React, { useState, useEffect } from 'react';
import TableroSaludApiClient from '../services/TableroSaludApiClient';
import SemaforoMetricasWidget from '../components/SemaforoMetricasWidget';
import PanelAlertasActivasWidget from '../components/PanelAlertasActivasWidget';
import PrevisualizacionReporteWidget from '../components/PrevisualizacionReporteWidget';

export default function VistaTableroReporteSalud({ proyectoIdInicial = null }) {
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionadoId, setProyectoSeleccionadoId] = useState(proyectoIdInicial || '');
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

  useEffect(() => {
    if (proyectoIdInicial) {
      setProyectoSeleccionadoId(proyectoIdInicial);
    } else {
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
    }
  }, [proyectoIdInicial]);

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
    <div className="space-y-6">
      {/* Encabezado del Tablero */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">Tablero de Salud Consolidado</h2>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                CU-07
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Evaluación en semáforo de las 4 métricas, alertas activas e índice de salud general.
            </p>
          </div>

          {proyectos.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="selectorProyecto" className="text-xs font-semibold text-slate-600">
                Cambiar Proyecto:
              </label>
              <select
                id="selectorProyecto"
                value={proyectoSeleccionadoId}
                onChange={(e) => setProyectoSeleccionadoId(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm"
              >
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Notificaciones */}
      {mensajeError && (
        <div className="rounded-md border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error (FE-01):</strong> {mensajeError}
        </div>
      )}

      {mensajeExito && (
        <div className="rounded-md border-l-4 border-emerald-500 bg-emerald-50 p-4 text-sm text-emerald-800">
          <strong>Éxito (FN-07):</strong> {mensajeExito}
        </div>
      )}

      {cargando && !tablero && (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Cargando tablero y datos de salud...
        </div>
      )}

      {/* Modo Previsualización (FN-03, FN-04, FN-05) */}
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
        /* Vista de Tablero Principal (FN-01 & FN-02) */
        tablero && (
          <div className="space-y-6">
            {/* Banner del Índice y Acción de Generar Reporte */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Índice de Salud General
                </span>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-blue-900">
                    {tablero.indiceSaludGeneral_nullable !== null
                      ? `${tablero.indiceSaludGeneral_nullable}%`
                      : 'Sin datos / Insuficiente'}
                  </span>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                      tablero.estadoSaludGlobal === 'VERDE_OPTIMO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : tablero.estadoSaludGlobal === 'AMARILLO_ADVERTENCIA'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {tablero.estadoSaludGlobal}
                  </span>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={solicitarPrevisualizacionReporte}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors"
                >
                  <span>📄</span> Generar Reporte de Salud (FN-03)
                </button>
              </div>
            </div>

            {/* 1. Indicadores de Semáforo de las 4 Métricas (FN-02) */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">
                  1. Indicadores de Calidad en Semáforo (4 Métricas)
                </h3>
                <span className="text-xs text-slate-500">
                  Derivados de CU-03, CU-04 y CU-05
                </span>
              </div>
              <SemaforoMetricasWidget indicadores={tablero.indicadores} />
            </div>

            {/* 2. Panel de Alertas Activas o de Deterioro (CU-06) */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800">
                2. Alertas Activas de Calidad o Deterioro (CU-06)
              </h3>
              <PanelAlertasActivasWidget alertas={tablero.alertasActivas} />
            </div>

            {/* 3. Historial de Reportes Guardados (evaluation_cutoffs) */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800">
                3. Historial de Reportes Versionados (evaluation_cutoffs)
              </h3>
              {historial && historial.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Corte / Versión</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Estado de Salud</th>
                        <th className="px-4 py-3">Notas Ejecutivas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historial.map((corte) => (
                        <tr key={corte.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-blue-900">
                            #{corte.cutoff_number} - {corte.cutoff_name}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(corte.cutoff_date).toLocaleDateString('es-ES')}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              {corte.health_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                            {corte.notes || <em className="text-slate-400">Sin notas</em>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  No hay reportes ni cortes registrados aún en el historial de este proyecto.
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
