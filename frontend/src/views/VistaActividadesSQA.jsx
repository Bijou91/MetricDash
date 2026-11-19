import React, { useState, useEffect } from 'react';
import * as api from '../api/ActividadesApiClient';
import ModalPlanificarActividad from '../widgets/ModalPlanificarActividad';
import AsistenteChecklistModal from '../widgets/AsistenteChecklistModal';
import ModalEvidenciaTestAudit from '../widgets/ModalEvidenciaTestAudit';

export default function VistaActividadesSQA({ proyectoId }) {
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [contexto, setContexto] = useState(null);

  // Modales
  const [actividadSeleccionada, setActividadSeleccionada] = useState(null);
  const [modalPlanificarAbierto, setModalPlanificarAbierto] = useState(false);
  const [modalChecklistAbierto, setModalChecklistAbierto] = useState(false);
  const [modalEvidenciaAbierto, setModalEvidenciaAbierto] = useState(false);
  const [actaVisualizada, setActaVisualizada] = useState(null);

  // Alerta visual de umbral o defecto crítico (FA-09.01)
  const [alertaVisual, setAlertaVisual] = useState(null);

  async function cargarDatos() {
    setCargando(true);
    setErrorMsg('');
    try {
      const { status, data } = await api.obtenerContextoActividades(proyectoId);
      if (status === 200) {
        setContexto(data);
      } else if (status === 409) {
        setErrorMsg('Los umbrales de métricas de calidad deben estar previamente configurados en CU-02.');
      } else {
        setErrorMsg(data?.mensaje || 'Error al cargar las actividades del proyecto.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al conectar con el backend.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (proyectoId) {
      cargarDatos();
    }
  }, [proyectoId]);

  function handleAbrirPlanificar(act) {
    setActividadSeleccionada(act);
    setModalPlanificarAbierto(true);
  }

  function handleAbrirEjecucion(act) {
    setActividadSeleccionada(act);
    if (act.category === 'REVIEW') {
      setModalChecklistAbierto(true);
    } else {
      setModalEvidenciaAbierto(true);
    }
  }

  function handleFinalizado(resultado) {
    if (resultado.alerta) {
      setAlertaVisual(resultado.alerta);
    }
    cargarDatos();
  }

  if (cargando) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-600">Cargando actividades SQA del proyecto...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">
        <h3 className="text-base font-bold">Aviso del Sistema SQA</h3>
        <p className="mt-2 text-sm">{errorMsg}</p>
        <button
          type="button"
          onClick={cargarDatos}
          className="mt-4 rounded bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const actividades = contexto?.actividades || [];
  const cumplimiento = contexto?.metricasCumplimiento || {};
  const umbralCumplimiento = contexto?.configMetricas?.metricas?.find(
    (m) => m.tipo === 'CUMPLIMIENTO_SQA',
  );

  return (
    <div className="space-y-6">
      {/* Alerta Visual Inmediata (FA-09.01) */}
      {alertaVisual && (
        <div className="rounded-xl border-l-4 border-rose-600 bg-rose-50 p-4 shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">⚠</span>
              <h4 className="text-sm font-bold text-rose-900">
                Alerta de Calidad Inmediata (FA-09.01)
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setAlertaVisual(null)}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900"
            >
              Cerrar aviso
            </button>
          </div>
          <p className="mt-1 text-xs text-rose-800 font-medium">
            {alertaVisual.mensajeAlerta}
          </p>
        </div>
      )}

      {/* Tarjeta de Resumen y Métrica SQA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <h2 className="text-lg font-bold text-slate-800">
            Plan y Ejecución de Actividades SQA (CU-04)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Proyecto: <strong className="text-slate-700">{contexto.proyecto.nombre}</strong> — Periodo:{' '}
            <strong className="text-slate-700">{contexto.proyecto.periodo}</strong>
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="rounded bg-slate-100 px-2.5 py-1 font-semibold">
              Total Actividades: {cumplimiento.totalActividades}
            </span>
            <span className="rounded bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
              Exigibles a la fecha: {cumplimiento.exigibles}
            </span>
            <span className="rounded bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
              Realizadas con éxito: {cumplimiento.realizadas}
            </span>
          </div>
        </div>

        {/* Widget de Cumplimiento SQA */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Cumplimiento de Actividades SQA
            </span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-blue-900">
                {cumplimiento.porcentajeCumplimiento}%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                (Meta: ≥{umbralCumplimiento?.meta || 90}%)
              </span>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  cumplimiento.porcentajeCumplimiento >= (umbralCumplimiento?.meta || 90)
                    ? 'bg-emerald-500'
                    : cumplimiento.porcentajeCumplimiento >= (umbralCumplimiento?.umbralAdvertencia || 75)
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(cumplimiento.porcentajeCumplimiento || 0, 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>0%</span>
              <span>Advertencia: {umbralCumplimiento?.umbralAdvertencia || 75}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Actividades */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4">
          <h3 className="text-sm font-bold text-slate-800">
            Actividades del Plan Base de Aseguramiento de Calidad
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/60 font-semibold text-slate-600 border-b">
              <tr>
                <th className="p-3">Actividad</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Fase</th>
                <th className="p-3">Planificada</th>
                <th className="p-3">Responsable</th>
                <th className="p-3">Artefacto</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {actividades.map((act) => {
                const esDone = act.status === 'DONE' || act.status === 'REALIZADA';
                const tienePlan = Boolean(act.planned_date && act.responsible_member_id);

                return (
                  <tr key={act.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-medium text-slate-900 max-w-xs">
                      {act.title}
                      {act.iso_practice_ref && (
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {act.iso_practice_ref}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold ${
                        act.category === 'REVIEW'
                          ? 'bg-purple-100 text-purple-800'
                          : act.category === 'TEST'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {act.category}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">
                      {act.phase.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3">
                      {act.planned_date ? act.planned_date.slice(0, 10) : <span className="text-slate-400 italic">Sin fecha</span>}
                    </td>
                    <td className="p-3">
                      {act.responsible_name ? (
                        <span>
                          {act.responsible_name}{' '}
                          <span className="text-slate-400">({act.responsible_role_name || act.responsible_role})</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">No asignado</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="font-mono font-semibold text-slate-700">
                        {act.artifact || '—'}
                      </span>
                    </td>
                    <td className="p-3">
                      {esDone ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                          ✔ Realizada
                        </span>
                      ) : tienePlan ? (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                          Planificada
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                          Pendiente plan
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      {!esDone ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAbrirPlanificar(act)}
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                          >
                            Planificar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAbrirEjecucion(act)}
                            className="rounded bg-blue-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-800 shadow-sm"
                          >
                            Ejecutar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActaVisualizada(act)}
                          className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          Ver Evidencia
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Planificar Actividad */}
      {modalPlanificarAbierto && actividadSeleccionada && (
        <ModalPlanificarActividad
          proyectoId={proyectoId}
          actividad={actividadSeleccionada}
          miembros={contexto.miembros}
          periodo={contexto.periodo}
          onCerrar={() => setModalPlanificarAbierto(false)}
          onPlanificado={cargarDatos}
        />
      )}

      {/* Modal / Asistente para Revisión por Pares (Checklist) */}
      {modalChecklistAbierto && actividadSeleccionada && (
        <AsistenteChecklistModal
          proyectoId={proyectoId}
          actividad={actividadSeleccionada}
          onCerrar={() => setModalChecklistAbierto(false)}
          onFinalizado={handleFinalizado}
        />
      )}

      {/* Modal para Cierre de Pruebas o Auditoría */}
      {modalEvidenciaAbierto && actividadSeleccionada && (
        <ModalEvidenciaTestAudit
          proyectoId={proyectoId}
          actividad={actividadSeleccionada}
          rondasPrevias={contexto.rondasPruebas || []}
          onCerrar={() => setModalEvidenciaAbierto(false)}
          onFinalizado={handleFinalizado}
        />
      )}

      {/* Modal de Detalle de Evidencia / Acta */}
      {actaVisualizada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 border-b pb-2">
              Evidencia de Actividad Realizada
            </h3>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <p><strong>Actividad:</strong> {actaVisualizada.title}</p>
              <p><strong>Fase:</strong> {actaVisualizada.phase}</p>
              <p><strong>Fecha de Ejecución:</strong> {actaVisualizada.execution_date ? actaVisualizada.execution_date.slice(0, 10) : 'Completada'}</p>
              <p>
                <strong>Evidencia / Acta:</strong>{' '}
                <span className="font-mono text-blue-700">
                  {actaVisualizada.evidence_url || 'Evidencia registrada'}
                </span>
              </p>
              {actaVisualizada.review_verdict && (
                <p><strong>Dictamen de Revisión:</strong> {actaVisualizada.review_verdict}</p>
              )}
            </div>
            <div className="mt-4 flex justify-end border-t pt-3">
              <button
                type="button"
                onClick={() => setActaVisualizada(null)}
                className="rounded-md bg-blue-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
