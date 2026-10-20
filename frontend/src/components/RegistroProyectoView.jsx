import React, { useEffect, useState } from 'react';
import * as proyectosApi from '../api/ProyectosApiClient';
import PlanQABaseWidget from './PlanQABaseWidget';
import TableroInicialWidget from './TableroInicialWidget';

const TIPOS_PROYECTO = [
  { valor: 'DESARROLLO_NUEVO', etiqueta: 'Desarrollo Nuevo' },
  { valor: 'MANTENIMIENTO', etiqueta: 'Mantenimiento' },
  { valor: 'MIGRACION', etiqueta: 'Migración' },
];

const ROLES_OBLIGATORIOS = [
  { role: 'QA', etiqueta: 'Responsable de Calidad (QA)', defaultNombre: 'Héctor Varela' },
  { role: 'TECNICO', etiqueta: 'Líder Técnico', defaultNombre: 'Carlos Aguirre' },
  { role: 'GESTION_PROYECTO', etiqueta: 'Gestión de Proyecto', defaultNombre: 'Karol Espino' },
];

export default function RegistroProyectoView({ onProyectoRegistrado }) {
  const [periodoActivo, setPeriodoActivo] = useState(null);
  const [proyectoActivo, setProyectoActivo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Formulario
  const [nombre, setNombre] = useState('MetricDash');
  const [descripcion, setDescripcion] = useState('Herramienta de software para monitorear y gestionar actividades de SQA');
  const [tipoProyecto, setTipoProyecto] = useState('DESARROLLO_NUEVO');
  const [estimatedKloc, setEstimatedKloc] = useState('4.5');
  const [integrantes, setIntegrantes] = useState([
    { role: 'QA', memberName: 'Héctor Varela' },
    { role: 'TECNICO', memberName: 'Carlos Aguirre' },
    { role: 'GESTION_PROYECTO', memberName: 'Karol Espino' },
  ]);

  // Mensajes y errores
  const [errores, setErrores] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [resultadoRegistro, setResultadoRegistro] = useState(null);

  useEffect(() => {
    cargarEstadoInicial();
  }, []);

  async function cargarEstadoInicial() {
    setCargando(true);
    setMensaje(null);
    try {
      // 1. Obtener periodo activo
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
      }
    } catch (err) {
      console.warn('Error al verificar periodo/proyecto activo:', err);
    } finally {
      setCargando(false);
    }
  }

  function handleIntegranteChange(role, valor) {
    setIntegrantes((prev) =>
      prev.map((i) => (i.role === role ? { ...i, memberName: valor } : i))
    );
  }

  function resaltarErrores(errs) {
    setErrores(errs || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEnviando(true);
    setErrores([]);
    setMensaje(null);

    const klocNum = estimatedKloc === '' ? null : Number(estimatedKloc);

    const payload = {
      name: nombre.trim(),
      description: descripcion.trim(),
      projectType: tipoProyecto,
      estimatedKloc: klocNum,
      periodId: periodoActivo ? periodoActivo.id : undefined,
      members: integrantes.map((m) => ({
        role: m.role,
        memberName: m.memberName.trim(),
      })),
    };

    try {
      const resp = await proyectosApi.registrarProyecto(payload);

      // FA-02.02: Campos o roles incompletos
      if (resp.status === 400) {
        resaltarErrores(resp.data?.errores || []);
        setMensaje({
          tipo: 'error',
          texto: 'Validación fallida (FA-02.02): Corrija los campos y roles resaltados.',
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
        setResultadoRegistro(resp.data);
        setProyectoActivo({
          existe: true,
          proyecto: resp.data.proyecto,
          roles: resp.data.roles,
          planQA: resp.data.planQA,
          lineaBase: resp.data.lineaBase,
        });
        setMensaje({
          tipo: 'exito',
          texto: `¡Proyecto "${resp.data.proyecto.name}" registrado con éxito! Plan de QA y línea base generados formalmente.`,
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

  if (cargando) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">
        Verificando estado del periodo académico y proyecto...
      </div>
    );
  }

  const errorDe = (campo) => errores.filter((e) => e.campo === campo);

  return (
    <section className="space-y-6">
      {/* Encabezado del Caso de Uso */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              CU-01: Registrar el Proyecto del Periodo y Plan Base de QA
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Periodo Académico Activo:{' '}
              <strong className="text-slate-800">
                {periodoActivo ? `${periodoActivo.name} (${periodoActivo.code})` : 'Cargando periodo...'}
              </strong>
            </p>
          </div>
          {proyectoActivo && (
            <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:mt-0">
              ● Proyecto Vigente Registrado
            </span>
          )}
        </div>
      </div>

      {/* Mensajes de Estado / Alertas */}
      {mensaje && (
        <div
          role="alert"
          className={`rounded-md p-4 text-sm font-medium ${
            mensaje.tipo === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : mensaje.tipo === 'alerta'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Si ya existe proyecto registrado (FA-02.01 o Registro Exitoso), mostrar ficha informativa */}
      {proyectoActivo?.existe ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-5">
            <h3 className="text-lg font-bold text-slate-900">
              Proyecto Activo: {proyectoActivo.proyecto.name}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{proyectoActivo.proyecto.description}</p>
            
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500">Tipo de Proyecto</span>
                <div className="text-sm font-medium text-slate-800">{proyectoActivo.proyecto.project_type || proyectoActivo.proyecto.projectType}</div>
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500">KLOC Estimado</span>
                <div className="text-sm font-medium text-slate-800">{proyectoActivo.proyecto.estimated_kloc || proyectoActivo.proyecto.estimatedKloc} KLOC</div>
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500">Estado</span>
                <div className="text-sm font-medium text-emerald-700">{proyectoActivo.proyecto.status}</div>
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-slate-500">Periodo</span>
                <div className="text-sm font-medium text-slate-800">{periodoActivo?.name || 'Actual'}</div>
              </div>
            </div>

            {/* Integrantes asignados */}
            <div className="mt-4 border-t border-emerald-100 pt-3">
              <span className="text-xs uppercase font-semibold text-slate-500">Equipo y Roles Asignados:</span>
              <ul className="mt-1 flex flex-wrap gap-3">
                {proyectoActivo.roles?.map((r, i) => (
                  <li key={i} className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm border border-slate-200">
                    <strong className="mr-1 text-blue-700">{r.role}:</strong> {r.memberName || r.member_name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Plan SQA Propuesto */}
          <PlanQABaseWidget planQA={proyectoActivo.planQA} />

          {/* Tablero Inicial de Control */}
          <TableroInicialWidget
            tablero={resultadoRegistro?.tableroInicial}
            lineaBase={proyectoActivo.lineaBase}
          />
        </div>
      ) : (
        /* Formulario de Captura de Proyecto (FN-01 y FN-02) */
        <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Datos Generales del Proyecto
            </h3>
            <p className="text-sm text-slate-500">
              Ingrese la información básica del proyecto que será objeto de aseguramiento de calidad en este periodo.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Nombre */}
            <div className="sm:col-span-2">
              <label htmlFor="nombre-proyecto" className="block text-sm font-medium text-slate-700">
                Nombre del Proyecto *
              </label>
              <input
                id="nombre-proyecto"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. MetricDash"
                className={`mt-1 block w-full rounded-md border p-2 text-sm shadow-sm ${
                  errorDe('nombre').length ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              />
              {errorDe('nombre').map((e, idx) => (
                <p key={idx} className="mt-1 text-xs text-red-600">{e.mensaje}</p>
              ))}
            </div>

            {/* Tipo de Proyecto */}
            <div>
              <label htmlFor="tipo-proyecto" className="block text-sm font-medium text-slate-700">
                Tipo de Proyecto *
              </label>
              <select
                id="tipo-proyecto"
                value={tipoProyecto}
                onChange={(e) => setTipoProyecto(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm shadow-sm"
              >
                {TIPOS_PROYECTO.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                ))}
              </select>
            </div>

            {/* KLOC Estimado */}
            <div>
              <label htmlFor="kloc-estimado" className="block text-sm font-medium text-slate-700">
                Tamaño Estimado del Producto (KLOC) *
              </label>
              <input
                id="kloc-estimado"
                type="number"
                step="0.1"
                min="0.1"
                value={estimatedKloc}
                onChange={(e) => setEstimatedKloc(e.target.value)}
                placeholder="Ej. 4.5"
                className={`mt-1 block w-full rounded-md border p-2 text-sm shadow-sm ${
                  errorDe('tamanoProductoKLOC').length ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              />
              {errorDe('tamanoProductoKLOC').map((e, idx) => (
                <p key={idx} className="mt-1 text-xs text-red-600">{e.mensaje}</p>
              ))}
            </div>

            {/* Descripción */}
            <div className="sm:col-span-2">
              <label htmlFor="desc-proyecto" className="block text-sm font-medium text-slate-700">
                Descripción / Alcance del Proyecto
              </label>
              <textarea
                id="desc-proyecto"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Breve resumen del alcance o contexto del software"
                className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm shadow-sm"
              />
            </div>
          </div>

          {/* Sección de Integrantes y Roles Obligatorios (FA-02.02) */}
          <div className="border-t border-slate-200 pt-5">
            <h4 className="text-base font-semibold text-slate-900">
              Asignación de Roles del Equipo de Trabajo
            </h4>
            <p className="text-xs text-slate-500">
              Es mandatorio asignar al menos un integrante a cada uno de los tres roles obligatorios (QA, Líder Técnico y Gestión de Proyecto).
            </p>

            <div className="mt-4 space-y-3">
              {ROLES_OBLIGATORIOS.map((rol) => {
                const item = integrantes.find((i) => i.role === rol.role);
                const valor = item ? item.memberName : '';
                const campoKey = `rol_${rol.role}`;
                const hasErr = errorDe(campoKey).length > 0;

                return (
                  <div key={rol.role} className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                    <span className="w-64 text-sm font-medium text-slate-700">
                      {rol.etiqueta} *
                    </span>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={valor}
                        onChange={(e) => handleIntegranteChange(rol.role, e.target.value)}
                        placeholder={`Nombre del responsable de ${rol.role}`}
                        className={`block w-full rounded-md border p-2 text-sm shadow-sm ${
                          hasErr ? 'border-red-500 bg-red-50' : 'border-slate-300'
                        }`}
                      />
                      {errorDe(campoKey).map((e, idx) => (
                        <p key={idx} className="mt-1 text-xs text-red-600">{e.mensaje}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botón de Enviar */}
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
            >
              {enviando ? 'Registrando y generando plan...' : 'Registrar Proyecto y Generar Plan QA'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
