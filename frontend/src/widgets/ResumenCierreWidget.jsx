import React from 'react';
import SemaforoWidget from './SemaforoWidget';

const ETIQUETA_METRICA = {
  DENSIDAD_DEFECTOS: ['Densidad de defectos', 'def/KLOC'],
  COBERTURA_PRUEBAS: ['Cobertura de pruebas', '%'],
  TASA_EXITO_PRUEBAS: ['Tasa de éxito de pruebas', '%'],
  CUMPLIMIENTO_SQA: ['Cumplimiento de actividades SQA', '%'],
};

// FN-05 / FN-06: resoluciones, retrospectiva y valores finales de las 4 métricas con las resoluciones aplicadas.
export default function ResumenCierreWidget({ resumen }) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-semibold text-slate-700">Valores finales de las métricas</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {resumen.valoresFinales.map((m) => (
            <SemaforoWidget
              key={m.tipoMetrica}
              etiqueta={ETIQUETA_METRICA[m.tipoMetrica][0]}
              unidad={ETIQUETA_METRICA[m.tipoMetrica][1]}
              valor={m.valorFinal}
              estado={m.estadoSemaforo}
            />
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-slate-700">Resoluciones ({resumen.resoluciones.length})</h3>
        <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
          {resumen.resoluciones.map((r) => (
            <li key={r.registroId}>
              <strong>{r.opcion}</strong> — {r.descripcion}{r.justificacion ? ` (${r.justificacion})` : ''}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-slate-700">Retrospectiva</h3>
        <dl className="mt-1 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="font-medium">Qué funcionó bien</dt><dd className="whitespace-pre-wrap text-slate-600">{resumen.retrospectiva.queFuncionoBien}</dd></div>
          <div><dt className="font-medium">Qué debe mejorar</dt><dd className="whitespace-pre-wrap text-slate-600">{resumen.retrospectiva.queDebeMejorar}</dd></div>
          <div><dt className="font-medium">Lecciones aprendidas</dt><dd className="whitespace-pre-wrap text-slate-600">{resumen.retrospectiva.leccionesAprendidas}</dd></div>
          <div><dt className="font-medium">Acuerdos</dt><dd className="whitespace-pre-wrap text-slate-600">{resumen.retrospectiva.acuerdos}</dd></div>
        </dl>
      </section>
    </div>
  );
}
