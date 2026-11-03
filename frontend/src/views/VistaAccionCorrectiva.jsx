import React, { useEffect, useState } from 'react';
import * as api from '../api/AccionesCorrectivasApiClient';
import AlertaDeterioroWidget from '../widgets/AlertaDeterioroWidget';

const ETIQUETAS_METRICAS = {
  DENSIDAD_DEFECTOS: 'Densidad de Defectos (MENOR_ES_MEJOR)',
  COBERTURA_PRUEBAS: 'Cobertura de Pruebas (MAYOR_ES_MEJOR)',
  TASA_EXITO_PRUEBAS: 'Tasa de Éxito de Pruebas (MAYOR_ES_MEJOR)',
  CUMPLIMIENTO_SQA: 'Cumplimiento de Actividades SQA (MAYOR_ES_MEJOR)',
};

export default function VistaAccionCorrectiva({ proyectoId }) {
  const [alertas, setAlertas] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [miembros, setMiembros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensajeExito, setMensajeExito] = useState(null);
  const [mensajeError, setMensajeError] = useState(null);

  // Estado del formulario (FN-04, FN-05, FA-07.01)
  const [modoEdicion, setModoEdicion] = useState(false);
  const [accionEnEdicionId, setAccionEnEdicionId] = useState(null);
  const [alertaSeleccionadaId, setAlertaSeleccionadaId] = useState('');
  const [tipoMetrica, setTipoMetrica] = useState('DENSIDAD_DEFECTOS');
  const [descripcion, setDescripcion] = useState('');
  const [causaAtendida, setCausaAtendida] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [fechaCompromiso, setFechaCompromiso] = useState('');
  const [erroresFormulario, setErroresFormulario] = useState({});

  // Herramienta de prueba / simulación de siguiente medición (FN-07)
  const [simulandoMetrica, setSimulandoMetrica] = useState(false);
  const [metricaSimular, setMetricaSimular] = useState('DENSIDAD_DEFECTOS');
  const [valorSimular, setValorSimular] = useState('');

  // Fecha mínima permitida (hoy)
  const hoyString = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (proyectoId) {
      cargarDatos();
    }
  }, [proyectoId]);

  async function cargarDatos() {
    setCargando(true);
    setMensajeError(null);
    try {
      const [resAlertas, resAcciones, listaMiembros] = await Promise.all([
        api.obtenerAlertas(proyectoId),
        api.obtenerAccionesCorrectivas(proyectoId),
        api.obtenerMiembros(proyectoId),
      ]);
      const alerts = resAlertas.data?.alertas || [];
      setAlertas(alerts);
      setAcciones(resAcciones.data?.acciones || []);
      setMiembros(listaMiembros || []);

      if (alerts.length > 0 && !alertaSeleccionadaId) {
        setAlertaSeleccionadaId(alerts[0].id);
        setTipoMetrica(alerts[0].tipoMetrica);
        if (alerts[0].posiblesCausas?.length > 0) {
          setCausaAtendida(alerts[0].posiblesCausas[0].descripcion);
        }
      }
    } catch (err) {
      setMensajeError('No se pudieron cargar los datos de alertas y acciones correctivas: ' + err.message);
    } finally {
      setCargando(false);
    }
  }

  function handleSeleccionarAlerta(alerta) {
    setAlertaSeleccionadaId(alerta.id);
    setTipoMetrica(alerta.tipoMetrica);
    setModoEdicion(false);
    setAccionEnEdicionId(null);
    if (alerta.posiblesCausas?.length > 0) {
      setCausaAtendida(alerta.posiblesCausas[0].descripcion);
    }
    // Scroll al formulario
    const formEl = document.getElementById('formulario-accion-correctiva');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  }

  function handleReplantearAccion(accion) {
    setModoEdicion(true);
    setAccionEnEdicionId(accion.id);
    setAlertaSeleccionadaId(accion.alertaId || '');
    setTipoMetrica(accion.tipoMetrica);
    setDescripcion(accion.descripcion);
    setCausaAtendida(accion.causaAtendida);
    setResponsableId(accion.responsableId);
    setFechaCompromiso(accion.fechaCompromiso || hoyString);
    setErroresFormulario({});

    const formEl = document.getElementById('formulario-accion-correctiva');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  }

  function limpiarFormulario() {
    setModoEdicion(false);
    setAccionEnEdicionId(null);
    setDescripcion('');
    setCausaAtendida('');
    setResponsableId('');
    setFechaCompromiso('');
    setErroresFormulario({});
  }

  // FN-05 / FA-04.01 / FA-05.01: Envío del formulario
  async function handleSubmit(e) {
    e.preventDefault();
    setMensajeExito(null);
    setMensajeError(null);
    setErroresFormulario({});

    const dto = {
      proyectoId,
      alertaId: alertaSeleccionadaId || null,
      tipoMetrica,
      descripcion,
      causaAtendida,
      responsableId,
      fechaCompromiso,
    };

    try {
      let res;
      if (modoEdicion && accionEnEdicionId) {
        // Actualizar acción tras no ser eficaz (FA-07.01)
        res = await api.actualizarAccionCorrectiva(accionEnEdicionId, dto);
      } else {
        // Nueva acción correctiva (FN-05)
        res = await api.guardarAccionCorrectiva(proyectoId, dto);
      }

      if (res.status === 400 && res.data?.errores) {
        // FA-05.01: Datos incompletos o inválidos
        const mapa = {};
        for (const err of res.data.errores) {
          mapa[err.campo] = err.mensaje;
        }
        setErroresFormulario(mapa);
        setMensajeError(res.data.mensaje || 'Revise los campos señalados e intente nuevamente.');
        return;
      }

      setMensajeExito(
        modoEdicion
          ? 'Acción correctiva replanteada exitosamente.'
          : 'Acción correctiva registrada exitosamente en estado abierta.'
      );
      limpiarFormulario();
      await cargarDatos();
    } catch (err) {
      setMensajeError('Error al guardar la acción: ' + err.message);
    }
  }

  // Simular registro de una nueva medición de métrica
  async function handleSimularMedicion(e) {
    e.preventDefault();
    if (!valorSimular || isNaN(Number(valorSimular))) {
      alert('Ingrese un valor numérico para la medición.');
      return;
    }

    try {
      const res = await api.registrarMedicion(proyectoId, {
        tipoMetrica: metricaSimular,
        valor: Number(valorSimular),
      });

      const data = res.data;
      if (data.tipoFlujo === 'VERIFICACION_EFICACIA') {
        if (data.eficaz) {
          setMensajeExito(`¡Eficacia confirmada! ${data.mensaje}`);
        } else {
          setMensajeError(`Verificación de eficacia: ${data.mensaje}`);
        }
      } else if (data.tipoFlujo === 'DETECCION_DETERIORO') {
        if (data.deterioroDetectado) {
          setMensajeError(`¡Deterioro detectado! Se ha generado una nueva alerta: ${data.alerta?.mensaje}`);
        } else {
          setMensajeExito(`Medición evaluada: ${data.motivo || 'No se detectó deterioro.'}`);
        }
      }
      setValorSimular('');
      await cargarDatos();
    } catch (err) {
      setMensajeError('Error al registrar la medición: ' + err.message);
    }
  }

  const alertasActivas = alertas.filter((a) => a.estado === 'ACTIVA' || a.estado === 'EN_PROCESO');

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-blue-900">
              Deterioro y Acciones Correctivas
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Detección automática de deterioro de calidad, análisis de causas y seguimiento de acciones correctivas con verificación de eficacia.
            </p>
          </div>
          <button
            type="button"
            onClick={cargarDatos}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            🔄 Actualizar Datos
          </button>
        </div>
      </div>

      {/* Mensajes de Alerta / Éxito */}
      {mensajeExito && (
        <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm font-semibold text-green-900 shadow-xs flex items-center justify-between">
          <span>✔ {mensajeExito}</span>
          <button type="button" onClick={() => setMensajeExito(null)} className="text-green-700 font-bold ml-3">✕</button>
        </div>
      )}

      {mensajeError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900 shadow-xs flex items-center justify-between">
          <span>✖ {mensajeError}</span>
          <button type="button" onClick={() => setMensajeError(null)} className="text-red-700 font-bold ml-3">✕</button>
        </div>
      )}

      {/* SECCIÓN 1: Alertas Visuales Activas de Deterioro */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>Alertas de Calidad por Deterioro</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
              alertasActivas.length > 0 ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {alertasActivas.length}
            </span>
          </h3>
        </div>

        {alertasActivas.length > 0 ? (
          alertasActivas.map((alerta) => (
            <AlertaDeterioroWidget
              key={alerta.id}
              alerta={alerta}
              onIniciarAccion={handleSeleccionarAlerta}
              onPosponer={() => {
                setMensajeExito('Alerta pospuesta. Permanecerá activa y pendiente en el tablero.');
              }}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
            <span className="text-2xl">🎉</span>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              No hay alertas activas de deterioro en el proyecto.
            </p>
            <p className="text-xs text-slate-500">
              Las métricas se encuentran estables o dentro de los umbrales configurados.
            </p>
          </div>
        )}
      </div>

      {/* SECCIÓN 2: Formulario de Creación / Replanteamiento de Acción Correctiva */}
      <div
        id="formulario-accion-correctiva"
        className={`rounded-lg border p-6 shadow-sm transition-colors ${
          modoEdicion ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {modoEdicion
                ? 'Replantear Acción Correctiva'
                : 'Registrar Acción Correctiva'}
            </h3>
            <p className="text-xs text-slate-500">
              {modoEdicion
                ? 'La acción anterior no logró revertir el deterioro; actualice la estrategia, el responsable o la fecha compromiso.'
                : 'Defina las acciones inmediatas para corregir la desviación detectada en la métrica.'}
            </p>
          </div>
          {modoEdicion && (
            <span className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white">
              Replanteamiento Activo
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Métrica Afectada */}
            <div>
              <label htmlFor="tipoMetrica-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Métrica Afectada *
              </label>
              <select
                id="tipoMetrica-select"
                value={tipoMetrica}
                onChange={(e) => setTipoMetrica(e.target.value)}
                disabled={modoEdicion}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none"
              >
                {Object.entries(ETIQUETAS_METRICAS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Vinculación con Alerta Activa */}
            <div>
              <label htmlFor="alertaId-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Alerta de Origen
              </label>
              <select
                id="alertaId-select"
                value={alertaSeleccionadaId}
                onChange={(e) => {
                  setAlertaSeleccionadaId(e.target.value);
                  const a = alertas.find((x) => x.id === e.target.value);
                  if (a) {
                    setTipoMetrica(a.tipoMetrica);
                    if (a.posiblesCausas?.length > 0) {
                      setCausaAtendida(a.posiblesCausas[0].descripcion);
                    }
                  }
                }}
                disabled={modoEdicion}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none"
              >
                <option value="">(Sin vincular a alerta específica)</option>
                {alertas.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.tipoMetrica}] {a.mensaje?.slice(0, 70)}...
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Causa que Atiende */}
          <div>
            <label htmlFor="causaAtendida-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Causa que Atiende *
            </label>
            <input
              id="causaAtendida-input"
              type="text"
              value={causaAtendida}
              onChange={(e) => setCausaAtendida(e.target.value)}
              placeholder="Ej. DEF-003 [CRITICA]: El registro de proyecto acepta KLOC negativo"
              className={`w-full rounded-md border px-3 py-2 text-sm text-slate-800 shadow-xs focus:outline-none ${
                erroresFormulario.causaAtendida
                  ? 'border-red-500 bg-red-50/50 focus:border-red-600'
                  : 'border-slate-300 focus:border-blue-500'
              }`}
            />
            {erroresFormulario.causaAtendida && (
              <p className="mt-1 text-xs font-semibold text-red-600">{erroresFormulario.causaAtendida}</p>
            )}
          </div>

          {/* Descripción de la Acción */}
          <div>
            <label htmlFor="descripcion-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Descripción de la Acción Correctiva *
            </label>
            <textarea
              id="descripcion-input"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describa puntualmente las tareas técnicas a ejecutar para resolver la causa raíz..."
              className={`w-full rounded-md border px-3 py-2 text-sm text-slate-800 shadow-xs focus:outline-none ${
                erroresFormulario.descripcion
                  ? 'border-red-500 bg-red-50/50 focus:border-red-600'
                  : 'border-slate-300 focus:border-blue-500'
              }`}
            />
            {erroresFormulario.descripcion && (
              <p className="mt-1 text-xs font-semibold text-red-600">{erroresFormulario.descripcion}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Responsable */}
            <div>
              <label htmlFor="responsableId-select" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Responsable del Equipo *
              </label>
              <select
                id="responsableId-select"
                value={responsableId}
                onChange={(e) => setResponsableId(e.target.value)}
                className={`w-full rounded-md border px-3 py-2 text-sm text-slate-800 shadow-xs focus:outline-none ${
                  erroresFormulario.responsableId
                    ? 'border-red-500 bg-red-50/50 focus:border-red-600'
                    : 'border-slate-300 focus:border-blue-500'
                }`}
              >
                <option value="">Seleccione un miembro del equipo...</option>
                {miembros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} ({m.rol})
                  </option>
                ))}
              </select>
              {erroresFormulario.responsableId && (
                <p className="mt-1 text-xs font-semibold text-red-600">{erroresFormulario.responsableId}</p>
              )}
            </div>

            {/* Fecha de Compromiso */}
            <div>
              <label htmlFor="fechaCompromiso-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Fecha Compromiso * (no anterior a hoy)
              </label>
              <input
                id="fechaCompromiso-input"
                type="date"
                min={hoyString}
                value={fechaCompromiso}
                onChange={(e) => setFechaCompromiso(e.target.value)}
                className={`w-full rounded-md border px-3 py-2 text-sm text-slate-800 shadow-xs focus:outline-none ${
                  erroresFormulario.fechaCompromiso
                    ? 'border-red-500 bg-red-50/50 focus:border-red-600'
                    : 'border-slate-300 focus:border-blue-500'
                }`}
              />
              {erroresFormulario.fechaCompromiso && (
                <p className="mt-1 text-xs font-semibold text-red-600">{erroresFormulario.fechaCompromiso}</p>
              )}
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={limpiarFormulario}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              Cancelar / Limpiar
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-700 px-5 py-2 text-sm font-bold text-white shadow-xs hover:bg-blue-800 transition"
            >
              {modoEdicion ? 'Actualizar Acción Replanteada' : 'Guardar Acción Correctiva'}
            </button>
          </div>
        </form>
      </div>

      {/* SECCIÓN 3: Seguimiento de Acciones Correctivas en el Tablero (FN-06, FN-08, FN-09, FA-07.01) */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            Seguimiento de Acciones Correctivas ({acciones.length})
          </h3>
          <span className="text-xs text-slate-500">
            {acciones.filter((a) => a.estado === 'abierta').length} abiertas en seguimiento
          </span>
        </div>

        {acciones.length > 0 ? (
          <div className="space-y-4">
            {acciones.map((acc) => {
              const estaAbierta = acc.estado === 'abierta';
              const tieneVerificacionNoEficaz = acc.esEficaz === false;
              const esEficaz = acc.esEficaz === true || acc.estado === 'cerrada';

              return (
                <div
                  key={acc.id}
                  className={`rounded-lg border p-5 shadow-xs transition-colors ${
                    esEficaz
                      ? 'border-green-300 bg-green-50/40'
                      : tieneVerificacionNoEficaz
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-blue-200 bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-bold ${
                          estaAbierta
                            ? 'bg-blue-600 text-white'
                            : 'bg-green-700 text-white'
                        }`}
                      >
                        {acc.estado.toUpperCase()}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {ETIQUETAS_METRICAS[acc.tipoMetrica] || acc.tipoMetrica}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {tieneVerificacionNoEficaz && estaAbierta && (
                        <button
                          type="button"
                          onClick={() => handleReplantearAccion(acc)}
                          className="rounded-md bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition"
                        >
                          ✎ Replantear Acción
                        </button>
                      )}
                      <span className="text-xs text-slate-500">
                        Compromiso: <strong>{acc.fechaCompromiso}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-sm font-semibold text-slate-900">{acc.descripcion}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      <strong>Causa atendida:</strong> {acc.causaAtendida}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      <strong>Responsable asignado:</strong>{' '}
                      <span className="font-semibold text-blue-900">
                        {acc.responsableNombre || 'Miembro del equipo'}
                      </span>
                    </p>
                  </div>

                  {/* Estado de Verificación de Eficacia */}
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {esEficaz ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-green-800">
                        <span>✔ Acción verificada como EFICAZ y cerrada en la siguiente medición.</span>
                      </div>
                    ) : tieneVerificacionNoEficaz ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                        <span>⚠ Verificada como NO EFICAZ: No logró revertir el deterioro. Replantee la acción.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>⏳ En seguimiento: Su eficacia será verificada automáticamente en la siguiente medición.</span>
                      </div>
                    )}

                    {/* Historial de Verificaciones */}
                    {acc.historialVerificaciones?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Historial de Verificaciones:
                        </span>
                        {acc.historialVerificaciones.map((h, hi) => (
                          <div
                            key={h.id || hi}
                            className="rounded bg-white/80 border border-slate-200 px-2.5 py-1 text-xs text-slate-700 flex items-center justify-between"
                          >
                            <span>
                              {h.esEficaz ? '✔ Eficaz' : '✖ No eficaz'} | Medido:{' '}
                              <strong>{h.valorMedido}</strong> (vs Base: {h.valorBase})
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {h.notas || (h.esEficaz ? 'Objetivo cumplido' : 'Pendiente de replantear')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500 text-sm">
            No se han registrado acciones correctivas en el proyecto.
          </div>
        )}
      </div>

      {/* SECCIÓN 4: Herramienta de Prueba de Eficacia y Mediciones */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-5">
        <button
          type="button"
          onClick={() => setSimulandoMetrica(!simulandoMetrica)}
          className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-blue-900"
        >
          <span>🧪 Herramienta de Verificación en Vivo: Simular / Registrar Siguiente Medición</span>
          <span>{simulandoMetrica ? '▲ Ocultar' : '▼ Probar Medición'}</span>
        </button>

        {simulandoMetrica && (
          <div className="mt-4 border-t border-blue-200 pt-4">
            <p className="text-xs text-slate-600 mb-3">
              Permite ingresar una nueva medición para observar cómo el sistema evalúa automáticamente el deterioro o verifica la eficacia de una acción correctiva abierta.
            </p>
            <form onSubmit={handleSimularMedicion} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Métrica a Medir
                </label>
                <select
                  value={metricaSimular}
                  onChange={(e) => setMetricaSimular(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-xs"
                >
                  <option value="DENSIDAD_DEFECTOS">Densidad de Defectos</option>
                  <option value="COBERTURA_PRUEBAS">Cobertura de Pruebas</option>
                  <option value="TASA_EXITO_PRUEBAS">Tasa de Éxito de Pruebas</option>
                  <option value="CUMPLIMIENTO_SQA">Cumplimiento SQA</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Nuevo Valor (Vn+1)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={valorSimular}
                  onChange={(e) => setValorSimular(e.target.value)}
                  placeholder="Ej. 1.0"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-xs w-32"
                />
              </div>

              <button
                type="submit"
                className="rounded-md bg-blue-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition"
              >
                Evaluar Medición
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

