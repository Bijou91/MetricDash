import React from 'react';

const ETIQUETA_TIPO = {
  ACTIVIDAD_SQA: 'Actividad SQA',
  DEFECTO: 'Defecto',
  ACCION_CORRECTIVA: 'Acción correctiva',
  ALERTA_DETERIORO: 'Alerta de deterioro',
};

const ETIQUETA_OPCION = { ARRASTRAR: 'Arrastrar al siguiente periodo', CANCELAR: 'Cancelar', CERRAR: 'Cerrar' };

// FN-03 (a)-(d): mismas reglas que Pendiente.opcionesPermitidas() del backend (el backend vuelve a validar).
function opcionesDe(pendiente) {
  const puedeCerrar = pendiente.tipo === 'DEFECTO'
    || (pendiente.tipo === 'ACTIVIDAD_SQA' && pendiente.tipoActividad !== 'REVISION_PARES' && Boolean(pendiente.evidencia));
  return puedeCerrar ? ['ARRASTRAR', 'CANCELAR', 'CERRAR'] : ['ARRASTRAR', 'CANCELAR'];
}

export function mostrarSinPendientes() {
  return (
    <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
      El periodo no tiene actividades, defectos, acciones correctivas ni alertas pendientes.
    </p>
  );
}

// FN-02 / FN-03: cada pendiente con su estado actual y sus opciones de resolución.
export default function PendientesPeriodoWidget({ pendientes, resoluciones, errores = {}, onResolver }) {
  if (pendientes.length === 0) return mostrarSinPendientes();
  return (
    <ul className="space-y-3">
      {pendientes.map((p) => {
        const r = resoluciones[p.registroId] || {};
        const error = errores[`resoluciones.${p.registroId}`];
        const requiereJustificacion = r.opcion === 'CANCELAR' || r.opcion === 'CERRAR';
        return (
          <li key={p.registroId} className={`rounded-lg border p-3 ${error ? 'border-red-400 bg-red-50/40' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{p.descripcion}</span>
              <span className="text-xs text-slate-500">{ETIQUETA_TIPO[p.tipo]} · {p.estadoActual}</span>
            </div>
            <fieldset className="mt-2 flex flex-wrap gap-4">
              <legend className="sr-only">Resolución de {p.descripcion}</legend>
              {opcionesDe(p).map((o) => (
                <label key={o} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name={`res-${p.registroId}`}
                    checked={r.opcion === o}
                    onChange={() => onResolver(p.registroId, o, r.justificacion || '')}
                  />
                  {ETIQUETA_OPCION[o]}
                </label>
              ))}
            </fieldset>
            {p.tipo === 'ACTIVIDAD_SQA' && p.tipoActividad !== 'REVISION_PARES' && !p.evidencia && (
              <p className="mt-1 text-xs text-slate-500">Sin evidencia registrada: solo puede arrastrarse o cancelarse.</p>
            )}
            {requiereJustificacion && (
              <label className="mt-2 block text-sm">
                <span className="text-slate-600">Justificación</span>
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                  rows={2}
                  value={r.justificacion || ''}
                  onChange={(e) => onResolver(p.registroId, r.opcion, e.target.value)}
                />
              </label>
            )}
            {error && <p className="mt-1 text-xs font-medium text-red-700">{error}</p>}
          </li>
        );
      })}
    </ul>
  );
}
