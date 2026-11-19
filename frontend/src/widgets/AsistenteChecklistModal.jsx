import React, { useState, useEffect } from 'react';
import * as api from '../api/ActividadesApiClient';

export default function AsistenteChecklistModal({
  proyectoId,
  actividad,
  onCerrar,
  onFinalizado,
}) {
  const [paso, setPaso] = useState(1); // 1: Checklist ítem por ítem, 2: Resumen y Cierre, 3: Acta Emitida
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [indiceActual, setIndiceActual] = useState(0);

  // Estado de respuestas del checklist
  // Array de { itemId, pregunta, cumple: boolean, observacion, severidad, prioridad, duplicadoDetectado, descartado, folioReferenciado, confirmarIncidenciaDistinta }
  const [respuestas, setRespuestas] = useState([]);
  const [buscandoDuplicados, setBuscandoDuplicados] = useState(false);
  const [duplicadosEncontrados, setDuplicadosEncontrados] = useState([]);

  // Cierre de acta
  const [dictamen, setDictamen] = useState('APROBADO');
  const [resumenHallazgos, setResumenHallazgos] = useState('');

  // Resultado final de emisión
  const [resultadoFinal, setResultadoFinal] = useState(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      setErrorMsg('');
      try {
        const { status, data } = await api.obtenerChecklist(proyectoId, actividad.id);
        if (status === 200 && data.checklist) {
          setChecklist(data.checklist);
          setRespuestas(
            data.checklist.map((item) => ({
              itemId: item.id,
              pregunta: item.pregunta,
              cumple: true,
              observacion: '',
              severidad: 'MEDIA',
              prioridad: 'ALTA',
              descartado: false,
              folioReferenciado: null,
              confirmarIncidenciaDistinta: false,
            })),
          );
        } else {
          setErrorMsg(data?.mensaje || 'No se pudo cargar el checklist.');
        }
      } catch (err) {
        setErrorMsg(err.message || 'Error al conectar con el servidor.');
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [proyectoId, actividad.id]);

  const respuestaActual = respuestas[indiceActual] || {};

  function actualizarRespuestaActual(cambios) {
    setRespuestas((prev) => {
      const nuevo = [...prev];
      nuevo[indiceActual] = { ...nuevo[indiceActual], ...cambios };
      return nuevo;
    });
  }

  // FA-05.01: Valida si el ítem actual está completo antes de avanzar
  function validarItemActual() {
    if (!respuestaActual.cumple) {
      if (!respuestaActual.observacion || !respuestaActual.observacion.trim()) {
        setErrorMsg(`Debe describir la observación del hallazgo para el ítem '${respuestaActual.itemId}'.`);
        return false;
      }
      if (!respuestaActual.severidad) {
        setErrorMsg('Debe seleccionar la severidad del defecto.');
        return false;
      }
      if (!respuestaActual.prioridad) {
        setErrorMsg('Debe seleccionar la prioridad del defecto.');
        return false;
      }
    }
    setErrorMsg('');
    return true;
  }

  async function handleBuscarDuplicados() {
    if (!respuestaActual.observacion.trim()) {
      setErrorMsg('Ingrese primero la observación para buscar posibles duplicados.');
      return;
    }
    setBuscandoDuplicados(true);
    setErrorMsg('');
    setDuplicadosEncontrados([]);
    try {
      const { status, data } = await api.buscarDuplicados(proyectoId, actividad.id, [
        { itemId: respuestaActual.itemId, cumple: false, observacion: respuestaActual.observacion },
      ]);
      if (status === 200 && data.hallazgos && data.hallazgos[0]?.coincidencias) {
        setDuplicadosEncontrados(data.hallazgos[0].coincidencias);
        if (data.hallazgos[0].coincidencias.length === 0) {
          setErrorMsg('No se detectaron defectos duplicados similares en el proyecto.');
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al verificar duplicados.');
    } finally {
      setBuscandoDuplicados(false);
    }
  }

  function handleSeleccionarDuplicado(dup) {
    actualizarRespuestaActual({
      descartado: true,
      folioReferenciado: dup.folio,
      duplicadoDetectado: dup,
      confirmarIncidenciaDistinta: false,
    });
  }

  function handleConfirmarIncidenciaDistinta() {
    actualizarRespuestaActual({
      descartado: false,
      folioReferenciado: null,
      confirmarIncidenciaDistinta: true,
    });
  }

  function avanzarItem() {
    if (!validarItemActual()) return;
    setDuplicadosEncontrados([]);
    if (indiceActual < checklist.length - 1) {
      setIndiceActual(indiceActual + 1);
    } else {
      // Pasar a la fase de resumen y cierre
      const noCumplen = respuestas.filter((r) => !r.cumple);
      setDictamen(noCumplen.length === 0 ? 'APROBADO' : 'CONDICIONAL');
      setResumenHallazgos(
        noCumplen.length === 0
          ? 'Revisión concluida satisfactoriamente. Todos los ítems del checklist cumplen con los criterios.'
          : `Revisión por pares concluida con ${noCumplen.length} hallazgo(s) a solventar.`,
      );
      setPaso(2);
    }
  }

  function retrocederItem() {
    setErrorMsg('');
    setDuplicadosEncontrados([]);
    if (indiceActual > 0) {
      setIndiceActual(indiceActual - 1);
    }
  }

  async function handleConfirmarCierre() {
    setGuardando(true);
    setErrorMsg('');

    const dto = {
      verdict: dictamen,
      findingsSummary: resumenHallazgos,
      checklistResults: respuestas,
    };

    try {
      const { status, data } = await api.cerrarRevision(proyectoId, actividad.id, dto);
      if (status === 201) {
        setResultadoFinal(data);
        setPaso(3);
        if (onFinalizado) {
          onFinalizado(data);
        }
      } else {
        setErrorMsg(data?.mensaje || 'Error al cerrar la revisión.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al procesar el cierre.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="rounded-xl bg-white p-6 shadow-xl text-center">
          <p className="text-sm font-semibold text-slate-700">Cargando checklist del artefacto...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Caso de Uso 04 — Ejecución de Revisión por Pares
            </span>
            <h3 className="text-lg font-bold text-slate-800">
              {actividad.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
            {errorMsg}
          </div>
        )}

        {/* PASO 1: Checklist Ítem por Ítem */}
        {paso === 1 && checklist.length > 0 && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 border-b pb-2">
              <span>Artefacto: <strong>{actividad.artifact || 'SGU'}</strong></span>
              <span>Ítem {indiceActual + 1} de {checklist.length}</span>
            </div>

            {/* Tarjeta de Pregunta */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 mb-2">
                {respuestaActual.itemId}
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {respuestaActual.pregunta}
              </p>
            </div>

            {/* Opciones Cumple / No Cumple (FN-05) */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => actualizarRespuestaActual({ cumple: true })}
                className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all border ${
                  respuestaActual.cumple
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                ✔ CUMPLE
              </button>
              <button
                type="button"
                onClick={() => actualizarRespuestaActual({ cumple: false })}
                className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all border ${
                  !respuestaActual.cumple
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                ✖ NO CUMPLE (Genera Hallazgo/Defecto)
              </button>
            </div>

            {/* Formulario de Hallazgo si No Cumple (FN-05, FA-05.01) */}
            {!respuestaActual.cumple && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-4 space-y-3">
                <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                  Detalles del Hallazgo / Defecto
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Descripción de la Observación *
                  </label>
                  <textarea
                    rows={3}
                    value={respuestaActual.observacion}
                    onChange={(e) => actualizarRespuestaActual({ observacion: e.target.value })}
                    placeholder="Describa puntualmente el problema o no conformidad detectada..."
                    className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-xs focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Severidad *
                    </label>
                    <select
                      value={respuestaActual.severidad}
                      onChange={(e) => actualizarRespuestaActual({ severidad: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-xs"
                    >
                      <option value="BAJA">BAJA</option>
                      <option value="MEDIA">MEDIA</option>
                      <option value="ALTA">ALTA</option>
                      <option value="CRITICA">CRÍTICA (Lanza Alerta)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Prioridad *
                    </label>
                    <select
                      value={respuestaActual.prioridad}
                      onChange={(e) => actualizarRespuestaActual({ prioridad: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-xs"
                    >
                      <option value="BAJA">BAJA</option>
                      <option value="MEDIA">MEDIA</option>
                      <option value="ALTA">ALTA</option>
                      <option value="INMEDIATA">INMEDIATA</option>
                    </select>
                  </div>
                </div>

                {/* Búsqueda de Duplicados (FN-06 / FA-06.01) */}
                <div className="pt-2 border-t border-rose-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-medium">
                      Verificación de duplicados (CU-03):
                    </span>
                    <button
                      type="button"
                      disabled={buscandoDuplicados}
                      onClick={handleBuscarDuplicados}
                      className="rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                    >
                      {buscandoDuplicados ? 'Analizando similitud...' : '🔍 Buscar posibles duplicados'}
                    </button>
                  </div>

                  {/* Estado de decisión de duplicado */}
                  {respuestaActual.descartado && (
                    <div className="mt-2 rounded bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
                      <strong>Hallazgo descartado:</strong> Se referenciará en el acta con el folio existente{' '}
                      <span className="font-mono font-bold text-amber-900">{respuestaActual.folioReferenciado}</span>.
                    </div>
                  )}

                  {respuestaActual.confirmarIncidenciaDistinta && (
                    <div className="mt-2 rounded bg-blue-50 p-2.5 text-xs text-blue-800 border border-blue-200">
                      <strong>Incidencia distinta confirmada:</strong> Se registrará como un defecto nuevo.
                    </div>
                  )}

                  {/* Lista de coincidencias encontradas */}
                  {duplicadosEncontrados.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-amber-800">
                        Se encontraron {duplicadosEncontrados.length} defecto(s) con similitud ≥ 60%:
                      </p>
                      {duplicadosEncontrados.map((dup) => (
                        <div key={dup.defectoExistenteId} className="rounded border border-amber-300 bg-amber-50/60 p-2.5 text-xs">
                          <div className="flex items-center justify-between font-bold">
                            <span>{dup.folio} — {dup.porcentajeSimilitud}% similitud</span>
                            <span className="text-slate-500 font-normal">Fase: {dup.faseOrigen}</span>
                          </div>
                          <p className="mt-1 text-slate-700 text-xs italic">
                            "{dup.descripcionResumen}"
                          </p>
                          <div className="mt-2 flex space-x-2">
                            <button
                              type="button"
                              onClick={() => handleSeleccionarDuplicado(dup)}
                              className="rounded bg-amber-600 px-2 py-1 text-xs font-bold text-white hover:bg-amber-700"
                            >
                              Descartar nuevo (vincular a {dup.folio})
                            </button>
                            <button
                              type="button"
                              onClick={handleConfirmarIncidenciaDistinta}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Es incidencia distinta
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navegación entre ítems */}
            <div className="flex justify-between border-t pt-4">
              <button
                type="button"
                disabled={indiceActual === 0}
                onClick={retrocederItem}
                className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                ← Ítem Anterior
              </button>
              <button
                type="button"
                onClick={avanzarItem}
                className="rounded-md bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
              >
                {indiceActual === checklist.length - 1 ? 'Continuar al Dictamen →' : 'Siguiente Ítem →'}
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: Resumen, Dictamen y Cierre (FN-07) */}
        {paso === 2 && (
          <div className="mt-4 space-y-4">
            <h4 className="text-sm font-bold text-slate-800">
              Resumen de la Revisión por Pares
            </h4>

            {/* Tabla resumen de hallazgos */}
            <div className="max-h-52 overflow-y-auto rounded border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-2">Ítem</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Observación / Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {respuestas.map((r) => (
                    <tr key={r.itemId}>
                      <td className="p-2 font-mono font-semibold">{r.itemId}</td>
                      <td className="p-2">
                        {r.cumple ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                            Cumple
                          </span>
                        ) : (
                          <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                            No cumple ({r.severidad})
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        {r.cumple ? (
                          <span className="text-slate-400">Sin hallazgos</span>
                        ) : r.descartado ? (
                          <span className="text-amber-700 font-medium">
                            Duplicado descartado ➔ Referenciado a {r.folioReferenciado}
                          </span>
                        ) : (
                          <span className="text-rose-700">
                            Defecto nuevo: {r.observacion.slice(0, 60)}...
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dictamen de la revisión */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Dictamen Formal de la Revisión *
              </label>
              <select
                value={dictamen}
                onChange={(e) => setDictamen(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm font-semibold"
              >
                <option value="APROBADO">APROBADO — El artefacto cumple con la calidad requerida</option>
                <option value="CONDICIONAL">CONDICIONAL — Requiere solventar los hallazgos señalados</option>
                <option value="RECHAZADO">RECHAZADO — No cumple con los criterios mínimos de aceptación</option>
              </select>
            </div>

            {/* Resumen ejecutivo del acta */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Resumen Ejecutivo para el Acta *
              </label>
              <textarea
                rows={3}
                value={resumenHallazgos}
                onChange={(e) => setResumenHallazgos(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-between border-t pt-4">
              <button
                type="button"
                onClick={() => setPaso(1)}
                className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                ← Volver al Checklist
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={handleConfirmarCierre}
                className="rounded-md bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-md"
              >
                {guardando ? 'Guardando atómicamente...' : '✔ Confirmar Cierre y Emitir Acta'}
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: Acta Emitida y Alerta Visual (FN-09, FA-09.01) */}
        {paso === 3 && resultadoFinal && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-900">
              <h4 className="text-sm font-bold">¡Actividad SQA Realizada y Acta Emitida con Éxito!</h4>
              <p className="mt-1 text-xs">
                La actividad ha sido marcada como realizada y los defectos correspondientes quedaron registrados y asignados.
              </p>
            </div>

            {/* Alerta de umbral o defecto crítico (FA-09.01) */}
            {resultadoFinal.alerta && (
              <div className="rounded-lg bg-rose-50 border border-rose-300 p-4 text-rose-900 shadow">
                <span className="font-bold text-xs uppercase tracking-wider block text-rose-700">
                  ⚠ Alerta Visual Inmediata (FA-09.01)
                </span>
                <p className="mt-1 text-xs font-medium">
                  {resultadoFinal.alerta.mensajeAlerta}
                </p>
              </div>
            )}

            {/* Detalles del Acta */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between font-bold border-b pb-1">
                <span>Dictamen: {resultadoFinal.acta.verdict}</span>
                <span className="font-mono text-blue-700">{resultadoFinal.acta.minutes_url || resultadoFinal.acta.minutesUrl}</span>
              </div>
              <p><strong>Defectos Nuevos Registrados:</strong> {resultadoFinal.defectosCreados?.length || 0}</p>
              <p><strong>Nuevo Cumplimiento SQA:</strong> {resultadoFinal.medicionCumplimiento?.valorCalculado}%</p>
              {resultadoFinal.medicionDensidad && (
                <p><strong>Densidad de Defectos Recalculada:</strong> {resultadoFinal.medicionDensidad.valorCalculado} def/KLOC</p>
              )}
              <p><strong>Semáforo de Salud Global:</strong> {resultadoFinal.nivelGlobal}</p>
            </div>

            <div className="flex justify-end border-t pt-4">
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-md bg-blue-700 px-5 py-2 text-xs font-bold text-white hover:bg-blue-800"
              >
                Aceptar y Volver al Tablero
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
