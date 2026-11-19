import React from 'react';

const CAMPOS = [
  ['queFuncionoBien', 'Qué funcionó bien'],
  ['queDebeMejorar', 'Qué debe mejorar'],
  ['leccionesAprendidas', 'Lecciones aprendidas'],
  ['acuerdos', 'Acuerdos del equipo'],
];

// FN-04: los 4 campos son obligatorios.
export default function RetrospectivaWidget({ retrospectiva, errores = {}, onCambiar }) {
  return (
    <div className="space-y-3">
      {CAMPOS.map(([campo, etiqueta]) => {
        const error = errores[`retrospectiva.${campo}`];
        return (
          <label key={campo} className="block text-sm">
            <span className="font-medium text-slate-700">{etiqueta} *</span>
            <textarea
              className={`mt-1 w-full rounded border p-2 text-sm ${error ? 'border-red-400' : 'border-slate-300'}`}
              rows={3}
              value={retrospectiva[campo] || ''}
              onChange={(e) => onCambiar({ ...retrospectiva, [campo]: e.target.value })}
            />
            {error && <span className="text-xs font-medium text-red-700">{error}</span>}
          </label>
        );
      })}
    </div>
  );
}
