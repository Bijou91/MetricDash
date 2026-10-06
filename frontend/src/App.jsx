import React, { useEffect, useState } from 'react';

export default function App() {
  const [apiStatus, setApiStatus] = useState('Verificando conexión con el backend...');

  useEffect(() => {
    fetch('http://localhost:4000/api/health')
      .then(res => res.json())
      .then(data => setApiStatus(`Conectado al Backend (${data.status})`))
      .catch(() => setApiStatus('Backend aún no responde en http://localhost:4000'));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto', color: '#1e293b' }}>
      <header style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: '#1e3a8a' }}>SQA Dashboard</h1>
        <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>
          Herramienta de software para monitorear y gestionar actividades de Aseguramiento de Calidad de Software.
        </p>
      </header>

      <main>
        <div style={{ padding: '1rem 1.25rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Estado de la Arquitectura Base</h3>
          <p style={{ margin: 0 }}><strong>API Backend:</strong> {apiStatus}</p>
        </div>
      </main>
    </div>
  );
}
