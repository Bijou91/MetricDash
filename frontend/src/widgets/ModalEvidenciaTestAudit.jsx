import React, { useState } from 'react';
import * as api from '../api/ActividadesApiClient';

export default function ModalEvidenciaTestAudit({
  proyectoId,
  actividad,
  rondasPrevias = [],
  onCerrar,
  onFinalizado,
}) {
  const esTest = actividad.category === 'TEST';
  const [testSuiteId, setTestSuiteId] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setErrorMsg('');

    const dto = esTest
      ? { testSuiteId: testSuiteId || 'ronda-cu05-manual' }
      : { evidenceUrl };

    try {
      const { status, data } = await api.cerrarEvidencia(proyectoId, actividad.id, dto);
      if (status === 200) {
        if (onFinalizado) {
          onFinalizado(data);
        }
        onCerrar();
      } else {
        setErrorMsg(data?.mensaje || 'Error al registrar la evidencia de la actividad.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-bold text-slate-800">
            Registrar Evidencia ({actividad.category})
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
          <strong>Actividad:</strong> {actividad.title} — Fase: {actividad.phase}
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {esTest ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Seleccione la Ronda de Pruebas Registrada (CU-05) *
              </label>
              {rondasPrevias.length > 0 ? (
                <select
                  value={testSuiteId}
                  onChange={(e) => setTestSuiteId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm"
                  required
                >
                  <option value="">Seleccione una ronda...</option>
                  {rondasPrevias.map((r, i) => (
                    <option key={r.id || i} value={r.id || r.version}>
                      {r.version || `Ronda #${i + 1}`} — {r.passed_cases || r.pruebasExitosas || 0} exitosas / {r.executed_cases || r.pruebasEjecutadas || 0} ejecutadas
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={testSuiteId}
                  onChange={(e) => setTestSuiteId(e.target.value)}
                  placeholder="Identificador o versión de la ronda de pruebas"
                  className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm"
                  required
                />
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Enlace al Entregable / Bitácora de Auditoría *
              </label>
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://repo.docs/auditoria-sqa-final.pdf"
                className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm"
                required
              />
            </div>
          )}

          <div className="flex justify-end space-x-2 border-t pt-3">
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
              className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Marcar como Realizada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
