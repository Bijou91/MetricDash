import React from 'react';

export default function TableroInicialWidget({ tablero, lineaBase }) {
  if (!tablero && !lineaBase) return null;

  const kloc = tablero?.kloc || lineaBase?.kloc || 0;
  const plannedActs = tablero?.plannedSqaActs || tablero?.planned_sqa_acts || lineaBase?.plannedSqaActs || 0;
  const executedActs = tablero?.executedSqaActs || tablero?.executed_sqa_acts || 0;
  const healthStatus = tablero?.healthStatus || tablero?.health_status || 'SIN_DATOS';
  const fechaAprobacion = lineaBase?.approvalDate || lineaBase?.approval_date;

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-800">
              Tablero de Control de Calidad — Corte 1 (CP1 Inicial)
            </h3>
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {healthStatus}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Línea base de aseguramiento de calidad aprobada formalmente. Los indicadores se calcularán conforme se registren defectos y mediciones.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <span className="text-xs font-semibold uppercase text-slate-500">Tamaño del Producto</span>
          <div className="mt-1 text-2xl font-bold text-slate-800">{kloc} <span className="text-sm font-normal text-slate-500">KLOC</span></div>
          <p className="text-xs text-slate-400">Miles de líneas de código estimadas</p>
        </div>

        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <span className="text-xs font-semibold uppercase text-slate-500">Actividades SQA Planificadas</span>
          <div className="mt-1 text-2xl font-bold text-slate-800">{plannedActs}</div>
          <p className="text-xs text-slate-400">0 ejecutadas a la fecha ({executedActs} de {plannedActs})</p>
        </div>

        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <span className="text-xs font-semibold uppercase text-slate-500">Fecha Aprobación Línea Base</span>
          <div className="mt-1 text-base font-bold text-slate-800">
            {fechaAprobacion ? new Date(fechaAprobacion).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Hoy'}
          </div>
          <p className="text-xs text-slate-400">Versión 1.0 congelada</p>
        </div>
      </div>

      {/* Indicadores en Estado Inicial SIN_DATOS */}
      <div className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Estado Inicial de los Indicadores de Calidad
        </h4>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded border border-slate-200 bg-slate-50/60 p-2.5 text-center">
            <span className="text-xs font-medium text-slate-600">Densidad Defectos</span>
            <div className="mt-1 text-sm font-bold text-slate-400">0.0 def/KLOC</div>
            <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">SIN_DATOS</span>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50/60 p-2.5 text-center">
            <span className="text-xs font-medium text-slate-600">Eficacia Remoción</span>
            <div className="mt-1 text-sm font-bold text-slate-400">0.0%</div>
            <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">SIN_DATOS</span>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50/60 p-2.5 text-center">
            <span className="text-xs font-medium text-slate-600">Cobertura Pruebas</span>
            <div className="mt-1 text-sm font-bold text-slate-400">0.0%</div>
            <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">SIN_DATOS</span>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50/60 p-2.5 text-center">
            <span className="text-xs font-medium text-slate-600">Cumplimiento Estándares</span>
            <div className="mt-1 text-sm font-bold text-slate-400">0.0%</div>
            <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">SIN_DATOS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
