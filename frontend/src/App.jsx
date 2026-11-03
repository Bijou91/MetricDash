import React, { useEffect, useState } from 'react';
import RegistroProyectoView from './views/RegistroProyectoView';
import ConfigMetricasView from './views/ConfigMetricasView';
import VistaTableroDefecto from './views/VistaTableroDefecto';
import GestionActividadesSqaView from './views/GestionActividadesSqaView';
import VistaRegistroPruebas from './views/VistaRegistroPruebas';
import VistaAccionCorrectiva from './views/VistaAccionCorrectiva';
import * as proyectosApi from './api/ProyectosApiClient';

export default function App() {
  const [apiStatus, setApiStatus] = useState('Verificando conexión con el backend...');
  const [tabActiva, setTabActiva] = useState('cu01'); // 'cu01' | 'cu02' | 'cu03' | 'cu04' | 'cu05' | 'cu06'
  const [proyectoActivo, setProyectoActivo] = useState(null);
  const [actividadSqaFocoId, setActividadSqaFocoId] = useState(null);

  function refrescarProyectoActivo() {
    proyectosApi.obtenerProyectoPeriodoActivo()
      .then((data) => {
        if (data && data.existe) {
          setProyectoActivo(data.proyecto);
        } else {
          setProyectoActivo(null);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    proyectosApi.verificarConexion()
      .then((data) => setApiStatus(`Conectado al Backend (${data.status})`))
      .catch(() => setApiStatus('Backend aún no responde'));

    refrescarProyectoActivo();
  }, []);

  function cambiarTab(nuevaTab) {
    setTabActiva(nuevaTab);
    refrescarProyectoActivo();
  }

  function handleProyectoRegistrado(proyecto) {
    setProyectoActivo(proyecto);
  }

  const proyectoId = proyectoActivo?.id || import.meta.env.VITE_PROYECTO_ID || '';

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

        {/* Barra de Navegación Principal */}
        <nav className="mt-6 flex flex-wrap gap-3 border-b border-slate-200">
          <button
            type="button"
            onClick={() => cambiarTab('cu01')}
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
            onClick={() => cambiarTab('cu02')}
            className={`border-b-2 pb-2.5 text-sm font-semibold transition-colors ${
              tabActiva === 'cu02'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Métricas de Calidad y Umbrales
          </button>
          <button
            type="button"
            onClick={() => cambiarTab('cu03')}
            className={`border-b-2 pb-2.5 text-sm font-semibold transition-colors ${
              tabActiva === 'cu03'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Registro de Defectos
          </button>
          <button
            type="button"
            onClick={() => cambiarTab('cu04')}
            className={`border-b-2 pb-2.5 text-sm font-semibold transition-colors ${
              tabActiva === 'cu04'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Actividades SQA
          </button>
          <button
            type="button"
            onClick={() => cambiarTab('cu05')}
            className={`border-b-2 pb-2.5 text-sm font-semibold transition-colors ${
              tabActiva === 'cu05'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Resultados de Pruebas
          </button>
          <button
            type="button"
            onClick={() => cambiarTab('cu06')}
            className={`border-b-2 pb-2.5 text-sm font-semibold transition-colors ${
              tabActiva === 'cu06'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Acciones Correctivas
          </button>
        </nav>
      </header>

      <main>
        {tabActiva === 'cu01' && (
          <RegistroProyectoView
            onProyectoRegistrado={handleProyectoRegistrado}
            onIrACU02={() => cambiarTab('cu02')}
            onIrACU04={(actId) => {
              setActividadSqaFocoId(typeof actId === 'string' ? actId : null);
              cambiarTab('cu04');
            }}
            onIrACU06={() => cambiarTab('cu06')}
          />
        )}

        {tabActiva === 'cu02' && (
          proyectoId
            ? <ConfigMetricasView proyectoId={proyectoId} />
            : <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">Registre primero el proyecto del periodo.</p>
        )}

        {tabActiva === 'cu03' && (
          proyectoId
            ? <VistaTableroDefecto proyectoId={proyectoId} />
            : <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">Registre primero el proyecto del periodo.</p>
        )}

        {tabActiva === 'cu04' && (
          <GestionActividadesSqaView
            proyectoId={proyectoId}
            actividadInicialId={actividadSqaFocoId}
            onLimpiarActividadInicial={() => setActividadSqaFocoId(null)}
            onIrACU01={() => cambiarTab('cu01')}
            onIrACU02={() => cambiarTab('cu02')}
            onIrACU05={() => cambiarTab('cu05')}
          />
        )}

        {tabActiva === 'cu05' && (
          proyectoId
            ? <VistaRegistroPruebas proyectoId={proyectoId} />
            : <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">Registre primero el proyecto del periodo.</p>
        )}

        {tabActiva === 'cu06' && (
          proyectoActivo
            ? <VistaAccionCorrectiva proyectoId={proyectoActivo.id} />
            : <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">Registre primero el proyecto del periodo.</p>
        )}
      </main>
    </div>
  );
}
