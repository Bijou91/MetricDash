import React, { useState, useEffect } from 'react';
import * as api from '../api/ActividadesApiClient';

export default function ModalPlanificarActividad({
  proyectoId,
  actividad,
  miembros = [],
  periodo = {},
  onCerrar,
  onPlanificado,
}) {
  const esReview = actividad.category === 'REVIEW';

  const [responsibleMemberId, setResponsibleMemberId] = useState(actividad.responsible_member_id || '');
  const [plannedDate, setPlannedDate] = useState(actividad.planned_date ? actividad.planned_date.slice(0, 10) : '');
  const [artifact, setArtifact] = useState(actividad.artifact || (esReview ? 'SGU' : 'VERSION'));
  const [authorId, setAuthorId] = useState(actividad.author_id || '');
  const [reviewerIds, setReviewerIds] = useState(actividad.reviewer_ids || []);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [erroresCampos, setErroresCampos] = useState({});

  useEffect(() => {
    // Si no hay autor asignado aún, sugerir un developer por defecto
    if (esReview && !authorId && miembros.length > 0) {
      const dev = miembros.find((m) => m.role === 'DEVELOPER') || miembros[0];
      setAuthorId(dev.id);
    }
  }, [esReview, authorId, miembros]);

  function toggleRevisor(id) {
    if (reviewerIds.includes(id)) {
      setReviewerIds(reviewerIds.filter((r) => r !== id));
    } else {
      setReviewerIds([...reviewerIds, id]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setErrorMsg('');
    setErroresCampos({});

    const dto = {
      responsibleMemberId,
      plannedDate,
      artifact,
      authorId: esReview ? authorId : undefined,
      reviewerIds: esReview ? reviewerIds : undefined,
    };

    try {
      const { status, data } = await api.planificarActividad(proyectoId, actividad.id, dto);
      if (status === 200) {
        onPlanificado(data);
        onCerrar();
      } else {
        setErrorMsg(data?.mensaje || 'Error al guardar la planificación.');
        if (data?.errores) {
          const mapErrores = {};
          data.errores.forEach((err) => {
            mapErrores[err.campo] = err.mensaje;
          });
          setErroresCampos(mapErrores);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error de comunicación con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-bold text-slate-800">
            Planificar Actividad SQA
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 rounded-md bg-blue-50 p-3 text-xs text-blue-800">
          <strong>Actividad:</strong> {actividad.title} ({actividad.category}) — Fase: {actividad.phase}
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Responsable */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Responsable de Ejecución *
            </label>
            <select
              value={responsibleMemberId}
              onChange={(e) => setResponsibleMemberId(e.target.value)}
              className={`mt-1 block w-full rounded-md border p-2 text-sm ${
                erroresCampos.responsibleMemberId ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
              }`}
            >
              <option value="">Seleccione un responsable...</option>
              {miembros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.member_name} ({m.role})
                </option>
              ))}
            </select>
            {erroresCampos.responsibleMemberId && (
              <p className="mt-1 text-xs text-rose-600">{erroresCampos.responsibleMemberId}</p>
            )}
          </div>

          {/* Fecha Planificada */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Fecha Planificada * (Periodo: {periodo.start_date || 'N/A'} al {periodo.end_date || 'N/A'})
            </label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className={`mt-1 block w-full rounded-md border p-2 text-sm ${
                erroresCampos.plannedDate ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
              }`}
            />
            {erroresCampos.plannedDate && (
              <p className="mt-1 text-xs text-rose-600">{erroresCampos.plannedDate}</p>
            )}
          </div>

          {/* Artefacto */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Artefacto a Evaluar *
            </label>
            <select
              value={artifact}
              onChange={(e) => setArtifact(e.target.value)}
              className={`mt-1 block w-full rounded-md border p-2 text-sm ${
                erroresCampos.artifact ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
              }`}
            >
              <option value="SGU">SGU — Especificación de Casos de Uso / Requerimientos</option>
              <option value="VERSION">VERSION — Código Fuente y Arquitectura</option>
              <option value="UI">UI — Prototipos y Diseño de Interfaz</option>
              <option value="PLAN">PLAN — Plan de QA y Gestión del Proyecto</option>
            </select>
            {erroresCampos.artifact && (
              <p className="mt-1 text-xs text-rose-600">{erroresCampos.artifact}</p>
            )}
          </div>

          {/* Campos específicos para Revisión por Pares (FA-02.01) */}
          {esReview && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Participantes de la Revisión por Pares
              </h4>

              {/* Autor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Autor del Artefacto *
                </label>
                <select
                  value={authorId}
                  onChange={(e) => setAuthorId(e.target.value)}
                  className={`mt-1 block w-full rounded-md border p-2 text-sm ${
                    erroresCampos.authorId ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
                  }`}
                >
                  <option value="">Seleccione el autor...</option>
                  {miembros.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.member_name} ({m.role})
                    </option>
                  ))}
                </select>
                {erroresCampos.authorId && (
                  <p className="mt-1 text-xs text-rose-600">{erroresCampos.authorId}</p>
                )}
              </div>

              {/* Revisores */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Revisores Asignados * (Al menos uno distinto del autor)
                </label>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {miembros.map((m) => (
                    <label key={m.id} className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reviewerIds.includes(m.id)}
                        onChange={() => toggleRevisor(m.id)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span>
                        {m.member_name} <span className="text-slate-400">({m.role})</span>
                        {m.id === authorId && <span className="ml-1 text-amber-600 font-semibold">[Autor]</span>}
                      </span>
                    </label>
                  ))}
                </div>
                {erroresCampos.reviewerIds && (
                  <p className="mt-1 text-xs text-rose-600">{erroresCampos.reviewerIds}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-3 border-t">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-md border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar Planificación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
