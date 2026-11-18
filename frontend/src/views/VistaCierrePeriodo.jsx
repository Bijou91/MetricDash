import React, { useEffect, useState } from 'react';
import * as api from '../api/CierrePeriodoApiClient';
import { obtenerMiembros } from '../api/AccionesCorrectivasApiClient';
import PendientesPeriodoWidget, { mostrarSinPendientes } from '../widgets/PendientesPeriodoWidget';
import RetrospectivaWidget from '../widgets/RetrospectivaWidget';
import ResumenCierreWidget from '../widgets/ResumenCierreWidget';
import DescargaCierreWidget from '../widgets/DescargaCierreWidget';

const RETRO_VACIA = { queFuncionoBien: '', queDebeMejorar: '', leccionesAprendidas: '', acuerdos: '' };

const boton = 'rounded px-3 py-2 text-sm font-semibold';
const primario = `${boton} bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50`;
const secundario = `${boton} border border-slate-300 text-slate-700 hover:bg-slate-50`;

// CU-08: Cerrar el periodo y generar la bitácora de SQA. Hasta FN-06 nada se guarda: todo vive en memoria.
export default function VistaCierrePeriodo({ proyectoId }) {
  const [paso, setPaso] = useState('cargando'); // cargando | pendientes | retrospectiva | resumen | cerrado | abandonado | bloqueado
  const [pendientes, setPendientes] = useState([]);
  const [resoluciones, setResoluciones] = useState({});
  const [retrospectiva, setRetrospectiva] = useState(RETRO_VACIA);
  const [resumen, setResumen] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [cerradoPor, setCerradoPor] = useState('');
  const [noConfirmar, setNoConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [cierreId, setCierreId] = useState(null);

  useEffect(() => {
    seleccionarCerrarPeriodo();
  }, [proyectoId]);

  // FN-01 / FN-02 / FA-02.01
  async function seleccionarCerrarPeriodo() {
    setPaso('cargando');
    setMensaje(null);
    setErrores({});
    setResoluciones({});
    setRetrospectiva(RETRO_VACIA);
    setResumen(null);
    setNoConfirmar(false);
    try {
      const [res, lista] = await Promise.all([api.obtenerPendientes(proyectoId), obtenerMiembros(proyectoId).catch(() => [])]);
      if (res.status !== 200) {
        mostrarError(res.data?.mensaje, true);
        return;
      }
      setPendientes(res.data);
      setMiembros(lista);
      setPaso(res.data.length > 0 ? 'pendientes' : 'retrospectiva');
    } catch (err) {
      mostrarError(err.message, true);
    }
  }

  // FN-03: solo en memoria.
  function resolverPendiente(registroId, opcion, justificacion) {
    setResoluciones((prev) => ({ ...prev, [registroId]: { opcion, justificacion } }));
  }

  // FA-05.01: resalta y regresa a FN-03 si faltan resoluciones, o a FN-04 si falta la retrospectiva.
  function resaltarErrores(lista) {
    const mapa = Object.fromEntries(lista.map((e) => [e.campo, e.mensaje]));
    setErrores(mapa);
    if (Object.keys(mapa).some((c) => c.startsWith('resoluciones.'))) setPaso('pendientes');
    else if (Object.keys(mapa).some((c) => c.startsWith('retrospectiva.'))) setPaso('retrospectiva');
  }

  // FE-01 / FE-02 / precondiciones
  function mostrarError(texto, bloquear = false) {
    setMensaje(texto || 'Ocurrió un error inesperado.');
    if (bloquear) setPaso('bloqueado');
  }

  const armarSolicitud = () => ({
    resoluciones: Object.entries(resoluciones).map(([registroId, r]) => ({ registroId, ...r })),
    retrospectiva,
  });

  // FN-05
  async function solicitarResumen() {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await api.validarCierre(proyectoId, armarSolicitud());
      if (res.status === 400) resaltarErrores(res.data?.errores || []);
      else if (res.status !== 200) mostrarError(res.data?.mensaje, true);
      else {
        setErrores({});
        setResumen(res.data);
        setNoConfirmar(false);
        setPaso('resumen');
      }
    } catch (err) {
      mostrarError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  // FN-06 -> FN-07..FN-09
  async function confirmarCierre() {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await api.confirmarCierre(proyectoId, { ...armarSolicitud(), cerradoPor });
      if (res.status === 201) {
        setCierreId(res.data.cierreId);
        setPaso('cerrado');
      } else if (res.status === 400) {
        resaltarErrores(res.data?.errores || []);
      } else {
        mostrarError(res.data?.mensaje, true); // FE-02: el periodo ya fue cerrado
      }
    } catch (err) {
      mostrarError(`${err.message} Puede reintentar el cierre.`); // FE-01
    } finally {
      setEnviando(false);
    }
  }

  // FA-06.01
  const revisarResoluciones = () => setPaso(pendientes.length > 0 ? 'pendientes' : 'retrospectiva');
  const abandonarCierre = () => setPaso('abandonado');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Cierre del periodo</h2>
        <p className="text-sm text-slate-500">Resuelva los pendientes, responda la retrospectiva y confirme el cierre.</p>
      </div>

      {mensaje && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{mensaje}</p>}

      {paso === 'cargando' && <p className="text-sm text-slate-500">Consultando pendientes del periodo…</p>}

      {paso === 'pendientes' && (
        <section className="space-y-3">
          <h3 className="font-semibold text-slate-700">1. Pendientes del periodo</h3>
          <PendientesPeriodoWidget pendientes={pendientes} resoluciones={resoluciones} errores={errores} onResolver={resolverPendiente} />
          <button type="button" className={primario} onClick={() => setPaso('retrospectiva')}>Continuar a la retrospectiva</button>
        </section>
      )}

      {paso === 'retrospectiva' && (
        <section className="space-y-3">
          {pendientes.length === 0 && mostrarSinPendientes()}
          <h3 className="font-semibold text-slate-700">2. Retrospectiva del periodo</h3>
          <RetrospectivaWidget retrospectiva={retrospectiva} errores={errores} onCambiar={setRetrospectiva} />
          <div className="flex gap-3">
            {pendientes.length > 0 && <button type="button" className={secundario} onClick={() => setPaso('pendientes')}>Volver a pendientes</button>}
            <button type="button" className={primario} disabled={enviando} onClick={solicitarResumen}>Ver resumen del cierre</button>
          </div>
        </section>
      )}

      {paso === 'resumen' && resumen && (
        <section className="space-y-4">
          <h3 className="font-semibold text-slate-700">3. Resumen del cierre</h3>
          <ResumenCierreWidget resumen={resumen} />
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Miembro del equipo que cierra el periodo *</span>
            <select className="mt-1 block w-full rounded border border-slate-300 p-2 sm:w-80" value={cerradoPor} onChange={(e) => setCerradoPor(e.target.value)}>
              <option value="">Seleccione…</option>
              {miembros.map((m) => <option key={m.id} value={m.id}>{m.member_name} ({m.role})</option>)}
            </select>
            {errores.cerradoPor && <span className="text-xs font-medium text-red-700">{errores.cerradoPor}</span>}
          </label>
          {!noConfirmar ? (
            <div className="flex gap-3">
              <button type="button" className={primario} disabled={enviando || !cerradoPor} onClick={confirmarCierre}>
                {enviando ? 'Cerrando…' : 'Confirmar cierre del periodo'}
              </button>
              <button type="button" className={secundario} onClick={() => setNoConfirmar(true)}>No confirmar</button>
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="text-amber-800">No se guardó ningún cambio. ¿Qué desea hacer?</p>
              <div className="mt-2 flex gap-3">
                <button type="button" className={secundario} onClick={revisarResoluciones}>Revisar las resoluciones</button>
                <button type="button" className={secundario} onClick={abandonarCierre}>Abandonar el cierre</button>
              </div>
            </div>
          )}
        </section>
      )}

      {paso === 'cerrado' && <DescargaCierreWidget cierreId={cierreId} />}

      {paso === 'abandonado' && (
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p>Se abandonó el cierre sin guardar cambios; el periodo permanece abierto.</p>
          <button type="button" className={`${secundario} mt-2`} onClick={seleccionarCerrarPeriodo}>Iniciar de nuevo</button>
        </div>
      )}
    </div>
  );
}
