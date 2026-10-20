import React, { useEffect, useState } from 'react';
import * as api from '../api/MetricasApiClient';
import SemaforoPreviewWidget from './SemaforoPreviewWidget';
import { ETIQUETAS, CAMPOS } from './metricas';

const formularioVacio = () =>
  Object.keys(ETIQUETAS).map((tipo) => ({ tipo, meta: '', umbralAdvertencia: '', umbralCritico: '' }));

// Los inputs guardan texto; vacío se manda como null para que el backend lo marque como faltante.
const aDTO = (metricas) => ({
  metricas: metricas.map((m) => ({
    tipo: m.tipo,
    ...Object.fromEntries(CAMPOS.map(([c]) => [c, m[c] === '' ? null : Number(m[c])])),
  })),
});

export default function ConfigMetricasView({ proyectoId }) {
  const [metricas, setMetricas] = useState(formularioVacio);
  const [errores, setErrores] = useState([]);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [version, setVersion] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // FN-01
  useEffect(() => {
    api.obtenerVigente(proyectoId)
      .then(cargarConfiguracionVigente)
      .catch((e) => setMensaje({ tipo: 'error', texto: e.message }));
  }, [proyectoId]);

  function cargarConfiguracionVigente(config) {
    if (!config) return;
    setVersion(config.version);
    setMetricas(formularioVacio().map((vacia) => {
      const m = config.metricas.find((x) => x.tipo === vacia.tipo);
      return m ? { tipo: m.tipo, meta: String(m.meta), umbralAdvertencia: String(m.umbralAdvertencia), umbralCritico: String(m.umbralCritico) } : vacia;
    }));
  }

  // FN-02: cualquier cambio invalida la vista previa ya confirmable.
  function onCambiarCampo(tipo, campo, valor) {
    setMetricas((ms) => ms.map((m) => (m.tipo === tipo ? { ...m, [campo]: valor } : m)));
    setVistaPrevia(null);
    setMensaje(null);
  }

  function resaltarErrores(errs) {
    setErrores(errs);
    setVistaPrevia(null);
  }

  // FN-03 / FN-04
  async function onPrevisualizar() {
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await api.validar(proyectoId, aDTO(metricas));
      if (!r.valido) {
        resaltarErrores(r.errores);
        setMensaje({ tipo: 'error', texto: 'Corrija los campos resaltados antes de continuar.' });
        return;
      }
      setErrores([]);
      setVistaPrevia(r.vistaPrevia);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    } finally {
      setOcupado(false);
    }
  }

  // FN-05 / FN-06 / FN-07
  async function onConfirmar() {
    setOcupado(true);
    try {
      const r = await api.guardar(proyectoId, aDTO(metricas));
      if (r.valido === false) {
        resaltarErrores(r.errores);
        setMensaje({ tipo: 'error', texto: 'Corrija los campos resaltados antes de continuar.' });
        return;
      }
      mostrarConfirmacion(r);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `${e.message}` });
    } finally {
      setOcupado(false);
    }
  }

  function mostrarConfirmacion(config) {
    setVersion(config.version);
    setMensaje({ tipo: 'ok', texto: `Configuración guardada como versión ${config.version}.` });
  }

  const erroresDe = (tipo, campo) => errores.filter((e) => e.tipoMetrica === tipo && e.campo === campo);
  const erroresGenerales = errores.filter((e) => !e.tipoMetrica || e.campo === 'tipo');

  return (
    <section>
      <h2 className="text-xl font-bold">Métricas de calidad y umbrales</h2>
      <p className="mb-3 text-slate-500">{version ? `Versión vigente: ${version}` : 'Sin configuración previa.'}</p>

      {mensaje && (
        <p role={mensaje.tipo === 'error' ? 'alert' : 'status'}
          className={`mb-3 rounded-md px-3 py-2 ${mensaje.tipo === 'error' ? 'bg-red-100' : 'bg-green-100'}`}>
          {mensaje.texto}
        </p>
      )}
      {erroresGenerales.length > 0 && (
        <ul role="alert" className="mb-3 list-disc pl-5 text-red-700">
          {erroresGenerales.map((e, i) => <li key={i}>{e.tipoMetrica ? `${ETIQUETAS[e.tipoMetrica]?.nombre ?? e.tipoMetrica}: ` : ''}{e.mensaje}</li>)}
        </ul>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-2">Métrica</th>
              {CAMPOS.map(([c, etiqueta]) => <th key={c} className="py-2 pr-2">{etiqueta}</th>)}
            </tr>
          </thead>
          <tbody>
            {metricas.map((m) => (
              <tr key={m.tipo} className="border-t border-slate-200 align-top">
                <td className="py-2 pr-2">
                  <div>{ETIQUETAS[m.tipo].nombre} <small>({ETIQUETAS[m.tipo].unidad})</small></div>
                  <small className="text-slate-500">{ETIQUETAS[m.tipo].ayuda}</small>
                </td>
                {CAMPOS.map(([campo, etiqueta]) => {
                  const errs = erroresDe(m.tipo, campo);
                  const id = `${m.tipo}-${campo}`;
                  return (
                    <td key={campo} className="py-2 pr-2">
                      <input id={id} type="number" step="any" value={m[campo]}
                        aria-label={`${etiqueta} de ${ETIQUETAS[m.tipo].nombre}`}
                        aria-invalid={errs.length > 0}
                        aria-describedby={errs.length ? `${id}-err` : undefined}
                        onChange={(e) => onCambiarCampo(m.tipo, campo, e.target.value)}
                        className={`w-24 rounded border p-1 ${errs.length ? 'border-red-600 bg-red-50' : 'border-slate-300 bg-white'}`} />
                      {errs.length > 0 && <div id={`${id}-err`} className="text-xs text-red-700">{errs.map((e) => e.mensaje).join(' ')}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-3">
        <button type="button" onClick={onPrevisualizar} disabled={ocupado}
          className="rounded border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50 disabled:opacity-50">
          Previsualizar
        </button>
        <button type="button" onClick={onConfirmar} disabled={ocupado || !vistaPrevia}
          className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50">
          Confirmar y guardar
        </button>
      </div>

      {vistaPrevia && <SemaforoPreviewWidget vistaPrevia={vistaPrevia} />}
    </section>
  );
}
