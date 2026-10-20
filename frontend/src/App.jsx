import React, { useEffect, useState } from 'react';
import RegistroProyectoView from './views/RegistroProyectoView';
import ConfigMetricasView from './views/ConfigMetricasView';
import * as proyectosApi from './api/ProyectosApiClient';

export default function App() {
  const [apiStatus, setApiStatus] = useState('Verificando conexión con el backend...');
  const [tabActiva, setTabActiva] = useState('cu01'); // 'cu01' | 'cu02'
  const [proyectoActivo, setProyectoActivo] = useState(null);

  useEffect(() => {
    proyectosApi.verificarConexion()
      .then((data) => setApiStatus(`Conectado al Backend (${data.status})`))
      .catch(() => setApiStatus('Backend aún no responde'));

    // Consultar si ya existe proyecto activo registrado
    proyectosApi.obtenerProyectoPeriodoActivo()
      .then((data) => {
        if (data && data.existe) {
          setProyectoActivo(data.proyecto);
        }
      })
      .catch(() => {});
  }, []);

  function handleProyectoRegistrado(proyecto) {
    setProyectoActivo(proyecto);
  }

  const proyectoId = proyectoActivo?.id || import.meta.env.VITE_PROYECTO_ID || '00000000-0000-0000-0000-000000000001';

  return (
    <div className="mx-auto max-w-5xl p-4 font-sans text-slate-800 sm:p-8">
      <header className="mb-6 border-b border-slate-200 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">MetricDash</h1>
            <p className="mt-1 text-sm text-slate-500">
              Sistema de Aseguramiento de Calidad de Software — Morelosoft International Solutions & co
            </p>
          </div>
          <div className="mt-3 sm:mt-0 text-right">
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              {apiStatus}
            </span>
          </div>
        </div>

        {/* Barra de Navegación entre Casos de Uso */}
        <nav className="mt-6 flex space-x-3 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setTabActiva('cu01')}
            className={`border-b-2 pb-2.5 text-sm font-semibold transition-colors ${
              tabActiva === 'cu01'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Registro de Proyecto y Plan QA
          </button>
          <button
            type="button"
            onClick={() => setTabActiva('cu02')}
            className={`border-b-2 pb-2.5 text-sm font-semibold transition-colors ${
              tabActiva === 'cu02'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Métricas de Calidad y Umbrales
          </button>
        </nav>
      </header>

      <main>
        {tabActiva === 'cu01' && (
          <RegistroProyectoView
            onProyectoRegistrado={handleProyectoRegistrado}
            onIrACU02={() => setTabActiva('cu02')}
          />
        )}

        {tabActiva === 'cu02' && (
          <div>
            {!proyectoActivo && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <strong>Nota:</strong> No se detectó un proyecto nuevo en la sesión actual; utilizando el ID de proyecto predeterminado.
              </div>
            )}
            <ConfigMetricasView proyectoId={proyectoId} />
          </div>
        )}
      </main>
    </div>
  );
}
