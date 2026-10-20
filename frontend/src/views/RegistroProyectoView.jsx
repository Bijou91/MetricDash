import React, { useEffect, useState } from 'react';
import * as proyectosApi from '../api/ProyectosApiClient';
import PlanQABaseWidget from '../widgets/PlanQABaseWidget';
import TableroInicialWidget from '../widgets/TableroInicialWidget';

const TIPOS_PROYECTO = [
  { valor: 'DESARROLLO_NUEVO', etiqueta: 'Desarrollo Nuevo (Ciclo Completo ISO/IEC 29110)' },
  { valor: 'MANTENIMIENTO', etiqueta: 'Mantenimiento (Adaptado con Análisis de Impacto)' },
  { valor: 'MIGRACION', etiqueta: 'Migración (Adaptado con Auditoría de Datos)' },
];

const ROLES_DISPONIBLES = [
  { valor: 'QA', etiqueta: 'Responsable de Calidad (QA)' },
  { valor: 'TECNICO', etiqueta: 'Líder Técnico' },
  { valor: 'GESTION_PROYECTO', etiqueta: 'Gestión de Proyecto' },
];

export default function RegistroProyectoView({ onProyectoRegistrado, onIrACU02 }) {
  const [periodoActivo, setPeriodoActivo] = useState(null);
  const [proyectoActivo, setProyectoActivo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Formulario de registro (inicia limpio, sin datos hardcodeados)
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [tipoProyecto, setTipoProyecto] = useState('DESARROLLO_NUEVO');
  const [estimatedKloc, setEstimatedKloc] = useState('');
  const [integrantes, setIntegrantes] = useState([]);

  // Estados de interfaz y propuestas
  const [propuestaPlan, setPropuestaPlan] = useState(null);
  const [mostrarPrevisualizacionPlan, setMostrarPrevisualizacionPlan] = useState(false);
  const [cargandoPropuesta, setCargandoPropuesta] = useState(false);
  const [mostrarModalTestDoble, setMostrarModalTestDoble] = useState(false);

  // Alertas y errores
  const [errores, setErrores] = useState([]);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    cargarEstadoInicial();
  }, []);

  // Recargar propuesta de plan cuando cambie el tipo de proyecto
  useEffect(() => {
    if (mostrarPrevisualizacionPlan) {
      cargarPropuestaPlan(tipoProyecto);
    }
  }, [tipoProyecto, mostrarPrevisualizacionPlan]);

  async function cargarEstadoInicial() {
    setCargando(true);
    setMensaje(null);
    try {
      // 1. Obtener periodo académico activo
      const infoPeriodo = await proyectosApi.obtenerPeriodoActivo();
      if (infoPeriodo && infoPeriodo.periodo) {
        setPeriodoActivo(infoPeriodo.periodo);
      }

      // 2. Verificar si ya existe proyecto registrado en el periodo
      const infoProyecto = await proyectosApi.obtenerProyectoPeriodoActivo();
      if (infoProyecto && infoProyecto.existe) {
        setProyectoActivo(infoProyecto);
        if (onProyectoRegistrado) {
          onProyectoRegistrado(infoProyecto.proyecto);
        }
      } else {
        setProyectoActivo(null);
      }
    } catch (err) {
      console.warn('Error al verificar periodo/proyecto activo:', err);
    } finally {
      setCargando(false);
    }
  }

  async function cargarPropuestaPlan(tipo) {
    setCargandoPropuesta(true);
    try {
      const plan = await proyectosApi.obtenerPropuestaPlan(tipo);
      setPropuestaPlan(plan);
    } catch (e) {
      console.error('Error al cargar propuesta de plan:', e);
    } finally {
      setCargandoPropuesta(false);
    }
  }

  // Manejo dinámico de integrantes
  function handleAgregarIntegrante() {
    setIntegrantes((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), role: 'QA', memberName: '', email: '' },
    ]);
  }

  function handleEliminarIntegrante(id) {
    setIntegrantes((prev) => prev.filter((i) => i.id !== id));
  }

  function handleActualizarIntegrante(id, campo, valor) {
    setIntegrantes((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i))
    );
  }

  // Plantilla rápida de ayuda para pruebas
  function handleCargarPlantillaEquipo() {
    setIntegrantes([
      { id: 1, role: 'QA', memberName: 'Héctor Varela', email: 'hector.varela@uaz.edu.mx' },
      { id: 2, role: 'TECNICO', memberName: 'Carlos Aguirre', email: 'carlos.aguirre@uaz.edu.mx' },
      { id: 3, role: 'GESTION_PROYECTO', memberName: 'Karol Espino', email: 'karol.espino@uaz.edu.mx' },
    ]);
    if (!nombre) setNombre('MetricDash SQA');
    if (!estimatedKloc) setEstimatedKloc('4.5');
    if (!descripcion) setDescripcion('Sistema para monitorear y gestionar actividades de Aseguramiento de Calidad.');
  }

  function handleLimpiarIntegrantes() {
    setIntegrantes([]);
  }

  // Envío del registro del proyecto (FN-01 / FN-02)
  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setErrores([]);
    setMensaje(null);

    const klocNum = estimatedKloc === '' ? null : Number(estimatedKloc);

    const listaIntegrantes = integrantes.map((m) => ({
      role: m.role,
      memberName: (m.memberName || '').trim(),
      email: (m.email || '').trim(),
    }));

    const payload = {
      name: nombre.trim(),
      description: descripcion.trim(),
      gitRepoUrl: gitRepoUrl.trim(),
      projectType: tipoProyecto,
      estimatedKloc: klocNum,
      periodId: periodoActivo ? periodoActivo.id : undefined,
      members: listaIntegrantes,
      rolesEquipo: listaIntegrantes,
    };

    try {
      const resp = await proyectosApi.registrarProyecto(payload);

      // FA-02.02: Campos o roles incompletos
      if (resp.status === 400) {
        setErrores(resp.data?.errores || []);
        setMensaje({
          tipo: 'error',
          texto: 'Validación fallida (FA-02.02): Verifique los campos y roles obligatorios resaltados en rojo.',
        });
        return;
      }

      // FA-02.01: Restricción monoproyecto excedida
      if (resp.status === 409) {
        setMensaje({
          tipo: 'alerta',
          texto: resp.data?.mensaje || 'Ya existe un proyecto activo registrado para el periodo en curso (FA-02.01).',
        });
        await cargarEstadoInicial();
        return;
      }

      if (resp.ok && resp.data) {
        setProyectoActivo({
          existe: true,
          proyecto: resp.data.proyecto,
          roles: resp.data.roles,
          planQA: resp.data.planQA,
          lineaBase: resp.data.lineaBase,
          tableroInicial: resp.data.tableroInicial,
        });
        setMensaje({
          tipo: 'exito',
          texto: `¡Proyecto "${resp.data.proyecto.name}" registrado con éxito! Plan de QA base y línea base generados formalmente.`,
        });
        if (onProyectoRegistrado) {
          onProyectoRegistrado(resp.data.proyecto);
        }
      }
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: err.message || 'Error de persistencia en la base de datos (FE-01).',
      });
    } finally {
      setEnviando(false);
    }
  }

  // Actualizar estado de una actividad en vivo
  async function handleCambiarEstadoActividad(actividadId, nuevoEstado) {
    try {
      const actualizada = await proyectosApi.actualizarEstadoActividad(actividadId, nuevoEstado);
      if (actualizada && proyectoActivo) {
        setProyectoActivo((prev) => ({
          ...prev,
          planQA: {
            ...prev.planQA,
            actividades: prev.planQA.actividades.map((a) =>
              a.id === actividadId ? { ...a, status: nuevoEstado } : a
            ),
          },
        }));
      }
    } catch (err) {
      alert(`Error al actualizar actividad: ${err.message}`);
    }
  }

  // Reiniciar / Eliminar proyecto para volver a probar desde cero
  async function handleReiniciarProyecto() {
    if (!proyectoActivo?.proyecto?.id) return;
    const seguro = window.confirm(
      '¿Estás seguro de que deseas eliminar este proyecto y sus datos asociados? Esta acción te permitirá volver a registrar el proyecto desde cero para testear el CU-01.'
    );
    if (!seguro) return;

    try {
      await proyectosApi.eliminarProyecto(proyectoActivo.proyecto.id);
      setProyectoActivo(null);
      setMensaje({
        tipo: 'exito',
        texto: 'El proyecto fue reiniciado. Ahora puedes probar el registro del proyecto (CU-01) completamente desde cero.',
      });
      // Limpiar formulario para empezar fresco
      setNombre('');
      setDescripcion('');
      setGitRepoUrl('');
      setEstimatedKloc('');
      setIntegrantes([]);
      if (onProyectoRegistrado) onProyectoRegistrado(null);
    } catch (err) {
      setMensaje({
        tipo: 'error',
        texto: `Error al reiniciar proyecto: ${err.message}`,
      });
    }
  }

  const errorDe = (campo) => errores.filter((e) => e.campo === campo);

  // Verificación de los 3 roles obligatorios en tiempo real
  const rolesPresentes = new Set(integrantes.map((i) => i.role));
  const tieneQA = rolesPresentes.has('QA');
  const tieneTecnico = rolesPresentes.has('TECNICO');
  const tieneGestion = rolesPresentes.has('GESTION_PROYECTO');

  if (cargando) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
        <p className="text-sm font-medium">Cargando estado del periodo académico y proyecto...</p>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Encabezado Principal */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              CU-01: Registrar el Proyecto del Periodo y Plan Base de QA
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Periodo Académico Activo:{' '}
              <strong className="text-slate-800">
                {periodoActivo ? `${periodoActivo.name} (${periodoActivo.code})` : 'Periodo no disponible'}
              </strong>
            </p>
          </div>
          <div className="mt-2 sm:mt-0 flex items-center gap-2">
            {proyectoActivo?.existe ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                ● Proyecto Vigente Registrado
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                ○ Listo para Registrar Proyecto
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alertas y Mensajes */}
      {mensaje && (
        <div
          role="alert"
          className={`rounded-lg p-4 text-sm font-medium transition-all ${
            mensaje.tipo === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : mensaje.tipo === 'alerta'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold">{mensaje.texto}</span>
            <button
              type="button"
              onClick={() => setMensaje(null)}
              className="text-xs font-bold uppercase opacity-60 hover:opacity-100 ml-4"
            >
              ✕ Cerrar
            </button>
          </div>
          {errores.length > 0 && (
            <div className="mt-3 border-t border-red-200 pt-2 text-xs">
              <span className="font-bold text-red-900">Detalle de validaciones pendientes:</span>
              <ul className="mt-1 list-disc pl-5 space-y-1 text-red-800">
                {errores.map((err, i) => (
                  <li key={i}>{err.mensaje}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA A: SI YA EXISTE UN PROYECTO REGISTRADO EN EL PERIODO                */}
      {/* ========================================================================= */}
      {proyectoActivo?.existe ? (
        <div className="space-y-6">
          {/* Ficha Resumen del Proyecto Activo con Acciones Interactivas */}
          <div className="rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50/70 to-teal-50/50 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Proyecto Monitoreado en Curso</span>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                  {proyectoActivo.proyecto.name}
                </h3>
                <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                  {proyectoActivo.proyecto.description || 'Sin descripción adicional proporcionada.'}
                </p>
                {proyectoActivo.proyecto.git_repo_url && (
                  <p className="mt-1.5 text-xs text-blue-700">
                    <strong>Repositorio Git:</strong>{' '}
                    <a
                      href={proyectoActivo.proyecto.git_repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-900 font-mono"
                    >
                      {proyectoActivo.proyecto.git_repo_url}
                    </a>
                  </p>
                )}
              </div>

              {/* Botones de Acción en Cabecera */}
              <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
                {onIrACU02 && (
                  <button
                    type="button"
                    onClick={onIrACU02}
                    className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-800 transition"
                  >
                    🎯 Configurar Métricas (CU-02) →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMostrarModalTestDoble(true)}
                  className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                  title="Prueba el flujo alternativo FA-02.01 intentando registrar un segundo proyecto"
                >
                  🧪 Probar Restricción Monoproyecto (FA-02.01)
                </button>
                <button
                  type="button"
                  onClick={handleReiniciarProyecto}
                  className="inline-flex items-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                  title="Elimina este proyecto para poder volver a probar el formulario de registro"
                >
                  🗑️ Reiniciar Proyecto
                </button>
              </div>
            </div>

            {/* Metadatos Clave en Cuadrícula */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-emerald-200/60 pt-4 text-xs">
              <div className="rounded-lg bg-white/70 p-3 border border-emerald-100">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Tipo de Proyecto</span>
                <div className="mt-1 text-sm font-bold text-slate-800">
                  {proyectoActivo.proyecto.project_type || proyectoActivo.proyecto.projectType}
                </div>
              </div>
              <div className="rounded-lg bg-white/70 p-3 border border-emerald-100">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Tamaño Estimado</span>
                <div className="mt-1 text-sm font-bold text-slate-800">
                  {proyectoActivo.proyecto.estimated_kloc || proyectoActivo.proyecto.estimatedKloc} KLOC
                </div>
              </div>
              <div className="rounded-lg bg-white/70 p-3 border border-emerald-100">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Estado Operativo</span>
                <div className="mt-1 text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> ACTIVO
                </div>
              </div>
              <div className="rounded-lg bg-white/70 p-3 border border-emerald-100">
                <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Ciclo Escolar</span>
                <div className="mt-1 text-sm font-bold text-slate-800">
                  {periodoActivo?.name || 'Agosto-Diciembre 2026'}
                </div>
              </div>
            </div>

            {/* Lista de Integrantes y Roles Asignados */}
            <div className="mt-4 border-t border-emerald-200/60 pt-3">
              <span className="text-[11px] uppercase font-bold text-slate-600 tracking-wider">
                Equipo de Desarrollo Asignado ({proyectoActivo.roles?.length || 0} integrantes):
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {proyectoActivo.roles && proyectoActivo.roles.length > 0 ? (
                  proyectoActivo.roles.map((r, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs border border-slate-200"
                    >
                      <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        r.role === 'QA'
                          ? 'bg-purple-100 text-purple-800'
                          : r.role === 'TECNICO'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {r.role}
                      </span>
                      <strong className="text-slate-900">{r.memberName || r.member_name}</strong>
                      {(r.email) && (
                        <span className="ml-1.5 text-slate-400 font-normal">({r.email})</span>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-slate-500 italic">No hay integrantes registrados en el equipo.</span>
                )}
              </div>
            </div>
          </div>

          {/* Plan Base SQA Interactivo con Transiciones de Estado */}
          <PlanQABaseWidget
            planQA={proyectoActivo.planQA}
            onCambiarEstadoActividad={handleCambiarEstadoActividad}
          />

          {/* Tablero Inicial de Control (Corte 1) */}
          <TableroInicialWidget
            tablero={proyectoActivo.tableroInicial}
            lineaBase={proyectoActivo.lineaBase}
          />

          {/* Modal / Panel para Probar FA-02.01 (Doble Registro) */}
          {mostrarModalTestDoble && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b pb-3">
                  <h4 className="text-base font-bold text-slate-900">
                    Probar Flujo Alternativo FA-02.01 (Restricción Monoproyecto)
                  </h4>
                  <button
                    type="button"
                    onClick={() => setMostrarModalTestDoble(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-600">
                  La especificación dicta que el sistema debe rechazar el registro de un segundo proyecto en el mismo periodo académico, impidiendo violar el alcance monoproyecto.
                </p>

                <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
                  Presiona el botón para enviar una petición de registro de un segundo proyecto al backend y verificar que responde con <strong>HTTP 409 Conflict</strong>.
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarModalTestDoble(false)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setMostrarModalTestDoble(false);
                      try {
                        const resp = await proyectosApi.registrarProyecto({
                          name: 'Proyecto Adicional Intruso',
                          projectType: 'MANTENIMIENTO',
                          estimatedKloc: 3.0,
                          periodId: periodoActivo?.id,
                          members: [
                            { role: 'QA', memberName: 'Tester QA' },
                            { role: 'TECNICO', memberName: 'Tester Dev' },
                            { role: 'GESTION_PROYECTO', memberName: 'Tester PM' },
                          ],
                        });
                        if (resp.status === 409) {
                          setMensaje({
                            tipo: 'alerta',
                            texto: `✓ Prueba FA-02.01 superada: El sistema bloqueó la acción con HTTP 409. Mensaje del backend: "${resp.data?.mensaje}"`,
                          });
                        }
                      } catch (e) {
                        alert(`Resultado: ${e.message}`);
                      }
                    }}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow"
                  >
                    Intentar Registrar Segundo Proyecto (Test FA-02.01)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* VISTA B: FORMULARIO DINÁMICO DE REGISTRO DE PROYECTO (FN-01 / FN-02)       */
        /* ========================================================================= */
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tarjeta de Datos Generales */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  1. Datos Generales del Proyecto Monitoreado
                </h3>
                <p className="text-xs text-slate-500">
                  Captura el nombre, tipo de desarrollo y dimensión estimada para iniciar la gobernanza de calidad.
                </p>
              </div>

              {/* Botón de ayuda para rellenar datos rápidos */}
              <button
                type="button"
                onClick={handleCargarPlantillaEquipo}
                className="mt-2 sm:mt-0 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
              >
                ⚡ Rellenar con Datos de Ejemplo Rápidos
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Nombre del Proyecto */}
              <div className="sm:col-span-2">
                <label htmlFor="nombre-proyecto" className="block text-xs font-bold uppercase text-slate-700">
                  Nombre del Proyecto *
                </label>
                <input
                  id="nombre-proyecto"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. MetricDash SQA"
                  className={`mt-1 block w-full rounded-lg border p-2.5 text-sm shadow-xs transition ${
                    errorDe('nombre').length ? 'border-red-500 bg-red-50/50' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {errorDe('nombre').map((e, idx) => (
                  <p key={idx} className="mt-1 text-xs text-red-600 font-medium">⚠ {e.mensaje}</p>
                ))}
              </div>

              {/* Tipo de Proyecto */}
              <div>
                <label htmlFor="tipo-proyecto" className="block text-xs font-bold uppercase text-slate-700">
                  Tipo de Proyecto *
                </label>
                <select
                  id="tipo-proyecto"
                  value={tipoProyecto}
                  onChange={(e) => setTipoProyecto(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm shadow-xs bg-white focus:border-blue-500"
                >
                  {TIPOS_PROYECTO.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Determina la propuesta de actividades SQA según ISO/IEC 29110 (FN-03).
                </p>
              </div>

              {/* KLOC Estimado */}
              <div>
                <label htmlFor="kloc-estimado" className="block text-xs font-bold uppercase text-slate-700">
                  Tamaño Estimado (KLOC) *
                </label>
                <input
                  id="kloc-estimado"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={estimatedKloc}
                  onChange={(e) => setEstimatedKloc(e.target.value)}
                  placeholder="Ej. 4.5"
                  className={`mt-1 block w-full rounded-lg border p-2.5 text-sm shadow-xs transition ${
                    errorDe('tamanoProductoKLOC').length ? 'border-red-500 bg-red-50/50' : 'border-slate-300 focus:border-blue-500'
                  }`}
                />
                {errorDe('tamanoProductoKLOC').map((e, idx) => (
                  <p key={idx} className="mt-1 text-xs text-red-600 font-medium">⚠ {e.mensaje}</p>
                ))}
              </div>

              {/* URL del Repositorio Git */}
              <div>
                <label htmlFor="git-url" className="block text-xs font-bold uppercase text-slate-700">
                  URL del Repositorio Git
                </label>
                <input
                  id="git-url"
                  type="url"
                  value={gitRepoUrl}
                  onChange={(e) => setGitRepoUrl(e.target.value)}
                  placeholder="https://github.com/Morelosoft/MetricDash"
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm shadow-xs focus:border-blue-500 font-mono"
                />
              </div>

              {/* Descripción */}
              <div>
                <label htmlFor="desc-proyecto" className="block text-xs font-bold uppercase text-slate-700">
                  Descripción / Alcance del Software
                </label>
                <input
                  id="desc-proyecto"
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Resumen del software a evaluar..."
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 text-sm shadow-xs focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Tarjeta de Asignación Dinámica de Integrantes (FA-02.02) */}
          <div className={`rounded-xl border bg-white p-6 shadow-sm transition ${
            (errores.some((e) => e.campo === 'rolesEquipo' || e.campo.startsWith('rol_')) || (errores.length > 0 && (!tieneQA || !tieneTecnico || !tieneGestion)))
              ? 'border-red-400 ring-2 ring-red-100'
              : 'border-slate-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  2. Asignación de Roles del Equipo de Trabajo
                </h3>
                <p className="text-xs text-slate-500">
                  Es mandatorio asignar al menos un integrante con nombre a cada rol obligatorio: <strong>QA</strong>, <strong>Líder Técnico</strong> y <strong>Gestión de Proyecto</strong> (FA-02.02).
                </p>
              </div>

              {/* Botones de control de integrantes */}
              <div className="mt-2 sm:mt-0 flex gap-2">
                <button
                  type="button"
                  onClick={handleAgregarIntegrante}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition"
                >
                  + Agregar Integrante
                </button>
                {integrantes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleLimpiarIntegrantes}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Vaciar Lista
                  </button>
                )}
              </div>
            </div>

            {/* Checklist visual de roles en tiempo real */}
            <div className="mb-4 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                tieneQA
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-red-100 text-red-800 border border-red-300 animate-pulse'
              }`}>
                {tieneQA ? '✔ QA Asignado' : '✖ Falta asignar: QA'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                tieneTecnico
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-red-100 text-red-800 border border-red-300 animate-pulse'
              }`}>
                {tieneTecnico ? '✔ Líder Técnico Asignado' : '✖ Falta asignar: Líder Técnico'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                tieneGestion
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-red-100 text-red-800 border border-red-300 animate-pulse'
              }`}>
                {tieneGestion ? '✔ Gestión de Proyecto Asignado' : '✖ Falta asignar: Gestión de Proyecto'}
              </span>
            </div>

            {/* Alertas de error de roles */}
            {(errorDe('rolesEquipo').length > 0 || errorDe('rol_QA').length > 0 || errorDe('rol_TECNICO').length > 0 || errorDe('rol_GESTION_PROYECTO').length > 0) && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                <strong>Roles faltantes requeridos por el estándar:</strong>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {errorDe('rolesEquipo').map((e, i) => <li key={`re-${i}`}>{e.mensaje}</li>)}
                  {errorDe('rol_QA').map((e, i) => <li key={`qa-${i}`}>{e.mensaje}</li>)}
                  {errorDe('rol_TECNICO').map((e, i) => <li key={`tec-${i}`}>{e.mensaje}</li>)}
                  {errorDe('rol_GESTION_PROYECTO').map((e, i) => <li key={`ges-${i}`}>{e.mensaje}</li>)}
                </ul>
              </div>
            )}

            {/* Listado dinámico de integrantes */}
            {integrantes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-red-300 p-8 text-center bg-red-50/30">
                <p className="text-sm font-bold text-red-700">No has agregado integrantes al equipo todavía.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Haz clic en <strong>"+ Agregar Integrante"</strong> o en <strong>"⚡ Rellenar con Datos de Ejemplo Rápidos"</strong> para completar los 3 roles obligatorios.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {integrantes.map((item, idx) => {
                  const nombreVacio = !item.memberName || !item.memberName.trim();
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                    >
                      <span className="text-xs font-bold text-slate-400 w-6 text-center">#{idx + 1}</span>

                      {/* Selector de Rol */}
                      <div className="w-full sm:w-48">
                        <select
                          value={item.role}
                          onChange={(e) => handleActualizarIntegrante(item.id, 'role', e.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs font-semibold shadow-xs"
                        >
                          {ROLES_DISPONIBLES.map((r) => (
                            <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
                          ))}
                        </select>
                      </div>

                      {/* Nombre del Integrante */}
                      <div className="w-full sm:flex-1">
                        <input
                          type="text"
                          value={item.memberName}
                          onChange={(e) => handleActualizarIntegrante(item.id, 'memberName', e.target.value)}
                          placeholder="Nombre completo del integrante *"
                          className={`w-full rounded-md border p-2 text-xs shadow-xs focus:border-blue-500 bg-white ${
                            errores.length > 0 && nombreVacio
                              ? 'border-red-500 bg-red-50'
                              : 'border-slate-300'
                          }`}
                        />
                      </div>

                    {/* Email opcional */}
                    <div className="w-full sm:w-56">
                      <input
                        type="email"
                        value={item.email}
                        onChange={(e) => handleActualizarIntegrante(item.id, 'email', e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className="w-full rounded-md border border-slate-300 p-2 text-xs shadow-xs focus:border-blue-500 bg-white"
                      />
                    </div>

                    {/* Botón Eliminar fila */}
                    <button
                      type="button"
                      onClick={() => handleEliminarIntegrante(item.id)}
                      className="rounded-md p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Eliminar integrante"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          </div>

          {/* Sección de Previsualización Interactiva del Plan SQA Propuesto (FN-03) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  3. Previsualizar Plan Base SQA Propuesto (ISO/IEC 29110)
                </h3>
                <p className="text-xs text-slate-500">
                  Consulta de forma anticipada las actividades que el motor propondrá según el tipo de desarrollo seleccionado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarPrevisualizacionPlan((prev) => !prev)}
                className="mt-2 sm:mt-0 inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
              >
                {mostrarPrevisualizacionPlan ? '▲ Ocultar Previsualización' : '▼ Ver Plan Propuesto en Vivo'}
              </button>
            </div>

            {mostrarPrevisualizacionPlan && (
              <div className="mt-4 border-t pt-3">
                {cargandoPropuesta ? (
                  <p className="text-xs text-slate-500 italic">Generando propuesta...</p>
                ) : (
                  <PlanQABaseWidget planQA={propuestaPlan} modoPrevisualizacion={true} />
                )}
              </div>
            )}
          </div>

          {/* Barra de Acciones Finales */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs text-slate-500">
              Al confirmar, el sistema registrará el proyecto, generará las actividades SQA y creará la línea base formal v1.0.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                disabled={enviando}
                className="w-full sm:w-auto rounded-lg bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-800 disabled:opacity-50 transition"
              >
                {enviando ? 'Guardando y generando plan...' : '✔ Registrar Proyecto y Generar Plan QA (FN-04)'}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
