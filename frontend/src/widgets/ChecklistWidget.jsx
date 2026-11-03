import React from 'react';

const SEVERIDADES = [
  { valor: 'BAJA', etiqueta: 'Baja' },
  { valor: 'MEDIA', etiqueta: 'Media' },
  { valor: 'ALTA', etiqueta: 'Alta' },
  { valor: 'CRITICA', etiqueta: 'Crítica' },
];

const PRIORIDADES = [
  { valor: 'BAJA', etiqueta: 'Baja' },
  { valor: 'MEDIA', etiqueta: 'Media' },
  { valor: 'ALTA', etiqueta: 'Alta' },
  { valor: 'INMEDIATA', etiqueta: 'Inmediata' },
];

export default function ChecklistWidget({
  nombreChecklist,
  descripcionChecklist,
  items = [],
  resultados = {},
  erroresCampos = {},
  onMarcarItem,
  onCapturarHallazgo,
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3.5">
        <h4 className="text-sm font-bold text-blue-950">
          📋 {nombreChecklist || 'Checklist de Revisión por Pares'}
        </h4>
        {descripcionChecklist && (
          <p className="mt-0.5 text-xs text-blue-800">{descripcionChecklist}</p>
        )}
        <p className="mt-1 text-[11px] text-blue-700">
          Marque cada criterio como <strong>Cumple</strong> o <strong>No cumple</strong>. Cada criterio que «No cumple» requiere observación, severidad y prioridad y se convertirá automáticamente en un defecto asignado al autor del artefacto.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const estadoItem = resultados[item.id] || {
            itemId: item.id,
            descripcionItem: item.descripcion,
            cumple: true,
            observacion: '',
            severidad: 'MEDIA',
            prioridad: 'MEDIA',
          };
          const noCumple = estadoItem.cumple === false;
          const errObs = erroresCampos[`observacion:${item.id}`];
          const errSev = erroresCampos[`severidad:${item.id}`];
          const errPrio = erroresCampos[`prioridad:${item.id}`];

          return (
            <div
              key={item.id}
              className={`rounded-lg border p-4 transition-colors ${
                noCumple
                  ? 'border-amber-300 bg-amber-50/40'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                    Criterio #{item.orden}
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {item.descripcion}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMarcarItem(item.id, true, item.descripcion)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      !noCumple
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ✔ Cumple
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarcarItem(item.id, false, item.descripcion)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      noCumple
                        ? 'border-red-600 bg-red-600 text-white shadow-xs'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ✖ No cumple
                  </button>
                </div>
              </div>

              {noCumple && (
                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-amber-200/80 pt-3 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <label
                      htmlFor={`obs-${item.id}`}
                      className="block text-xs font-bold text-slate-700"
                    >
                      Descripción de la observación / hallazgo *
                    </label>
                    <textarea
                      id={`obs-${item.id}`}
                      rows={2}
                      value={estadoItem.observacion || ''}
                      onChange={(e) =>
                        onCapturarHallazgo(
                          item.id,
                          e.target.value,
                          estadoItem.severidad,
                          estadoItem.prioridad,
                        )
                      }
                      placeholder="Describa el incumplimiento detectado en el artefacto..."
                      className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs focus:outline-none ${
                        errObs
                          ? 'border-red-500 bg-red-50'
                          : 'border-slate-300 bg-white focus:border-blue-600'
                      }`}
                    />
                    {errObs && (
                      <p className="mt-1 text-xs font-medium text-red-600">{errObs}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`sev-${item.id}`}
                      className="block text-xs font-bold text-slate-700"
                    >
                      Severidad del Defecto *
                    </label>
                    <select
                      id={`sev-${item.id}`}
                      value={estadoItem.severidad || ''}
                      onChange={(e) =>
                        onCapturarHallazgo(
                          item.id,
                          estadoItem.observacion,
                          e.target.value,
                          estadoItem.prioridad,
                        )
                      }
                      className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-xs ${
                        errSev ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
                      }`}
                    >
                      <option value="">— Seleccione —</option>
                      {SEVERIDADES.map((s) => (
                        <option key={s.valor} value={s.valor}>{s.etiqueta}</option>
                      ))}
                    </select>
                    {errSev && (
                      <p className="mt-1 text-xs font-medium text-red-600">{errSev}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`prio-${item.id}`}
                      className="block text-xs font-bold text-slate-700"
                    >
                      Prioridad de Atención *
                    </label>
                    <select
                      id={`prio-${item.id}`}
                      value={estadoItem.prioridad || ''}
                      onChange={(e) =>
                        onCapturarHallazgo(
                          item.id,
                          estadoItem.observacion,
                          estadoItem.severidad,
                          e.target.value,
                        )
                      }
                      className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-xs ${
                        errPrio ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
                      }`}
                    >
                      <option value="">— Seleccione —</option>
                      {PRIORIDADES.map((p) => (
                        <option key={p.valor} value={p.valor}>{p.etiqueta}</option>
                      ))}
                    </select>
                    {errPrio && (
                      <p className="mt-1 text-xs font-medium text-red-600">{errPrio}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

