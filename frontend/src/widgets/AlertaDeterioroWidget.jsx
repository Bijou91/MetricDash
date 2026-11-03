import React, { useState } from 'react';

const ESTILOS_SEMAFORO = {
  ROJO_CRITICO: {
    borde: 'border-red-400 bg-red-50/90 text-red-900',
    badge: 'bg-red-600 text-white',
    titulo: 'ALERTA CRÍTICA DE DETERIORO (ROJO)',
  },
  AMARILLO_ADVERTENCIA: {
    borde: 'border-amber-400 bg-amber-50/90 text-amber-900',
    badge: 'bg-amber-600 text-white',
    titulo: 'ALERTA DE ADVERTENCIA POR DETERIORO (AMARILLO)',
  },
  VERDE_OPTIMO: {
    borde: 'border-green-300 bg-green-50 text-green-900',
    badge: 'bg-green-600 text-white',
    titulo: 'MÉTRICA ESTABLE',
  },
};

const ETIQUETAS_METRICAS = {
  DENSIDAD_DEFECTOS: 'Densidad de Defectos',
  COBERTURA_PRUEBAS: 'Cobertura de Pruebas',
  TASA_EXITO_PRUEBAS: 'Tasa de Éxito de Pruebas',
  CUMPLIMIENTO_SQA: 'Cumplimiento SQA',
};

export default function AlertaDeterioroWidget({ alerta, onIniciarAccion, onPosponer }) {
  const [mostrarCausas, setMostrarCausas] = useState(true);

  if (!alerta || alerta.estado === 'RESUELTA' || alerta.estado === 'DESCARTADA') {
    return null;
  }

  const estilo = ESTILOS_SEMAFORO[alerta.nivelSemaforo] || ESTILOS_SEMAFORO.AMARILLO_ADVERTENCIA;
  const nombreMetrica = ETIQUETAS_METRICAS[alerta.tipoMetrica] || alerta.tipoMetrica;
  const causas = Array.isArray(alerta.posiblesCausas) ? alerta.posiblesCausas : [];
  const tendencia = Array.isArray(alerta.tendencia) ? alerta.tendencia : [];

  return (
    <div className={`mb-6 rounded-lg border-2 p-5 shadow-sm transition-all ${estilo.borde}`}>
      {/* Cabecera de Alerta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-700 text-base font-black">
            ⚠
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${estilo.badge}`}>
                {estilo.titulo}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {nombreMetrica}
              </span>
            </div>
            <h4 className="mt-1 text-base font-bold text-slate-900">
              {alerta.mensaje}
            </h4>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2">
          {onPosponer && (
            <button
              type="button"
              onClick={() => onPosponer(alerta)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              Posponer (FA-04.01)
            </button>
          )}
          {onIniciarAccion && (
            <button
              type="button"
              onClick={() => onIniciarAccion(alerta)}
              className="rounded-md bg-blue-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition"
            >
              + Crear Acción Correctiva (FN-04)
            </button>
          )}
        </div>
      </div>

      {/* Gráfico / Serie de Tendencia (FN-02: últimas mediciones disponibles) */}
      <div className="mt-4 rounded-md border border-slate-200/80 bg-white p-3 shadow-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Tendencia de la Métrica (Últimas Mediciones):
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {tendencia.length > 0 ? (
            tendencia.map((pt, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
              >
                <span className="font-semibold text-slate-600">
                  {pt.nombreCorte || `M-${idx + 1}`}:
                </span>
                <span className="font-extrabold text-slate-900">
                  {pt.valor}
                </span>
                {pt.estadoSemaforo && (
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                      ESTILOS_SEMAFORO[pt.estadoSemaforo]?.badge || 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    {pt.estadoSemaforo}
                  </span>
                )}
                {idx < tendencia.length - 1 && (
                  <span className="text-slate-400 font-bold ml-1">➔</span>
                )}
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-500">
              Valor inicial registrado: <strong>{alerta.valorInicial}</strong> ➔ Valor actual:{' '}
              <strong className="text-red-700">{alerta.valorActual}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Posibles Causas Identificadas (FN-02) */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setMostrarCausas(!mostrarCausas)}
          className="text-xs font-bold text-blue-800 hover:underline flex items-center gap-1"
        >
          <span>{mostrarCausas ? '▼ Ocultar' : '▶ Mostrar'}</span>
          <span>Posibles Causas Detectadas ({causas.length})</span>
        </button>

        {mostrarCausas && (
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {causas.length > 0 ? (
              causas.map((c, i) => (
                <div
                  key={c.id || i}
                  className="rounded border border-amber-200/70 bg-amber-100/50 px-3 py-1.5 text-xs text-slate-800 flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{c.descripcion}</span>
                  </div>
                  {c.severidad && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                        c.severidad === 'CRITICA'
                          ? 'bg-red-700 text-white'
                          : c.severidad === 'ALTA'
                          ? 'bg-orange-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {c.severidad}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs italic text-slate-500">
                No se registraron defectos abiertos ni pruebas fallidas específicas asociadas en este corte.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

