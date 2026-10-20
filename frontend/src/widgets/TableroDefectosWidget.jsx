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

export default function TableroDefectosWidget({ tablero }) {
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
          <div className="text-xs text-slate-500">Umbrales (CU-02)</div>
          {tablero.umbral
            ? <>Meta {tablero.umbral.meta} · Advertencia {tablero.umbral.umbralAdvertencia} · Crítico {tablero.umbral.umbralCritico}</>
            : 'Sin configurar'}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-2">Folio</th>
              <th className="py-2 pr-2">Descripción</th>
              <th className="py-2 pr-2">Severidad</th>
              <th className="py-2 pr-2">Prioridad</th>
              <th className="py-2 pr-2">Fase de origen</th>
              <th className="py-2 pr-2">Asignado a</th>
              <th className="py-2 pr-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {tablero.defectos.length === 0 && (
              <tr><td colSpan={7} className="py-3 text-slate-500">Aún no hay defectos registrados.</td></tr>
            )}
            {tablero.defectos.map((d) => (
              <tr key={d.id} className="border-t border-slate-200 align-top">
                <td className="py-2 pr-2 font-mono">{d.folio}</td>
                <td className="py-2 pr-2">{d.descripcionDetallada}</td>
                <td className={`py-2 pr-2 ${d.severidad === 'CRITICA' ? 'font-semibold text-red-700' : ''}`}>{d.severidad}</td>
                <td className="py-2 pr-2">{d.prioridad}</td>
                <td className="py-2 pr-2">{ETIQUETAS_FASE[d.faseOrigen]}</td>
                <td className="py-2 pr-2">{d.asignadoNombre ?? '—'}</td>
                <td className="py-2 pr-2">{d.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
