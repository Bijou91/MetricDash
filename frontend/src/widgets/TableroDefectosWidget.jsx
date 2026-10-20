import React from 'react';

const NIVELES = {
  VERDE_OPTIMO: { texto: 'Óptimo', clase: 'bg-green-600' },
  AMARILLO_ADVERTENCIA: { texto: 'Advertencia', clase: 'bg-yellow-600' },
  ROJO_CRITICO: { texto: 'Crítico', clase: 'bg-red-600' },
  SIN_DATOS: { texto: 'Sin datos', clase: 'bg-slate-400' },
};

export const ETIQUETAS_FASE = {
  ANALISIS_REQUERIMIENTOS: 'Análisis de requerimientos',
  DISENO_COMPONENTES: 'Diseño de componentes',
  CONSTRUCCION_SOFTWARE: 'Construcción de software',
  INTEGRACION_Y_PRUEBAS: 'Integración y pruebas',
};

export default function TableroDefectosWidget({ tablero, onEditarDefecto, onCambiarEstadoDefecto }) {
  const nivel = NIVELES[tablero.nivelSemaforo] ?? NIVELES.SIN_DATOS;
  return (
    <section aria-label="Tablero de defectos" className="mt-6">
      <h3 className="mb-2 font-semibold">Tablero del proyecto</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Densidad de defectos</div>
          <div className="text-2xl font-bold">
            {tablero.densidadDefectos ?? '—'} <span className="text-sm font-normal">{tablero.umbral?.unidad}</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Estado de salud</div>
          <span className={`${nivel.clase} mt-1 inline-block rounded px-2.5 py-1 text-sm text-white`}>{nivel.texto}</span>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="text-xs text-slate-500">Umbrales de Calidad</div>
          {tablero.umbral
            ? <>Meta {tablero.umbral.meta} · Advertencia {tablero.umbral.umbralAdvertencia} · Crítico {tablero.umbral.umbralCritico}</>
            : 'Sin configurar'}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left border-b border-slate-200">
              <th className="py-2 pr-2">Folio</th>
              <th className="py-2 pr-2">Descripción</th>
              <th className="py-2 pr-2">Severidad</th>
              <th className="py-2 pr-2">Prioridad</th>
              <th className="py-2 pr-2">Fase de origen</th>
              <th className="py-2 pr-2">Asignado a</th>
              <th className="py-2 pr-2">Estado</th>
              <th className="py-2 pr-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tablero.defectos.length === 0 && (
              <tr><td colSpan={8} className="py-3 text-slate-500 text-center">Aún no hay defectos registrados.</td></tr>
            )}
            {tablero.defectos.map((d) => (
              <tr key={d.id} className="border-t border-slate-200 align-middle hover:bg-slate-50/50">
                <td className="py-2.5 pr-2 font-mono font-semibold text-slate-700">{d.folio}</td>
                <td className="py-2.5 pr-2 max-w-xs truncate" title={d.descripcionDetallada}>{d.descripcionDetallada}</td>
                <td className={`py-2.5 pr-2 ${d.severidad === 'CRITICA' ? 'font-bold text-red-700' : 'text-slate-700'}`}>{d.severidad}</td>
                <td className="py-2.5 pr-2">{d.prioridad}</td>
                <td className="py-2.5 pr-2">{ETIQUETAS_FASE[d.faseOrigen] ?? d.faseOrigen}</td>
                <td className="py-2.5 pr-2 font-medium">{d.asignadoNombre ?? '—'}</td>
                <td className="py-2.5 pr-2">
                  <select
                    value={d.estado}
                    onChange={(e) => onCambiarEstadoDefecto && onCambiarEstadoDefecto(d.id, e.target.value)}
                    className={`rounded border text-xs font-semibold px-2 py-1 shadow-xs cursor-pointer ${
                      d.estado === 'CERRADO'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : d.estado === 'EN_RESOLUCION'
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : d.estado === 'DESCARTADO'
                        ? 'border-slate-300 bg-slate-100 text-slate-500 line-through'
                        : d.estado === 'ASIGNADO'
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                        : 'border-sky-300 bg-sky-50 text-sky-800'
                    }`}
                    title="Actualizar estado del defecto"
                  >
                    <option value="REGISTRADO">Registrado</option>
                    <option value="ASIGNADO">Asignado</option>
                    <option value="EN_RESOLUCION">En resolución</option>
                    <option value="CERRADO">Cerrado</option>
                    <option value="DESCARTADO">Descartado</option>
                  </select>
                </td>
                <td className="py-2.5 pr-2 text-center whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onEditarDefecto && onEditarDefecto(d)}
                    className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 hover:border-blue-300 shadow-xs transition"
                    title="Editar datos del defecto"
                  >
                    ✏️ Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
