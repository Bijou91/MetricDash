import React from 'react';
import { ETIQUETAS } from './metricas';

const COLORES = { VERDE: 'bg-green-600', AMARILLO: 'bg-yellow-600', ROJO: 'bg-red-600' };

export default function SemaforoPreviewWidget({ vistaPrevia }) {
  const tipos = [...new Set(vistaPrevia.rangos.map((r) => r.tipoMetrica))];
  return (
    <section aria-label="Vista previa del semáforo" className="mt-6">
      <h3 className="mb-2 font-semibold">Vista previa del semáforo de calidad</h3>
      {tipos.map((tipo) => (
        <div key={tipo} className="mb-3">
          <strong>{ETIQUETAS[tipo].nombre}</strong>
          <div className="mt-1 flex flex-wrap gap-2">
            {vistaPrevia.rangos.filter((r) => r.tipoMetrica === tipo).map((r) => (
              <span key={r.estado} className={`${COLORES[r.estado]} rounded px-2.5 py-1 text-sm text-white`}>
                {r.estado}: {r.desde} – {r.hasta ?? '∞'} {ETIQUETAS[tipo].unidad}
              </span>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
