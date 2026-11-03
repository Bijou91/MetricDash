import React from 'react';

const ETIQUETAS_DICTAMEN = {
  APROBADO: { texto: 'APROBADO', clase: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  APROBADO_CONDICIONADO: { texto: 'APROBADO CONDICIONADO', clase: 'bg-amber-100 text-amber-800 border-amber-300' },
  RECHAZADO: { texto: 'RECHAZADO', clase: 'bg-red-100 text-red-800 border-red-300' },
};

export default function ActaRevisionWidget({ acta, actividad, onCerrarVista, onReevaluar }) {
  if (!acta) return null;

  const cfgDictamen = ETIQUETAS_DICTAMEN[acta.dictamen] || {
    texto: acta.dictamen || 'EMITIDA',
    clase: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Acta formal de revisión por pares"
      onClick={onCerrarVista}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <section
        role="region"
        aria-label="Detalle del acta de revisión"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border-2 border-indigo-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-indigo-100 pb-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Evidencia Formal Emitida
            </span>
            <h3 className="mt-0.5 text-lg font-extrabold text-slate-900">
              Acta de Revisión por Pares {actividad?.nombre ? `— ${actividad.nombre}` : ''}
            </h3>
            <p className="text-xs text-slate-600">
              Fecha de emisión: <strong>{String(acta.fechaEmision || '').slice(0, 10)}</strong>
              {acta.minutesUrl && (
                <span className="ml-3 font-mono text-indigo-700">
                  Ref: {acta.minutesUrl}
                </span>
              )}
            </p>
            {(actividad?.artefacto || actividad?.responsableNombre || actividad?.autorNombre) && (
              <p className="mt-1 text-xs text-slate-500">
                {actividad?.artefacto && <span>Artefacto: <strong>{actividad.artefacto}</strong> </span>}
                {actividad?.responsableNombre && <span>| Responsable: <strong>{actividad.responsableNombre}</strong> </span>}
                {actividad?.autorNombre && <span>| Autor: <strong>{actividad.autorNombre}</strong></span>}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className={`rounded-lg border px-3 py-1 text-xs font-extrabold ${cfgDictamen.clase}`}>
              Dictamen: {cfgDictamen.texto}
            </span>
            {onCerrarVista && (
              <button
                type="button"
                onClick={onCerrarVista}
                className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                ✕ Cerrar
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
            <span className="text-[11px] font-semibold uppercase text-slate-500">Criterios Evaluados</span>
            <div className="mt-1 text-xl font-bold text-slate-900">{acta.totalItems ?? 0}</div>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/30 p-3">
            <span className="text-[11px] font-semibold uppercase text-emerald-700">Criterios que Cumplen</span>
            <div className="mt-1 text-xl font-bold text-emerald-700">{acta.itemsCumple ?? 0}</div>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50/30 p-3">
            <span className="text-[11px] font-semibold uppercase text-red-700">Hallazgos (No Cumple)</span>
            <div className="mt-1 text-xl font-bold text-red-700">{acta.itemsNoCumple ?? 0}</div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-indigo-100 bg-slate-50 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Síntesis de Hallazgos y Dictamen
          </h4>
          <p className="mt-1.5 text-sm text-slate-700">
            {acta.resumenHallazgos}
          </p>

          {Array.isArray(acta.foliosDefectos) && acta.foliosDefectos.length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <span className="text-xs font-bold text-slate-700">
                Folios de Defectos Vinculados al Acta:
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {acta.foliosDefectos.map((folio) => (
                  <span
                    key={folio}
                    className="inline-flex items-center rounded-md bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800"
                  >
                    🐞 {folio}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {onReevaluar && actividad && (
            <button
              type="button"
              onClick={() => {
                if (onCerrarVista) onCerrarVista();
                onReevaluar(actividad);
              }}
              className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
            >
              🔄 Volver a ejecutar revisión (Re-evaluar artefacto)
            </button>
          )}
          {onCerrarVista && (
            <button
              type="button"
              onClick={onCerrarVista}
              className="rounded-lg bg-indigo-700 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-800"
            >
              Cerrar acta de revisión
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
