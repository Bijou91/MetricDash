import React, { useState } from 'react';

const FASES_ETIQUETAS = {
  ANALISIS_REQUERIMIENTOS: 'Análisis de Requerimientos',
  DISENO_COMPONENTES: 'Diseño de Componentes',
  CONSTRUCCION_SOFTWARE: 'Construcción de Software',
  INTEGRACION_Y_PRUEBAS: 'Integración y Pruebas',
};

const ROLES_ETIQUETAS = {
  QA: 'Responsable de Calidad (QA)',
  TECNICO: 'Líder Técnico / Desarrollador',
  GESTION_PROYECTO: 'Gestión de Proyecto',
};

export default function PlanQABaseWidget({ planQA }) {
  const [faseFiltro, setFaseFiltro] = useState('TODAS');

  if (!planQA || !planQA.actividades || planQA.actividades.length === 0) {
    return null;
  }

  const actividades = planQA.actividades;
  const actividadesFiltradas = faseFiltro === 'TODAS'
    ? actividades
    : actividades.filter((a) => a.phase === faseFiltro);

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            Plan Base de Actividades SQA Propuesto
          </h3>
          <p className="text-sm text-slate-500">
            Estructurado bajo los procesos del perfil básico de la norma ISO/IEC 29110 ({actividades.length} actividades planificadas)
          </p>
        </div>
        <div className="mt-3 sm:mt-0">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            Línea Base v1.0
          </span>
        </div>
      </div>

      {/* Filtro por Fase */}
      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setFaseFiltro('TODAS')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            faseFiltro === 'TODAS'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Todas ({actividades.length})
        </button>
        {Object.entries(FASES_ETIQUETAS).map(([faseKey, etiqueta]) => {
          const count = actividades.filter((a) => a.phase === faseKey).length;
          return (
            <button
              key={faseKey}
              type="button"
              onClick={() => setFaseFiltro(faseKey)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                faseFiltro === faseKey
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {etiqueta} ({count})
            </button>
          );
        })}
      </div>

      {/* Listado de Actividades */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase text-slate-700">
            <tr>
              <th className="px-3 py-2">Fase</th>
              <th className="px-3 py-2">Actividad / Tarea SQA</th>
              <th className="px-3 py-2">Práctica ISO/IEC 29110</th>
              <th className="px-3 py-2">Rol Responsable</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actividadesFiltradas.map((act, index) => (
              <tr key={act.id || index} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    {FASES_ETIQUETAS[act.phase] || act.phase}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-slate-900">{act.title}</div>
                  <div className="text-xs text-slate-500">{act.description}</div>
                  {act.deliverable && (
                    <div className="mt-0.5 text-xs text-blue-600">
                      Entregable: <span className="font-medium">{act.deliverable}</span>
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500 font-mono">
                  {act.iso_practice_ref || act.isoPracticeRef}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-700">
                  {ROLES_ETIQUETAS[act.responsible_role || act.responsibleRole] || (act.responsible_role || act.responsibleRole)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                  <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                    {act.status || 'PLANIFICADA'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
