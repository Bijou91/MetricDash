import React from 'react';
import { nombreMetrica, textoIndice, etiquetaEstadoGlobal } from '../utils/etiquetasSalud';

const MAPA_IMPACTO = {
  POSITIVO: { color: '#059669', badgeBg: '#d1fae5', label: 'Impacto Positivo (+)' },
  NEUTRO: { color: '#d97706', badgeBg: '#fef3c7', label: 'Impacto Neutro / Riesgo (~)' },
  NEGATIVO: { color: '#dc2626', badgeBg: '#fee2e2', label: 'Impacto Negativo (-)' },
  SIN_DATOS: { color: '#64748b', badgeBg: '#f1f5f9', label: 'Sin Datos (?)' }
};

export default function PrevisualizacionReporteWidget({
  previsualizacion,
  notasEjecutivas,
  onCambioNotas,
  onConfirmar,
  onCancelar,
  generando
}) {
  if (!previsualizacion) return null;

  const {
    versionReporteSiguiente,
    estadoIndice,
    indiceSaludGeneral_nullable,
    medicionesCompletas,
    desgloseImpacto = []
  } = previsualizacion;

  const sinDatos = !medicionesCompletas || estadoIndice !== 'CALCULADO';
  const mensajeAviso = estadoIndice === 'INSUFICIENTE'
    ? 'Solo algunas de las 4 métricas tienen mediciones registradas, por lo que el índice no se puede calcular. El reporte indicará "Insuficiente" en el índice de salud y marcará como "Sin datos" las métricas que faltan.'
    : 'Ninguna de las 4 métricas tiene mediciones registradas, por lo que el índice no se puede calcular. El reporte indicará "Sin datos" en el índice de salud.';

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ margin: 0, color: '#1e3a8a', fontSize: '1.2rem' }}>
            Previsualización: Reporte de Salud #{versionReporteSiguiente}
          </h3>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Revisión determinista y desglose ordenado por criticidad de métrica
          </span>
        </div>
        <button
          onClick={onCancelar}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: '#94a3b8'
          }}
        >
          ✕
        </button>
      </div>

      {/* Aviso cuando el índice no se puede calcular */}
      {sinDatos && (
        <div
          style={{
            background: '#fffbeb',
            borderLeft: '4px solid #f59e0b',
            padding: '0.75rem 1rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            color: '#92400e'
          }}
        >
          <strong>Aviso:</strong> {mensajeAviso}
        </div>
      )}

      {/* Tarjeta del Índice de Salud General */}
      <div
        style={{
          background: sinDatos ? '#f8fafc' : '#eff6ff',
          border: `1px solid ${sinDatos ? '#cbd5e1' : '#bfdbfe'}`,
          borderRadius: '8px',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}
      >
        <div>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold' }}>
            Índice de Salud General del Proyecto
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: sinDatos ? '#64748b' : '#1e40af' }}>
            {textoIndice(estadoIndice, indiceSaludGeneral_nullable)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {sinDatos
              ? 'Requiere mediciones de las 4 métricas vigentes'
              : 'Promedio ponderado determinista (Verde=100%, Amarillo=50%, Rojo=0%)'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: '700',
              background: sinDatos ? '#e2e8f0' : (indiceSaludGeneral_nullable >= 80 ? '#dcfce7' : indiceSaludGeneral_nullable >= 50 ? '#fef3c7' : '#fee2e2'),
              color: sinDatos ? '#475569' : (indiceSaludGeneral_nullable >= 80 ? '#15803d' : indiceSaludGeneral_nullable >= 50 ? '#b45309' : '#b91c1c')
            }}
          >
            {etiquetaEstadoGlobal(estadoIndice, previsualizacion.estadoSaludGlobal)}
          </span>
        </div>
      </div>

      {/* Desglose de impacto ordenado por criticidad */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: '#1e293b' }}>
          Desglose del Impacto por Métrica (Ordenado por Criticidad)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {desgloseImpacto.map((item, index) => {
            const impInfo = MAPA_IMPACTO[item.impacto] || MAPA_IMPACTO.SIN_DATOS;
            return (
              <div
                key={item.tipoMetrica}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#fafafa'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#0f172a' }}>
                      #{index + 1} {nombreMetrica(item.tipoMetrica)}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: impInfo.badgeBg,
                        color: impInfo.color
                      }}
                    >
                      {impInfo.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    {item.justificacionImpacto}
                  </div>
                </div>

                <div style={{ textAlign: 'right', marginLeft: '1rem', minWidth: '120px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b' }}>
                    Medido: {item.valorMedido ?? '--'} (Meta: {item.valorMeta ?? '--'})
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Aporte: +{item.puntajeAportado}% / 25%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Espacio para notas ejecutivas */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <label htmlFor="notasEjecutivas" style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' }}>
            Notas Ejecutivas Propias (Opcionales)
          </label>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Si se omiten, el reporte se generará con el desglose automático
          </span>
        </div>
        <textarea
          id="notasEjecutivas"
          rows={3}
          value={notasEjecutivas}
          onChange={(e) => onCambioNotas(e.target.value)}
          placeholder="Escriba aquí notas gerenciales, justificaciones o planes de contingencia para este corte..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Acciones de confirmación */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
        <button
          onClick={onCancelar}
          disabled={generando}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            fontWeight: '600',
            color: '#475569',
            cursor: 'pointer'
          }}
        >
          Cancelar y Volver al Tablero
        </button>
        <button
          onClick={onConfirmar}
          disabled={generando}
          style={{
            background: generando ? '#93c5fd' : '#2563eb',
            border: 'none',
            borderRadius: '6px',
            padding: '0.5rem 1.25rem',
            fontSize: '0.85rem',
            fontWeight: '600',
            color: '#ffffff',
            cursor: generando ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {generando ? 'Guardando y compilando PDF...' : 'Confirmar y exportar a PDF'}
        </button>
      </div>
    </div>
  );
}
