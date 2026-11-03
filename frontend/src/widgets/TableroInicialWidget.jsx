import React, { useEffect, useState } from 'react';
import * as accionesApi from '../api/AccionesCorrectivasApiClient';
import AlertaDeterioroWidget from './AlertaDeterioroWidget';

const ESTILOS_ESTADO = {
  VERDE_OPTIMO: { texto: 'ÓPTIMO', badge: 'bg-green-600 text-white', textoValor: 'text-green-700', card: 'border-green-200 bg-green-50/40' },
  VERDE: { texto: 'ÓPTIMO', badge: 'bg-green-600 text-white', textoValor: 'text-green-700', card: 'border-green-200 bg-green-50/40' },
  AMARILLO_ADVERTENCIA: { texto: 'ADVERTENCIA', badge: 'bg-yellow-600 text-white', textoValor: 'text-yellow-700', card: 'border-yellow-200 bg-yellow-50/40' },
  AMARILLO: { texto: 'ADVERTENCIA', badge: 'bg-yellow-600 text-white', textoValor: 'text-yellow-700', card: 'border-yellow-200 bg-yellow-50/40' },
  ROJO_CRITICO: { texto: 'CRÍTICO', badge: 'bg-red-600 text-white', textoValor: 'text-red-700', card: 'border-red-200 bg-red-50/40' },
  ROJO: { texto: 'CRÍTICO', badge: 'bg-red-600 text-white', textoValor: 'text-red-700', card: 'border-red-200 bg-red-50/40' },
  SIN_DATOS: { texto: 'SIN_DATOS', badge: 'bg-slate-200 text-slate-600', textoValor: 'text-slate-400', card: 'border-slate-200 bg-slate-50/60' },
};

function TarjetaIndicador({ titulo, valorTexto, estado = 'SIN_DATOS' }) {
  const cfg = ESTILOS_ESTADO[estado] || ESTILOS_ESTADO.SIN_DATOS;
  return (
    <div className={`rounded border p-2.5 text-center ${cfg.card}`}>
      <span className="text-xs font-medium text-slate-600">{titulo}</span>
      <div className={`mt-1 text-sm font-bold ${cfg.textoValor}`}>{valorTexto}</div>
      <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${cfg.badge}`}>
        {cfg.texto}
      </span>
    </div>
  );
}

export default function TableroInicialWidget({ tablero, lineaBase, onIrACU06 }) {
  const [corteSeleccionadoId, setCorteSeleccionadoId] = useState('CONSOLIDADO');
  const [alertasDeterioro, setAlertasDeterioro] = useState([]);
  const [accionesSeguimiento, setAccionesSeguimiento] = useState([]);

  const proyectoId = tablero?.project_id || tablero?.proyectoId || lineaBase?.project_id;

  useEffect(() => {
    if (proyectoId) {
      accionesApi.obtenerAlertas(proyectoId)
        .then((res) => {
          const act = (res.data?.alertas || []).filter((a) => a.estado === 'ACTIVA' || a.estado === 'EN_PROCESO');
          setAlertasDeterioro(act);
        })
        .catch(() => {});

      accionesApi.obtenerAccionesCorrectivas(proyectoId)
        .then((res) => {
          const abiertas = (res.data?.acciones || []).filter((a) => a.estado === 'abierta');
          setAccionesSeguimiento(abiertas);
        })
        .catch(() => {});
    }
  }, [proyectoId]);

  if (!tablero && !lineaBase) return null;

  const cortes = Array.isArray(tablero?.cortes) ? tablero.cortes : [];
  const corteActivo = corteSeleccionadoId === 'CONSOLIDADO'
    ? null
    : cortes.find((c) => c.id === corteSeleccionadoId) || null;

  const kloc = corteActivo?.kloc || tablero?.kloc || lineaBase?.kloc || 0;
  const plannedActs = corteActivo?.planned_sqa_acts ?? tablero?.plannedSqaActs ?? tablero?.planned_sqa_acts ?? lineaBase?.plannedSqaActs ?? 0;
  const executedActs = corteActivo?.executed_sqa_acts ?? tablero?.executedSqaActs ?? tablero?.executed_sqa_acts ?? 0;
  const healthStatus = corteActivo
    ? (corteActivo.health_status || 'SIN_DATOS')
    : (tablero?.healthStatus || tablero?.health_status || 'SIN_DATOS');
  const fechaAprobacion = lineaBase?.approvalDate || lineaBase?.approval_date;
  const cfgGlobal = ESTILOS_ESTADO[healthStatus] || ESTILOS_ESTADO.SIN_DATOS;

  const ind = corteActivo ? (corteActivo.indicadores || {}) : (tablero?.indicadores || {});
  const densidadVal = ind.densidadDefectos?.valor != null ? `${ind.densidadDefectos.valor} def/KLOC` : '0.0 def/KLOC';
  const coberturaVal = ind.coberturaPruebas?.valor != null ? `${ind.coberturaPruebas.valor}%` : '0.0%';
  const tasaVal = ind.tasaExitoPruebas?.valor != null ? `${ind.tasaExitoPruebas.valor}%` : '0.0%';
  const cumplimientoVal = ind.cumplimientoSqa?.valor != null ? `${ind.cumplimientoSqa.valor}%` : '0.0%';

  const tituloCorte = corteActivo
    ? `Corte ${corteActivo.cutoff_number} (${corteActivo.cutoff_name})`
    : 'Vista Consolidada del Proyecto';

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-slate-800">
              Tablero de Control de Calidad — {tituloCorte}
            </h3>
            <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${cfgGlobal.badge}`}>
              {cfgGlobal.texto}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Línea base de aseguramiento de calidad aprobada formalmente. Seleccione un corte para inspeccionar su estado e indicadores.
          </p>
        </div>

        {cortes.length > 0 && (
          <div className="flex flex-col sm:items-end">
            <label htmlFor="selector-corte-tablero" className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Consultar Corte de Evaluación
            </label>
            <select
              id="selector-corte-tablero"
              value={corteSeleccionadoId}
              onChange={(e) => setCorteSeleccionadoId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:bg-white focus:outline-none"
            >
              <option value="CONSOLIDADO">
                📊 Consolidado Actual ({(ESTILOS_ESTADO[tablero?.health_status] || ESTILOS_ESTADO.SIN_DATOS).texto})
              </option>
              {cortes.map((c) => {
                const est = ESTILOS_ESTADO[c.health_status] || ESTILOS_ESTADO.SIN_DATOS;
                return (
                  <option key={c.id} value={c.id}>
                    Corte {c.cutoff_number}: {c.cutoff_name} — [{est.texto}]
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* FN-02: Alertas de Deterioro Visibles en el Tablero */}
      {alertasDeterioro.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
              <span>⚠</span> Alertas Activas de Deterioro ({alertasDeterioro.length})
            </span>
            {onIrACU06 && (
              <button
                type="button"
                onClick={onIrACU06}
                className="text-xs font-bold text-blue-700 hover:underline"
              >
                Gestionar en Acciones Correctivas ➔
              </button>
            )}
          </div>
          {alertasDeterioro.map((alerta) => (
            <AlertaDeterioroWidget
              key={alerta.id}
              alerta={alerta}
              onIniciarAccion={onIrACU06}
            />
          ))}
        </div>
      )}

      {/* FN-06: Seguimiento de Acciones Correctivas en el Tablero */}
      {accionesSeguimiento.length > 0 && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50/60 p-3">
          <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <span>📋</span> Acciones Correctivas en Seguimiento ({accionesSeguimiento.length})
            </span>
            {onIrACU06 && (
              <button
                type="button"
                onClick={onIrACU06}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Ver detalle
              </button>
            )}
          </div>
          <div className="mt-2 divide-y divide-blue-100">
            {accionesSeguimiento.map((acc) => (
              <div key={acc.id} className="py-2 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <span className="font-bold text-slate-800">[{acc.tipoMetrica}]</span>{' '}
                  <span className="text-slate-700">{acc.descripcion}</span>
                </div>
                <div className="text-slate-500 shrink-0">
                  Resp: <strong className="text-blue-900">{acc.responsableNombre || 'Asignado'}</strong> | Compromiso: <strong>{acc.fechaCompromiso}</strong> | Estado: <span className="font-bold text-amber-700">{acc.estado}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumen rápido del estado de todos los cortes */}
      {cortes.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-1">
            Estado por Corte:
          </span>
          {cortes.map((c) => {
            const est = ESTILOS_ESTADO[c.health_status] || ESTILOS_ESTADO.SIN_DATOS;
            const seleccionado = corteSeleccionadoId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCorteSeleccionadoId(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                  seleccionado
                    ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="font-bold">CP{c.cutoff_number}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${est.badge}`}>
                  {est.texto}
                </span>
              </button>
            );
          })}
          {corteSeleccionadoId !== 'CONSOLIDADO' && (
            <button
              type="button"
              onClick={() => setCorteSeleccionadoId('CONSOLIDADO')}
              className="ml-auto text-xs font-semibold text-blue-600 hover:underline"
            >
              Ver consolidado
            </button>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <span className="text-xs font-semibold uppercase text-slate-500">Tamaño del Producto</span>
          <div className="mt-1 text-2xl font-bold text-slate-800">{kloc} <span className="text-sm font-normal text-slate-500">KLOC</span></div>
          <p className="text-xs text-slate-400">Miles de líneas de código estimadas</p>
        </div>

        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <span className="text-xs font-semibold uppercase text-slate-500">Actividades SQA Planificadas</span>
          <div className="mt-1 text-2xl font-bold text-slate-800">{plannedActs}</div>
          <p className="text-xs text-slate-400">{executedActs} ejecutadas a la fecha ({executedActs} de {plannedActs})</p>
        </div>

        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <span className="text-xs font-semibold uppercase text-slate-500">Fecha Aprobación Línea Base</span>
          <div className="mt-1 text-base font-bold text-slate-800">
            {fechaAprobacion ? new Date(fechaAprobacion).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Hoy'}
          </div>
          <p className="text-xs text-slate-400">Versión 1.0 congelada</p>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Estado de los Indicadores de Calidad {corteActivo ? `(Corte CP${corteActivo.cutoff_number})` : '(Consolidado)'}
        </h4>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TarjetaIndicador
            titulo="Densidad de Defectos"
            valorTexto={densidadVal}
            estado={ind.densidadDefectos?.estado || 'SIN_DATOS'}
          />
          <TarjetaIndicador
            titulo="Cobertura de Pruebas"
            valorTexto={coberturaVal}
            estado={ind.coberturaPruebas?.estado || 'SIN_DATOS'}
          />
          <TarjetaIndicador
            titulo="Tasa de Éxito de Pruebas"
            valorTexto={tasaVal}
            estado={ind.tasaExitoPruebas?.estado || 'SIN_DATOS'}
          />
          <TarjetaIndicador
            titulo="Cumplimiento Actividades SQA"
            valorTexto={cumplimientoVal}
            estado={ind.cumplimientoSqa?.estado || 'SIN_DATOS'}
          />
        </div>
      </div>
    </div>
  );
}
