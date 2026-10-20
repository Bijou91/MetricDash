import React, { useEffect, useState } from 'react';
import ConfigMetricasView from './components/ConfigMetricasView';

// shortcut: proyecto demo sembrado en schema.sql; tomarlo del proyecto activo cuando exista CU-01.
const PROYECTO_ID = import.meta.env.VITE_PROYECTO_ID || '00000000-0000-0000-0000-000000000001';

export default function App() {
  const [apiStatus, setApiStatus] = useState('Verificando conexión con el backend...');

  useEffect(() => {
    fetch('http://localhost:4000/api/health')
      .then(res => res.json())
      .then(data => setApiStatus(`Conectado al Backend (${data.status})`))
      .catch(() => setApiStatus('Backend aún no responde en http://localhost:4000'));
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-4 font-sans text-slate-800 sm:p-8">
      <header className="mb-6 border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-bold text-blue-900">SQA Dashboard</h1>
        <p className="mt-2 text-slate-500">
          Herramienta de software para monitorear y gestionar actividades de Aseguramiento de Calidad de Software.
        </p>
      </header>

      <main>
        <div className="rounded-lg border border-slate-300 bg-slate-50 px-5 py-4">
          <h3 className="mb-2 font-semibold">Estado de la Arquitectura Base</h3>
          <p><strong>API Backend:</strong> {apiStatus}</p>
        </div>

        <div className="mt-6">
          <ConfigMetricasView proyectoId={PROYECTO_ID} />
        </div>
      </main>
    </div>
  );
}
