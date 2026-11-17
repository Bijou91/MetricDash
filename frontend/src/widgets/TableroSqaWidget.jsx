import React from 'react';
import SemaforoWidget from './SemaforoWidget';

export default function TableroSqaWidget({
  cumplimientoSQA = null,
  actividadesExigibles = 0,
  actividadesRealizadas = 0,
  estadoCumplimiento = 'SIN_DATOS',
  densidadDefectos = null,
  totalDefectos = 0,
  estadoDensidad = 'SIN_DATOS',
  nivelSemaforo = 'SIN_DATOS',
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Tablero SQA — Indicadores de Actividades y Defectos
          </h3>
          <p className="text-xs text-slate-500">
            Cumplimiento SQA = (actividades realizadas / actividades exigibles) × 100, evaluado contra los umbrales vigentes del proyecto.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">
              Cumplimiento Actividades SQA
            </span>
            <SemaforoWidget estado={estadoCumplimiento} compacto />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {cumplimientoSQA != null ? `${cumplimientoSQA}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {actividadesRealizadas} realizada(s) de {actividadesExigibles} exigible(s) a la fecha
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">
              Densidad de Defectos
            </span>
            <SemaforoWidget estado={estadoDensidad} compacto />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {densidadDefectos != null ? `${densidadDefectos} def/KLOC` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {totalDefectos} defecto(s) activos acumulados en el proyecto
          </p>
        </div>

        <SemaforoWidget
          estado={nivelSemaforo}
          etiqueta="Estado de Salud del Tablero"
        />
      </div>
    </section>
  );
}
