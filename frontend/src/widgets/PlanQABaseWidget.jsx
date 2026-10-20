import React, { useState } from 'react';

const FASES_ETIQUETAS = {
  ANALISIS_REQUERIMIENTOS: 'Análisis de Requerimientos',
  DISENO_COMPONENTES: 'Diseño de Componentes',
  CONSTRUCCION_SOFTWARE: 'Construcción de Software',
  INTEGRACION_Y_PRUEBAS: 'Integración y Pruebas',
};

const ROLES_ETIQUETAS = {
  QA: 'Responsable de Calidad (QA)',
  TECNICO: 'Líder Técnico',
  GESTION_PROYECTO: 'Gestión de Proyecto',
};

export default function PlanQABaseWidget({ planQA, modoPrevisualizacion = false, onCambiarEstadoActividad }) {
  const [faseFiltro, setFaseFiltro] = useState('TODAS');
  const [rolFiltro, setRolFiltro] = useState('TODOS');
  const [actualizandoId, setActualizandoId] = useState(null);

  if (!planQA || !planQA.actividades || planQA.actividades.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No hay actividades cargadas en el plan de QA.
      </div>
    );
  }

  const actividades = planQA.actividades;
  const realizadas = actividades.filter((a) => a.status === 'DONE' || a.status === 'REALIZADA').length;
  const enCurso = actividades.filter((a) => a.status === 'IN_PROGRESS' || a.status === 'EN_CURSO').length;
  const planificadas = actividades.filter((a) => a.status === 'PLANNED' || a.status === 'PLANIFICADA').length;
  const porcentajeAvance = Math.round((realizadas / actividades.length) * 100);

  const actividadesFiltradas = actividades.filter((a) => {
    const coincideFase = faseFiltro === 'TODAS' || a.phase === faseFiltro;
    const coincideRol = rolFiltro === 'TODOS' || (a.responsible_role || a.responsibleRole) === rolFiltro;
    return coincideFase && coincideRol;
  });

  async function handleCambiarEstado(actividadId, nuevoEstado) {
    if (!onCambiarEstadoActividad) return;
    setActualizandoId(actividadId);
    try {
      await onCambiarEstadoActividad(actividadId, nuevoEstado);
    } finally {
      setActualizandoId(null);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-800">
              {modoPrevisualizacion
                ? 'Propuesta de Plan Base SQA (ISO/IEC 29110)'
                : 'Plan Base de Actividades SQA del Proyecto'}
            </h3>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              modoPrevisualizacion
                ? 'bg-amber-100 text-amber-800'
                : 'bg-blue-50 text-blue-700'
            }`}>
              {modoPrevisualizacion ? 'Vista Previa FN-03' : 'Línea Base v1.0'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Estructurado bajo los procesos del perfil básico de la norma ISO/IEC 29110 ({actividades.length} actividades formalizadas).
          </p>
        </div>

        {/* Resumen de Progreso */}
        {!modoPrevisualizacion && (
          <div className="mt-3 flex items-center gap-3 sm:mt-0">
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-600">Avance de Ejecución SQA:</span>
              <div className="text-sm font-bold text-blue-700">{realizadas} de {actividades.length} ({porcentajeAvance}%)</div>
            </div>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${porcentajeAvance}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Contadores de Estado */}
      {!modoPrevisualizacion && (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center sm:grid-cols-4">
          <div className="rounded bg-slate-50 p-2">
            <span className="text-xs text-slate-500">Total</span>
            <div className="text-base font-bold text-slate-800">{actividades.length}</div>
          </div>
          <div className="rounded bg-blue-50 p-2">
            <span className="text-xs text-blue-600">Planificadas</span>
            <div className="text-base font-bold text-blue-700">{planificadas}</div>
          </div>
          <div className="rounded bg-amber-50 p-2">
            <span className="text-xs text-amber-600">En Curso</span>
            <div className="text-base font-bold text-amber-700">{enCurso}</div>
          </div>
          <div className="rounded bg-emerald-50 p-2">
            <span className="text-xs text-emerald-600">Realizadas</span>
            <div className="text-base font-bold text-emerald-700">{realizadas}</div>
          </div>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="mt-4 flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filtro por Fase */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFaseFiltro('TODAS')}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              faseFiltro === 'TODAS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  faseFiltro === faseKey
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {etiqueta} ({count})
              </button>
            );
          })}
        </div>

        {/* Filtro por Rol */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>Rol:</span>
          <select
            value={rolFiltro}
            onChange={(e) => setRolFiltro(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm"
          >
            <option value="TODOS">Todos los roles</option>
            <option value="QA">QA</option>
            <option value="TECNICO">Líder Técnico</option>
            <option value="GESTION_PROYECTO">Gestión de Proyecto</option>
          </select>
        </div>
      </div>

      {/* Tabla Interactiva de Actividades */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-700">
            <tr>
              <th className="px-3 py-2">Fase</th>
              <th className="px-3 py-2">Actividad SQA</th>
              <th className="px-3 py-2">ISO 29110</th>
              <th className="px-3 py-2">Responsable</th>
              <th className="px-3 py-2">Estado</th>
              {!modoPrevisualizacion && onCambiarEstadoActividad && (
                <th className="px-3 py-2 text-right">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {actividadesFiltradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-slate-400">
                  No hay actividades que coincidan con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              actividadesFiltradas.map((act, index) => {
                const actId = act.id || index;
                const status = act.status || 'PLANNED';
                const isUpdating = actualizandoId === actId;

                return (
                  <tr key={actId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        {FASES_ETIQUETAS[act.phase] || act.phase}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{act.title}</div>
                      <div className="text-xs text-slate-500">{act.description}</div>
                      {act.deliverable && (
                        <div className="mt-0.5 text-xs text-blue-600 font-mono">
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
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        status === 'DONE' || status === 'REALIZADA'
                          ? 'bg-emerald-100 text-emerald-800'
                          : status === 'IN_PROGRESS' || status === 'EN_CURSO'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {status === 'DONE' ? 'REALIZADA' : status === 'IN_PROGRESS' ? 'EN CURSO' : 'PLANIFICADA'}
                      </span>
                    </td>
                    {!modoPrevisualizacion && onCambiarEstadoActividad && (
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs">
                        {status !== 'DONE' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleCambiarEstado(actId, 'DONE')}
                            className="mr-1 rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            ✔ Realizada
                          </button>
                        )}
                        {status === 'PLANNED' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleCambiarEstado(actId, 'IN_PROGRESS')}
                            className="mr-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          >
                            ▶ En Curso
                          </button>
                        )}
                        {(status === 'DONE' || status === 'IN_PROGRESS') && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleCambiarEstado(actId, 'PLANNED')}
                            className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                          >
                            ↺ Planificada
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
