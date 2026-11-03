import React, { useEffect, useState } from 'react';
import * as actividadesApi from '../api/ActividadesSqaApiClient';
import * as proyectosApi from '../api/ProyectosApiClient';
import ChecklistWidget from '../widgets/ChecklistWidget';
import ActaRevisionWidget from '../widgets/ActaRevisionWidget';
import TableroSqaWidget from '../widgets/TableroSqaWidget';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FASES_ETIQUETAS = {
  ANALISIS_REQUERIMIENTOS: 'CP1 — Análisis de Requerimientos',
  DISENO_COMPONENTES: 'CP2 — Diseño de Componentes',
  CONSTRUCCION_SOFTWARE: 'CP3 — Construcción de Software',
  INTEGRACION_Y_PRUEBAS: 'CP4 — Integración y Pruebas',
};

const TIPOS_ACTIVIDAD_ETIQUETAS = {
  REVISION_PARES: { texto: 'Revisión por Pares', clase: 'bg-purple-100 text-purple-800' },
  PRUEBAS: { texto: 'Ejecución de Pruebas', clase: 'bg-blue-100 text-blue-800' },
  AUDITORIA: { texto: 'Auditoría / Dictamen', clase: 'bg-amber-100 text-amber-800' },
};

const TIPOS_ARTEFACTO = [
  { valor: 'VISION', etiqueta: 'VISION — Documento de Visión, Alcance y Casos de Uso' },
  { valor: 'SDS', etiqueta: 'SDS — Especificación de Arquitectura y Diseño de Software' },
  { valor: 'UI', etiqueta: 'UI — Modelo de Datos y Prototipos de Interfaz' },
  { valor: 'PLAN', etiqueta: 'PLAN — Código Fuente, Estándares y Plan / Bitácora SQA' },
];

const DICTAMENES = [
  { valor: 'APROBADO', etiqueta: 'Aprobado (Sin observaciones bloqueantes)' },
  { valor: 'APROBADO_CONDICIONADO', etiqueta: 'Aprobado Condicionado (Sujeto a corrección de hallazgos)' },
  { valor: 'RECHAZADO', etiqueta: 'Rechazado (Requiere retrabajo y nueva revisión)' },
];

export default function GestionActividadesSqaView({
  proyectoId,
  actividadInicialId,
  onLimpiarActividadInicial,
  onIrACU01,
  onIrACU02,
  onIrACU05,
}) {
  const [idProyectoResuelto, setIdProyectoResuelto] = useState(proyectoId || '');
  const [contexto, setContexto] = useState(null);
  const [bloqueoPrecondicion, setBloqueoPrecondicion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Actividad seleccionada y modo ('PLANIFICAR' | 'EJECUTAR' | null)
  const [actividadActiva, setActividadActiva] = useState(null);
  const [modoPanel, setModoPanel] = useState(null);

  // Estado de Planificación (PlanificacionActividadDTO)
  const [planificacion, setPlanificacion] = useState({
    actividadId: '',
    responsableId: '',
    fechaPlanificada: '',
    artefacto: '',
    tipoArtefacto: 'VISION',
    autorId: '',
    revisoresIds: [],
  });

  // Estado de Ejecución (ChecklistDTO + ResultadoItemDTO + CierreActividadDTO)
  const [datosInicio, setDatosInicio] = useState(null);
  const [resultadosChecklist, setResultadosChecklist] = useState({});
  const [dictamen, setDictamen] = useState('APROBADO');
  const [evidenciaRondaId, setEvidenciaRondaId] = useState('');
  const [evidenciaEnlace, setEvidenciaEnlace] = useState('');

  // Posibles duplicados detectados
  const [coincidenciasDuplicados, setCoincidenciasDuplicados] = useState([]);
  const [decisionesDuplicados, setDecisionesDuplicados] = useState({});

  // Acta emitida o consultada y alertas
  const [actaVisible, setActaVisible] = useState(null);
  const [alertaVisual, setAlertaVisual] = useState(null);
  const [erroresCampos, setErroresCampos] = useState({});
  const [listaErrores, setListaErrores] = useState([]);
  const [errorAlmacenamiento, setErrorAlmacenamiento] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  useEffect(() => {
    seleccionarGestionarActividades(proyectoId);
  }, [proyectoId]);

  async function resolverIdProyectoActivo(idCandidato) {
    if (idCandidato && UUID_REGEX.test(String(idCandidato)) && idCandidato !== '00000000-0000-0000-0000-000000000001') {
      return idCandidato;
    }
    try {
      const activo = await proyectosApi.obtenerProyectoPeriodoActivo();
      if (activo && activo.existe && activo.proyecto?.id) {
        return activo.proyecto.id;
      }
    } catch {
      // Continúa con el idCandidato
    }
    return idCandidato;
  }

  // Carga el plan de actividades SQA del proyecto activo.
  async function seleccionarGestionarActividades(idEntrada = idProyectoResuelto || proyectoId, silencioso = false) {
    if (!silencioso) setCargando(true);
    setBloqueoPrecondicion(null);
    setErrorAlmacenamiento(null);
    try {
      const idEfectivo = await resolverIdProyectoActivo(idEntrada);
      if (!idEfectivo || !UUID_REGEX.test(String(idEfectivo))) {
        setBloqueoPrecondicion({
          status: 404,
          mensaje: 'No hay ningún proyecto registrado y activo en el periodo en curso. Primero registre el proyecto y su plan base de QA.',
        });
        return;
      }
      setIdProyectoResuelto(idEfectivo);

      const { status, ok, data } = await actividadesApi.obtenerPlan(idEfectivo);
      if (!ok) {
        setBloqueoPrecondicion({
          status,
          mensaje: data.mensaje || 'No se cumplen las precondiciones para gestionar las actividades de aseguramiento de calidad.',
        });
        return;
      }
      setContexto(data);

      if (actividadInicialId && Array.isArray(data?.plan)) {
        const actFoco = data.plan.find((a) => a.id === actividadInicialId);
        if (actFoco) {
          if (actFoco.estado === 'REALIZADA' && actFoco.tipo === 'REVISION_PARES' && actFoco.actaId) {
            handleVerActaExistente(actFoco);
          } else if (actFoco.estado !== 'REALIZADA') {
            onSeleccionarActividad(actFoco);
          }
        }
        if (onLimpiarActividadInicial) onLimpiarActividadInicial();
      }
    } catch (err) {
      mostrarErrorAlmacenamiento(err.message);
    } finally {
      if (!silencioso) setCargando(false);
    }
  }

  // Resalta los campos con error devueltos por ValidadorActividad
  function resaltarDatosFaltantes(errores = []) {
    const mapa = {};
    for (const err of errores) {
      if (err && err.campo) {
        mapa[err.campo] = err.mensaje;
      }
    }
    setErroresCampos(mapa);
    setListaErrores(errores);
  }

  function mostrarErrorAlmacenamiento(mensaje) {
    setErrorAlmacenamiento(mensaje);
  }

  function lanzarAlertaVisualApp(alerta) {
    setAlertaVisual(alerta);
  }

  function mostrarActa(acta) {
    setActaVisible(acta);
  }

  function notificarPosiblesDuplicados(coincidencias = []) {
    setCoincidenciasDuplicados(coincidencias);
    const inicial = {};
    for (const c of coincidencias) {
      const primerFolio = c.coincidencias?.[0]?.folio || null;
      inicial[c.itemId] = {
        accion: 'DESCARTAR',
        folioExistente: primerFolio,
      };
    }
    setDecisionesDuplicados(inicial);
  }

  // Selecciona una actividad del plan para planificarla.
  function onSeleccionarActividad(act) {
    setActividadActiva(act);
    setModoPanel('PLANIFICAR');
    setDatosInicio(null);
    setCoincidenciasDuplicados([]);
    setErroresCampos({});
    setListaErrores([]);
    setMensajeExito(null);
    setErrorAlmacenamiento(null);

    const hoyIso = new Date().toISOString().slice(0, 10);
    const listaMiembros = contexto?.miembros || [];
    const respSugerido = act.responsableId || listaMiembros.find((m) => m.rol === act.rolResponsable)?.id || '';
    setPlanificacion({
      actividadId: act.id,
      responsableId: respSugerido,
      fechaPlanificada: act.fechaPlanificada || hoyIso,
      artefacto: act.artefacto || '',
      tipoArtefacto: act.tipoArtefacto || 'VISION',
      autorId: act.autorId || '',
      revisoresIds: Array.isArray(act.revisoresIds) ? act.revisoresIds : [],
    });
  }

  function handleToggleRevisor(miembroId) {
    setPlanificacion((prev) => {
      const existe = prev.revisoresIds.includes(miembroId);
      const nuevos = existe
        ? prev.revisoresIds.filter((id) => id !== miembroId)
        : [...prev.revisoresIds, miembroId];
      return { ...prev, revisoresIds: nuevos };
    });
  }

  // Envía la planificación de la actividad seleccionada.
  async function onPlanificar(e) {
    if (e) e.preventDefault();
    if (!actividadActiva) return;

    setEnviando(true);
    setErroresCampos({});
    setListaErrores([]);
    setErrorAlmacenamiento(null);
    setMensajeExito(null);

    try {
      const { ok, data } = await actividadesApi.planificar(idProyectoResuelto, planificacion);
      if (!ok || data.valido === false) {
        resaltarDatosFaltantes(data.errores || [{ campo: 'general', mensaje: data.mensaje || 'Datos de planificación inválidos.' }]);
        return;
      }

      setMensajeExito(`Planificación guardada para «${data.actividad.nombre}» (${data.actividad.fechaPlanificada}).`);
      await seleccionarGestionarActividades(idProyectoResuelto, true);
      setActividadActiva(data.actividad);
      setModoPanel(null);
    } catch (err) {
      mostrarErrorAlmacenamiento(err.message);
    } finally {
      setEnviando(false);
    }
  }

  // Inicia la ejecución de una actividad y presenta el checklist ítem por ítem (o solicita evidencia en PRUEBAS/AUDITORIA).
  async function onIniciarActividad(act) {
    setActividadActiva(act);
    setModoPanel('EJECUTAR');
    setCoincidenciasDuplicados([]);
    setErroresCampos({});
    setListaErrores([]);
    setMensajeExito(null);
    setErrorAlmacenamiento(null);
    setEnviando(true);

    try {
      const { ok, data } = await actividadesApi.iniciar(act.id);
      if (!ok) {
        resaltarDatosFaltantes([{ campo: 'general', mensaje: data.mensaje || 'No se pudo iniciar la actividad.' }]);
        return;
      }
      setDatosInicio(data);

      if (Array.isArray(data.items) && data.items.length > 0) {
        const mapaInicial = {};
        for (const it of data.items) {
          mapaInicial[it.id] = {
            itemId: it.id,
            descripcionItem: it.descripcion,
            cumple: true,
            observacion: '',
            severidad: 'MEDIA',
            prioridad: 'MEDIA',
          };
        }
        setResultadosChecklist(mapaInicial);
      } else {
        setResultadosChecklist({});
      }

      const primeraRonda = data.rondasDisponibles?.[0]?.id || contexto?.rondasPruebas?.[0]?.id || '';
      setEvidenciaRondaId(primeraRonda);
      setEvidenciaEnlace(act.evidenciaUrl || '');
      await seleccionarGestionarActividades(idProyectoResuelto, true);
    } catch (err) {
      mostrarErrorAlmacenamiento(err.message);
    } finally {
      setEnviando(false);
    }
  }

  // Marca un ítem del checklist como "cumple" o "no cumple".
  function onMarcarItem(itemId, cumple, descripcionItem = '') {
    setResultadosChecklist((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { severidad: 'MEDIA', prioridad: 'MEDIA', observacion: '' }),
        itemId,
        descripcionItem: descripcionItem || prev[itemId]?.descripcionItem || '',
        cumple,
      },
    }));
  }

  // Captura la observación, severidad y prioridad de un ítem marcado como "no cumple".
  function onCapturarHallazgo(itemId, observacion, severidad, prioridad) {
    setResultadosChecklist((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        itemId,
        cumple: false,
        observacion,
        severidad,
        prioridad,
      },
    }));
  }

  // Confirma el cierre de una revisión por pares.
  async function onConfirmarCierre(dictamenElegido = dictamen, conDecisionDuplicados = false) {
    if (!actividadActiva) return;
    setEnviando(true);
    setErroresCampos({});
    setListaErrores([]);
    setErrorAlmacenamiento(null);

    const listaResultados = Object.values(resultadosChecklist).map((r) => {
      if (!conDecisionDuplicados || !decisionesDuplicados[r.itemId]) {
        return r;
      }
      const dec = decisionesDuplicados[r.itemId];
      if (dec.accion === 'DESCARTAR') {
        return {
          ...r,
          descartarPorDuplicado: true,
          confirmarIncidenciaDistinta: false,
          folioDefectoExistente: dec.folioExistente,
        };
      }
      return {
        ...r,
        descartarPorDuplicado: false,
        confirmarIncidenciaDistinta: true,
      };
    });

    // Validación local antes de enviar
    const erroresLocales = [];
    for (const item of listaResultados) {
      if (item.cumple === false) {
        if (!item.observacion || !item.observacion.trim()) {
          erroresLocales.push({
            campo: `observacion:${item.itemId}`,
            mensaje: 'Debe describir la observación para este criterio que no cumple.',
          });
        }
        if (!item.severidad) {
          erroresLocales.push({
            campo: `severidad:${item.itemId}`,
            mensaje: 'Seleccione la severidad del hallazgo.',
          });
        }
        if (!item.prioridad) {
          erroresLocales.push({
            campo: `prioridad:${item.itemId}`,
            mensaje: 'Seleccione la prioridad del hallazgo.',
          });
        }
      }
    }

    if (erroresLocales.length > 0) {
      resaltarDatosFaltantes(erroresLocales);
      setEnviando(false);
      return;
    }

    try {
      const { ok, data } = await actividadesApi.cerrar(actividadActiva.id, {
        actividadId: actividadActiva.id,
        dictamen: dictamenElegido,
        resultados: listaResultados,
      });

      if (!ok) {
        resaltarDatosFaltantes(data.errores || [{ campo: 'general', mensaje: data.mensaje || 'No se pudo cerrar la revisión.' }]);
        return;
      }

      if (data.requiereDecisionDuplicado) {
        notificarPosiblesDuplicados(data.coincidencias || []);
        return;
      }

      if (data.exito) {
        setCoincidenciasDuplicados([]);
        setModoPanel(null);
        if (data.acta) {
          mostrarActa(data.acta);
        }
        if (data.alertaEmitida) {
          lanzarAlertaVisualApp(data.alertaEmitida);
        }
        setMensajeExito(`Revisión cerrada con éxito. Acta emitida (${data.acta?.dictamen}) y métricas recalculadas.`);
        await seleccionarGestionarActividades(idProyectoResuelto, true);
      }
    } catch (err) {
      mostrarErrorAlmacenamiento(err.message);
    } finally {
      setEnviando(false);
    }
  }

  // Registra la evidencia en una actividad de PRUEBAS o AUDITORIA.
  async function handleRegistrarEvidencia(e) {
    if (e) e.preventDefault();
    if (!actividadActiva) return;

    setEnviando(true);
    setErroresCampos({});
    setListaErrores([]);
    setErrorAlmacenamiento(null);

    try {
      const { ok, data } = await actividadesApi.registrarEvidencia(actividadActiva.id, {
        actividadId: actividadActiva.id,
        evidenciaRondaId: actividadActiva.tipo === 'PRUEBAS' ? evidenciaRondaId : undefined,
        evidenciaEnlace: actividadActiva.tipo !== 'PRUEBAS' ? evidenciaEnlace : undefined,
      });

      if (!ok || !data.exito) {
        resaltarDatosFaltantes(data.errores || [{ campo: 'general', mensaje: data.mensaje || 'Evidencia incompleta o inválida.' }]);
        return;
      }

      setModoPanel(null);
      if (data.alertaEmitida) {
        lanzarAlertaVisualApp(data.alertaEmitida);
      }
      setMensajeExito(`Actividad «${actividadActiva.nombre}» registrada como REALIZADA con su evidencia.`);
      await seleccionarGestionarActividades(idProyectoResuelto, true);
    } catch (err) {
      mostrarErrorAlmacenamiento(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function handleVerActaExistente(act) {
    setErrorAlmacenamiento(null);
    try {
      const { ok, data } = await actividadesApi.obtenerActa(act.id);
      if (ok && data) {
        setActividadActiva(act);
        mostrarActa(data);
      } else {
        mostrarErrorAlmacenamiento(data?.mensaje || 'Esta actividad no cuenta con un acta formal emitida.');
      }
    } catch (err) {
      mostrarErrorAlmacenamiento(err.message);
    }
  }

  if (cargando) {
    return <p className="text-sm text-slate-500">Cargando plan de actividades SQA del proyecto...</p>;
  }

  if (bloqueoPrecondicion) {
    return (
      <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900 shadow-sm">
        <h2 className="text-base font-bold">Requisito previo pendiente</h2>
        <p className="mt-1 text-sm">{bloqueoPrecondicion.mensaje}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {bloqueoPrecondicion.status === 404 && onIrACU01 && (
            <button
              type="button"
              onClick={onIrACU01}
              className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800"
            >
              Ir a Registro de Proyecto y Plan QA
            </button>
          )}
          {bloqueoPrecondicion.status === 409 && onIrACU02 && (
            <button
              type="button"
              onClick={onIrACU02}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
            >
              Ir a Configurar Métricas y Umbrales
            </button>
          )}
          <button
            type="button"
            onClick={() => seleccionarGestionarActividades()}
            className="rounded-lg border border-amber-400 bg-white px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
          >
            Reintentar carga
          </button>
        </div>
      </div>
    );
  }

  const plan = contexto?.plan || [];
  const miembros = contexto?.miembros || [];
  const periodo = contexto?.periodo;
  const ind = contexto?.indicadores || {};
  const rondas = datosInicio?.rondasDisponibles?.length
    ? datosInicio.rondasDisponibles
    : (contexto?.rondasPruebas || []);

  const hallazgosActuales = Object.values(resultadosChecklist).filter((r) => r.cumple === false);

  return (
    <div className="space-y-6">
      {/* Encabezado de la vista */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Aseguramiento de Calidad (ISO/IEC 29110)
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Planear y Registrar Actividades SQA
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Proyecto activo: <strong>{contexto?.proyecto?.nombre}</strong> ({contexto?.proyecto?.tamanoProductoKLOC} KLOC)
              {periodo && (
                <span className="ml-2 text-slate-400">
                  | Periodo vigente: {periodo.codigo} ({String(periodo.fechaInicio).slice(0, 10)} a {String(periodo.fechaFin).slice(0, 10)})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Widget de Indicadores SQA y Semáforo */}
      <TableroSqaWidget
        cumplimientoSQA={ind.cumplimientoSQA}
        actividadesExigibles={ind.actividadesExigibles}
        actividadesRealizadas={ind.actividadesRealizadas}
        estadoCumplimiento={ind.estadoCumplimiento}
        densidadDefectos={ind.densidadDefectos}
        totalDefectos={ind.totalDefectos}
        estadoDensidad={ind.estadoDensidad}
        nivelSemaforo={ind.nivelSemaforo}
      />

      {/* Alertas de almacenamiento, alertas de umbral y confirmación */}
      {errorAlmacenamiento && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <strong className="font-bold">Error de almacenamiento: </strong>
          {errorAlmacenamiento}
        </div>
      )}

      {alertaVisual && (
        <div role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 shadow-xs">
          <div className="flex items-center justify-between">
            <strong className="font-bold">⚠ Alerta de Calidad Emitida:</strong>
            <button
              type="button"
              onClick={() => setAlertaVisual(null)}
              className="text-xs font-semibold text-amber-800 hover:underline"
            >
              Ocultar
            </button>
          </div>
          <p className="mt-1">{alertaVisual.mensajeAlerta}</p>
        </div>
      )}

      {mensajeExito && (
        <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
          ✔ {mensajeExito}
        </div>
      )}

      {/* Acta de Revisión por Pares emitida o consultada */}
      {actaVisible && (
        <ActaRevisionWidget
          acta={actaVisible}
          actividad={actividadActiva}
          onCerrarVista={() => setActaVisible(null)}
          onReevaluar={(act) => onIniciarActividad(act)}
        />
      )}

      {/* Panel Interactivo de Planificación */}
      {modoPanel === 'PLANIFICAR' && actividadActiva && (
        <form
          onSubmit={onPlanificar}
          noValidate
          className="rounded-xl border-2 border-blue-200 bg-white p-6 shadow-sm space-y-4"
        >
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Planificación de Actividad SQA
              </span>
              <h3 className="text-base font-bold text-slate-900">
                {actividadActiva.nombre}
              </h3>
              <p className="text-xs text-slate-500">
                {FASES_ETIQUETAS[actividadActiva.fase] || actividadActiva.fase} — Rol sugerido: <strong>{actividadActiva.rolResponsable}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModoPanel(null)}
              className="self-start rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>

          {listaErrores.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
              <p className="font-bold">Corrija los siguientes datos de planificación:</p>
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                {listaErrores.map((e, i) => (
                  <li key={i}>{e.mensaje}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="resp-sqa" className="block text-xs font-bold text-slate-700">
                Responsable de la Actividad *
              </label>
              <select
                id="resp-sqa"
                value={planificacion.responsableId}
                onChange={(e) => setPlanificacion({ ...planificacion, responsableId: e.target.value })}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${
                  erroresCampos.responsableId ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
                }`}
              >
                <option value="">— Seleccione un miembro del equipo —</option>
                {miembros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} ({m.rol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fecha-plan-sqa" className="block text-xs font-bold text-slate-700">
                Fecha Planificada *
              </label>
              <input
                id="fecha-plan-sqa"
                type="date"
                value={planificacion.fechaPlanificada}
                onChange={(e) => setPlanificacion({ ...planificacion, fechaPlanificada: e.target.value })}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${
                  erroresCampos.fechaPlanificada ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
                }`}
              />
            </div>

            <div>
              <label htmlFor="artefacto-sqa" className="block text-xs font-bold text-slate-700">
                Artefacto / Producto de Trabajo *
              </label>
              <input
                id="artefacto-sqa"
                type="text"
                value={planificacion.artefacto}
                onChange={(e) => setPlanificacion({ ...planificacion, artefacto: e.target.value })}
                placeholder="Ej. Especificación SDS v1.0, Módulo Pruebas..."
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${
                  erroresCampos.artefacto ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
                }`}
              />
            </div>
          </div>

          {actividadActiva.tipo === 'REVISION_PARES' ? (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-purple-100 bg-purple-50/40 p-4 sm:grid-cols-3">
              <div>
                <label htmlFor="tipo-artefacto-sqa" className="block text-xs font-bold text-slate-700">
                  Plantilla de Checklist Asociada
                </label>
                <select
                  id="tipo-artefacto-sqa"
                  value={planificacion.tipoArtefacto}
                  onChange={(e) => setPlanificacion({ ...planificacion, tipoArtefacto: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  {TIPOS_ARTEFACTO.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="autor-sqa" className="block text-xs font-bold text-slate-700">
                  Autor del Artefacto (Recibe defectos) *
                </label>
                <select
                  id="autor-sqa"
                  value={planificacion.autorId}
                  onChange={(e) => setPlanificacion({ ...planificacion, autorId: e.target.value })}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${
                    erroresCampos.autorId ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
                  }`}
                >
                  <option value="">— Seleccione al autor —</option>
                  {miembros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} ({m.rol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700">
                  Revisores Pares (Al menos 1 distinto del autor) *
                </span>
                <div className={`mt-1 space-y-1 rounded-lg border p-2 bg-white ${
                  erroresCampos.revisoresIds ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}>
                  {miembros.map((m) => {
                    const esAutor = planificacion.autorId === m.id;
                    const marcado = planificacion.revisoresIds.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => handleToggleRevisor(m.id)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>
                          {m.nombre} <span className="text-[10px] text-slate-400">({m.rol})</span>
                          {esAutor && <span className="ml-1 text-[10px] font-bold text-amber-700">[Autor]</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
              ℹ️ <strong>Actividad de {actividadActiva.tipo === 'PRUEBAS' ? 'Pruebas' : 'Auditoría'}:</strong> No requiere asignar autor ni revisores ni checklist de revisión por pares.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-blue-700 px-5 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {enviando ? 'Guardando...' : 'Guardar Planificación'}
            </button>
          </div>
        </form>
      )}

      {/* Panel Interactivo de Ejecución y Cierre */}
      {modoPanel === 'EJECUTAR' && actividadActiva && (
        <div className="rounded-xl border-2 border-emerald-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Ejecución y Cierre de Actividad SQA
              </span>
              <h3 className="text-base font-bold text-slate-900">
                {actividadActiva.nombre}
              </h3>
              <p className="text-xs text-slate-500">
                Artefacto: <strong>{actividadActiva.artefacto || 'Sin especificar'}</strong>
                {actividadActiva.responsableNombre && (
                  <span> | Responsable: <strong>{actividadActiva.responsableNombre}</strong></span>
                )}
                {actividadActiva.autorNombre && (
                  <span> | Autor: <strong>{actividadActiva.autorNombre}</strong></span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModoPanel(null)}
              className="self-start rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cerrar panel
            </button>
          </div>

          {listaErrores.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
              <p className="font-bold">No es posible completar el cierre hasta corregir lo siguiente:</p>
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                {listaErrores.map((e, i) => (
                  <li key={i}>{e.mensaje}</li>
                ))}
              </ul>
            </div>
          )}

          {actividadActiva.tipo === 'REVISION_PARES' ? (
            <>
              <ChecklistWidget
                nombreChecklist={datosInicio?.nombreChecklist}
                descripcionChecklist={datosInicio?.descripcionChecklist}
                items={datosInicio?.items || []}
                resultados={resultadosChecklist}
                erroresCampos={erroresCampos}
                onMarcarItem={onMarcarItem}
                onCapturarHallazgo={onCapturarHallazgo}
              />

              {/* Alerta interactiva de posibles defectos duplicados */}
              {coincidenciasDuplicados.length > 0 && (
                <div role="alert" className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-amber-950">
                      ⚠ Posibles Defectos Duplicados Detectados
                    </h4>
                    <p className="text-xs text-amber-900">
                      Uno o más hallazgos coinciden con defectos previamente registrados en la misma fase. Para cada hallazgo elija si desea <strong>descartar el defecto nuevo</strong> (referenciando el folio existente en el acta) o <strong>confirmar que es una incidencia distinta</strong>:
                    </p>
                  </div>

                  {coincidenciasDuplicados.map((dup) => {
                    const dec = decisionesDuplicados[dup.itemId] || {
                      accion: 'DESCARTAR',
                      folioExistente: dup.coincidencias?.[0]?.folio,
                    };
                    return (
                      <div key={dup.itemId} className="rounded-lg border border-amber-300 bg-white p-3 text-xs space-y-2">
                        <p className="font-bold text-slate-900">
                          Hallazgo capturado: «{dup.observacion}»
                        </p>
                        <div className="space-y-1 text-slate-600">
                          {dup.coincidencias.map((c) => (
                            <div key={c.defectoExistenteId} className="rounded bg-slate-50 px-2.5 py-1">
                              Coincidencia ({c.porcentajeSimilitud}% similitud): <strong>{c.folio}</strong> — {c.descripcionResumen} [{c.severidad}]
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-3 pt-1">
                          <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                            <input
                              type="radio"
                              name={`dup-${dup.itemId}`}
                              checked={dec.accion === 'DESCARTAR'}
                              onChange={() =>
                                setDecisionesDuplicados((prev) => ({
                                  ...prev,
                                  [dup.itemId]: { ...dec, accion: 'DESCARTAR' },
                                }))
                              }
                            />
                            Descartar nuevo y referenciar folio existente ({dec.folioExistente}) en el acta
                          </label>
                          <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                            <input
                              type="radio"
                              name={`dup-${dup.itemId}`}
                              checked={dec.accion === 'CONFIRMAR'}
                              onChange={() =>
                                setDecisionesDuplicados((prev) => ({
                                  ...prev,
                                  [dup.itemId]: { ...dec, accion: 'CONFIRMAR' },
                                }))
                              }
                            />
                            Confirmar que es una incidencia distinta (registrar nuevo defecto)
                          </label>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => onConfirmarCierre(dictamen, true)}
                      className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800"
                    >
                      Confirmar Decisión y Emitir Acta
                    </button>
                  </div>
                </div>
              )}

              {/* Resumen y selección del Dictamen de la Revisión */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label htmlFor="dictamen-revision" className="block text-xs font-bold uppercase text-slate-700">
                      Dictamen Formal de la Revisión por Pares *
                    </label>
                    <p className="mb-1.5 text-xs text-slate-500">
                      Resumen actual: <strong>{hallazgosActuales.length}</strong> hallazgo(s) («No cumple») que generarán defectos asignados al autor del artefacto.
                    </p>
                    <select
                      id="dictamen-revision"
                      value={dictamen}
                      onChange={(e) => setDictamen(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                    >
                      {DICTAMENES.map((d) => (
                        <option key={d.valor} value={d.valor}>{d.etiqueta}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => onConfirmarCierre(dictamen, false)}
                    className="rounded-lg bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {enviando ? 'Procesando cierre...' : 'Confirmar Cierre y Emitir Acta'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Ejecución de actividad de PRUEBAS o AUDITORIA */
            <form onSubmit={handleRegistrarEvidencia} noValidate className="space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                <h4 className="text-sm font-bold text-slate-900">
                  Evidencia de Ejecución — {actividadActiva.tipo === 'PRUEBAS' ? 'Actividad de Pruebas' : 'Actividad de Auditoría'}
                </h4>
                <p className="mt-1 text-xs text-slate-600">
                  {actividadActiva.tipo === 'PRUEBAS'
                    ? 'Seleccione la ronda de resultados de pruebas ejecutada para vincularla como evidencia formal de esta actividad.'
                    : 'Ingrese el enlace o identificador del entregable / dictamen de auditoría para cerrar la actividad.'}
                </p>

                {actividadActiva.tipo === 'PRUEBAS' ? (
                  <div className="mt-3">
                    <label htmlFor="ronda-evidencia-sqa" className="block text-xs font-bold text-slate-700">
                      Ronda de Resultados de Pruebas Registrada *
                    </label>
                    {rondas.length === 0 ? (
                      <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                        Aún no hay rondas de pruebas registradas para este proyecto.
                        {onIrACU05 && (
                          <button
                            type="button"
                            onClick={onIrACU05}
                            className="ml-2 font-bold text-blue-700 underline"
                          >
                            Ir a Resultados de Pruebas para registrar una ronda
                          </button>
                        )}
                      </div>
                    ) : (
                      <select
                        id="ronda-evidencia-sqa"
                        value={evidenciaRondaId}
                        onChange={(e) => setEvidenciaRondaId(e.target.value)}
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${
                          erroresCampos.evidenciaRondaId ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
                        }`}
                      >
                        <option value="">— Seleccione una ronda de pruebas —</option>
                        {rondas.map((r) => (
                          <option key={r.id} value={r.id}>
                            Corte CP{r.numeroCorte} ({r.version}) — Planeadas: {r.pruebasPlaneadas}, Ejecutadas: {r.pruebasEjecutadas}, Cobertura: {r.coberturaPruebas}%, Tasa Éxito: {r.tasaExitoPruebas}%
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div className="mt-3">
                    <label htmlFor="enlace-evidencia-sqa" className="block text-xs font-bold text-slate-700">
                      Enlace o Referencia al Entregable de Auditoría *
                    </label>
                    <input
                      id="enlace-evidencia-sqa"
                      type="text"
                      value={evidenciaEnlace}
                      onChange={(e) => setEvidenciaEnlace(e.target.value)}
                      placeholder="https://repo.proyecto/auditoria-sqa-v1.pdf"
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${
                        erroresCampos.evidenciaEnlace ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
                      }`}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={enviando || (actividadActiva.tipo === 'PRUEBAS' && rondas.length === 0)}
                  className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {enviando ? 'Registrando evidencia...' : 'Registrar Evidencia y Marcar Realizada'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Tabla del Plan Base de Actividades SQA */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Catálogo de Actividades del Plan Base de QA ({plan.length})
            </h3>
            <p className="text-xs text-slate-500">
              Seleccione <strong>Planificar</strong> para asignar responsable, fecha planificada, artefacto y revisores, e <strong>Iniciar / Ejecutar</strong> para evaluar el checklist o registrar evidencia.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Corte / Fase</th>
                <th className="px-3 py-2.5">Actividad y Artefacto</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Responsable / Fecha Plan.</th>
                <th className="px-3 py-2.5">Estado / Exigibilidad</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plan.map((act) => {
                const cfgTipo = TIPOS_ACTIVIDAD_ETIQUETAS[act.tipo] || TIPOS_ACTIVIDAD_ETIQUETAS.REVISION_PARES;
                const realizada = act.estado === 'REALIZADA';
                const planificadaConDatos = Boolean(act.responsableId && act.fechaPlanificada && act.artefacto);
                const hoyIso = new Date().toISOString().slice(0, 10);
                const exigible = realizada || (act.fechaPlanificada && act.fechaPlanificada <= hoyIso);

                return (
                  <tr key={act.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-800">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px]">
                        {FASES_ETIQUETAS[act.fase] || act.fase}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-900">{act.nombre}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{act.practicaIso}</div>
                      {act.artefacto && (
                        <div className="mt-1 text-[11px] text-blue-700">
                          Artefacto: <strong>{act.artefacto}</strong>
                          {act.tipo === 'REVISION_PARES' && act.tipoArtefacto && (
                            <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold">
                              Checklist: {act.tipoArtefacto}
                            </span>
                          )}
                        </div>
                      )}
                      {act.evidenciaRef && (
                        <div className="mt-0.5 text-[11px] text-emerald-700 font-mono truncate max-w-xs">
                          Evidencia: {act.evidenciaRef}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${cfgTipo.clase}`}>
                        {cfgTipo.texto}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {act.responsableNombre ? (
                        <div>
                          <div className="font-semibold text-slate-900">{act.responsableNombre}</div>
                          <div className="text-[11px] text-slate-500">
                            Planificada: <strong>{act.fechaPlanificada || '—'}</strong>
                          </div>
                          {act.autorNombre && (
                            <div className="text-[11px] text-purple-700">
                              Autor: {act.autorNombre} ({act.revisoresIds?.length || 0} revisor[es])
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="italic text-slate-400">
                          Sin planificar (Rol base: {act.rolResponsable})
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        realizada
                          ? 'bg-emerald-100 text-emerald-800'
                          : act.estado === 'EN_CURSO'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {act.estado}
                      </span>
                      {act.dictamenActa && (
                        <div className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                          act.dictamenActa === 'APROBADO'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : act.dictamenActa === 'APROBADO_CONDICIONADO'
                            ? 'bg-amber-50 text-amber-800 border border-amber-300'
                            : 'bg-red-50 text-red-700 border border-red-300'
                        }`}>
                          Dictamen: {act.dictamenActa === 'APROBADO_CONDICIONADO' ? 'CONDICIONADO' : act.dictamenActa}
                        </div>
                      )}
                      {exigible && (
                        <div className="mt-1 text-[10px] font-semibold text-indigo-700">
                          ● Exigible a la fecha
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right space-x-1.5">
                      {act.tipo === 'REVISION_PARES' && act.actaId && (
                        <button
                          type="button"
                          onClick={() => handleVerActaExistente(act)}
                          className="rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
                        >
                          📄 Ver Acta
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onSeleccionarActividad(act)}
                        className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 hover:bg-blue-100"
                      >
                        {planificadaConDatos ? '✎ Editar Plan' : '📅 Planificar'}
                      </button>
                      <button
                        type="button"
                        disabled={!planificadaConDatos}
                        title={!planificadaConDatos ? 'Primero planifique responsable, fecha y artefacto' : ((realizada || act.actaId) ? 'Volver a evaluar esta actividad tras correcciones' : 'Iniciar ejecución')}
                        onClick={() => onIniciarActividad(act)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ${
                          (realizada || act.actaId)
                            ? (act.dictamenActa === 'RECHAZADO'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : act.dictamenActa === 'APROBADO_CONDICIONADO'
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {(realizada || act.actaId) ? '🔄 Re-evaluar' : '▶ Ejecutar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
