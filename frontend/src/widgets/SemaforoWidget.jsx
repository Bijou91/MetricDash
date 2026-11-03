import React from 'react';

export const ESTILOS_SEMAFORO = {
  VERDE: { texto: 'Óptimo', clase: 'bg-green-600 text-white', borde: 'border-green-200 bg-green-50/40' },
  VERDE_OPTIMO: { texto: 'Óptimo', clase: 'bg-green-600 text-white', borde: 'border-green-200 bg-green-50/40' },
  AMARILLO: { texto: 'Advertencia', clase: 'bg-yellow-600 text-white', borde: 'border-yellow-200 bg-yellow-50/40' },
  AMARILLO_ADVERTENCIA: { texto: 'Advertencia', clase: 'bg-yellow-600 text-white', borde: 'border-yellow-200 bg-yellow-50/40' },
  ROJO: { texto: 'Crítico', clase: 'bg-red-600 text-white', borde: 'border-red-200 bg-red-50/40' },
  ROJO_CRITICO: { texto: 'Crítico', clase: 'bg-red-600 text-white', borde: 'border-red-200 bg-red-50/40' },
  SIN_DATOS: { texto: 'Sin datos', clase: 'bg-slate-400 text-white', borde: 'border-slate-200 bg-white' },
};

export function renderizarEstado(estado) {
  const cfg = ESTILOS_SEMAFORO[estado] ?? ESTILOS_SEMAFORO.SIN_DATOS;
  return (
    <span className={`${cfg.clase} inline-block rounded px-2.5 py-1 text-xs font-semibold`}>
      {cfg.texto}
    </span>
  );
}

export default function SemaforoWidget({
  etiqueta,
  valor,
  unidad = '%',
  estado = 'SIN_DATOS',
  umbral = null,
}) {
  const cfg = ESTILOS_SEMAFORO[estado] ?? ESTILOS_SEMAFORO.SIN_DATOS;
  return (
    <div className={`rounded-lg border p-3.5 ${cfg.borde}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{etiqueta}</span>
        {renderizarEstado(estado)}
      </div>
      {valor !== undefined && (
        <div className="mt-2 text-2xl font-bold text-slate-800">
          {valor ?? '—'}
          {valor != null && <span className="ml-0.5 text-sm font-normal text-slate-500">{unidad}</span>}
        </div>
      )}
      {umbral && (
        <div className="mt-1.5 text-xs text-slate-500">
          Meta {umbral.meta}{unidad} · Advertencia {umbral.umbralAdvertencia}{unidad} · Crítico {umbral.umbralCritico}{unidad}
        </div>
      )}
    </div>
  );
}

