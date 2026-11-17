import React from 'react';

const MAPA_COLORES = {
  VERDE_OPTIMO: {
    bg: '#ecfdf5',
    border: '#10b981',
    text: '#065f46',
    badge: '#059669',
    badgeText: '#ffffff',
    label: 'Óptimo'
  },
  AMARILLO_ADVERTENCIA: {
    bg: '#fffbeb',
    border: '#f59e0b',
    text: '#92400e',
    badge: '#d97706',
    badgeText: '#ffffff',
    label: 'Advertencia'
  },
  ROJO_CRITICO: {
    bg: '#fef2f2',
    border: '#ef4444',
    text: '#991b1b',
    badge: '#dc2626',
    badgeText: '#ffffff',
    label: 'Crítico'
  },
  SIN_DATOS: {
    bg: '#f8fafc',
    border: '#94a3b8',
    text: '#475569',
    badge: '#64748b',
    badgeText: '#ffffff',
    label: 'Sin datos'
  }
};

const NOMBRES_METRICAS = {
  DENSIDAD_DEFECTOS: 'Densidad de Defectos',
  COBERTURA_PRUEBAS: 'Cobertura de Pruebas',
  TASA_EXITO_PRUEBAS: 'Tasa de Éxito de Pruebas',
  CUMPLIMIENTO_SQA: 'Cumplimiento Actividades SQA'
};

export default function SemaforoMetricasWidget({ indicadores = [] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
      {indicadores.map((ind) => {
        const estilo = MAPA_COLORES[ind.nivelSemaforo] || MAPA_COLORES.SIN_DATOS;
        const nombreMetrica = NOMBRES_METRICAS[ind.tipoMetrica] || ind.tipoMetrica;

        return (
          <div
            key={ind.tipoMetrica}
            style={{
              background: estilo.bg,
              border: `2px solid ${estilo.border}`,
              borderRadius: '10px',
              padding: '1.2rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    background: estilo.badge,
                    color: estilo.badgeText,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    textTransform: 'uppercase'
                  }}
                >
                  {estilo.label}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Meta: {ind.meta !== null ? `${ind.meta} ${ind.unidad}` : 'N/A'}
                </span>
              </div>

              <h4 style={{ margin: '0.25rem 0', fontSize: '0.95rem', color: '#0f172a' }}>
                {nombreMetrica}
              </h4>
            </div>

            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: '800', color: estilo.text }}>
                  {ind.valorActual !== null ? ind.valorActual : '--'}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{ind.unidad}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                Advertencia: {ind.advertencia ?? 'N/A'} | Crítico: {ind.critico ?? 'N/A'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
