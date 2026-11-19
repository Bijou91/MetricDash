import React from 'react';
import { nombreMetrica, ETIQUETA_NIVEL } from '../utils/etiquetasSalud';

export default function PanelAlertasActivasWidget({ alertas = [] }) {
  if (!alertas || alertas.length === 0) {
    return (
      <div
        style={{
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '8px',
          padding: '1rem',
          color: '#64748b',
          fontSize: '0.9rem',
          textAlign: 'center'
        }}
      >
        No hay alertas activas de deterioro en este momento. Todas las métricas se encuentran estables.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {alertas.map((alerta) => {
        const esCritico = alerta.nivelSemaforo === 'ROJO_CRITICO';
        return (
          <div
            key={alerta.id}
            style={{
              background: esCritico ? '#fef2f2' : '#fffbeb',
              borderLeft: `4px solid ${esCritico ? '#ef4444' : '#f59e0b'}`,
              borderRadius: '4px',
              padding: '0.85rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.85rem', color: esCritico ? '#991b1b' : '#92400e' }}>
                ⚠️ {nombreMetrica(alerta.tipoMetrica)} — {ETIQUETA_NIVEL[alerta.nivelSemaforo] || alerta.nivelSemaforo}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '2px' }}>
                {alerta.mensaje}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
              {new Date(alerta.fechaDeteccion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
