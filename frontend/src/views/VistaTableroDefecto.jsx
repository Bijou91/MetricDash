import React, { useEffect, useState } from 'react';
import * as api from '../api/DefectosApiClient';
import TableroDefectosWidget, { ETIQUETAS_FASE } from '../widgets/TableroDefectosWidget';

const SEVERIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'INMEDIATA'];
const ESTADOS = ['REGISTRADO', 'ASIGNADO', 'EN_RESOLUCION', 'CERRADO', 'DESCARTADO'];
const ETIQUETAS_ESTADO = {
  REGISTRADO: 'Registrado',
  ASIGNADO: 'Asignado',
  EN_RESOLUCION: 'En resolución',
  CERRADO: 'Cerrado',
  DESCARTADO: 'Descartado',
};

const formularioVacio = {
  reportadoPorId: '', asignadoAId: '', severidad: '', prioridad: '',
  faseDeteccion: '', faseOrigen: '', descripcionDetallada: '',
};

export default function VistaTableroDefecto({ proyectoId }) {
  const [tablero, setTablero] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [dto, setDto] = useState(formularioVacio);
  const [camposFaltantes, setCamposFaltantes] = useState([]);
  const [coincidencias, setCoincidencias] = useState([]);
  const [alerta, setAlerta] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // Estado para la edición de defectos
  const [defectoEnEdicion, setDefectoEnEdicion] = useState(null);
  const [dtoEdicion, setDtoEdicion] = useState(null);
  const [camposFaltantesEdicion, setCamposFaltantesEdicion] = useState([]);

  async function cargarTablero() {
    try {
      const r = await api.obtenerTablero(proyectoId);
      if (r.status === 200) setTablero(r.data);
      else setMensaje({ tipo: 'error', texto: r.data?.mensaje });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    }
  }

  useEffect(() => { cargarTablero(); }, [proyectoId]);

  // FN-01
  function seleccionarRegistrarNuevoDefecto() {
    setMostrarFormulario(true);
    setDto(formularioVacio);
    setCamposFaltantes([]);
    setCoincidencias([]);
    setMensaje(null);
  }

  // FN-02
  function capturarDatosDefecto(campo, valor) {
    setDto((d) => ({ ...d, [campo]: valor }));
    setCamposFaltantes((c) => c.filter((x) => x !== campo));
  }

  // FA-03.03: validación previa en la vista; el backend vuelve a validar.
  function validarCamposRequeridos() {
    return Object.keys(formularioVacio).filter((c) => !String(dto[c]).trim());
  }

  async function registrar(confirmarIncidenciaDistinta = false) {
    const faltantes = validarCamposRequeridos();
    if (faltantes.length) {
      setCamposFaltantes(faltantes);
      setMensaje({ tipo: 'error', texto: 'Complete los campos resaltados antes de guardar.' });
      return;
    }
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await api.registrarDefecto(proyectoId, { ...dto, confirmarIncidenciaDistinta });
      if (r.status === 400) {
        setCamposFaltantes(r.data.camposFaltantes);
        setMensaje({ tipo: 'error', texto: 'Complete los campos resaltados antes de guardar.' });
      } else if (r.status === 404 || r.status === 409) {
        setMensaje({ tipo: 'error', texto: r.data?.mensaje });
      } else if (r.data.requiereConfirmacionDuplicado) {
        setCoincidencias(r.data.coincidenciasDetectadas); // FA-03.01
      } else {
        actualizarVistaTablero(r.data);
      }
    } catch (e) {
      mostrarMensajeErrorPersistencia(e.message); // FE-01
    } finally {
      setOcupado(false);
    }
  }

  // FA-03.01: el usuario descarta el registro.
  async function descartar() {
    setOcupado(true);
    try {
      await api.descartarRegistro(proyectoId);
      setCoincidencias([]);
      setMostrarFormulario(false);
      setMensaje({ tipo: 'ok', texto: 'Registro descartado. No se guardó ningún defecto.' });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    } finally {
      setOcupado(false);
    }
  }

  // FN-07 / FA-03.02
  function actualizarVistaTablero(resultado) {
    setCoincidencias([]);
    setMostrarFormulario(false);
    setAlerta(resultado.alertaEmitida);
    setMensaje({ tipo: 'ok', texto: `Defecto ${resultado.defectoRegistrado.folio} registrado y asignado a ${resultado.defectoRegistrado.asignadoNombre}.` });
    cargarTablero();
  }

  function mostrarMensajeErrorPersistencia(texto) {
    setMensaje({ tipo: 'error', texto: `${texto} Intente registrar el defecto nuevamente.` });
  }

  // Funciones para edición de defectos
  function iniciarEdicion(defecto) {
    setDefectoEnEdicion(defecto);
    setDtoEdicion({
      descripcionDetallada: defecto.descripcionDetallada ?? '',
      severidad: defecto.severidad ?? 'BAJA',
      prioridad: defecto.prioridad ?? 'BAJA',
      faseDeteccion: defecto.faseDeteccion ?? 'CONSTRUCCION_SOFTWARE',
      faseOrigen: defecto.faseOrigen ?? 'ANALISIS_REQUERIMIENTOS',
      asignadoAId: defecto.asignadoAId ?? '',
      estado: defecto.estado ?? 'REGISTRADO',
      notasResolucion: defecto.notasResolucion ?? '',
    });
    setCamposFaltantesEdicion([]);
    setMensaje(null);
  }

  function cancelarEdicion() {
    setDefectoEnEdicion(null);
    setDtoEdicion(null);
    setCamposFaltantesEdicion([]);
  }

  function capturarDatosEdicion(campo, valor) {
    setDtoEdicion((d) => ({ ...d, [campo]: valor }));
    setCamposFaltantesEdicion((c) => c.filter((x) => x !== campo));
  }

  async function guardarEdicion(e) {
    if (e) e.preventDefault();
    if (!dtoEdicion) return;

    const faltantes = [];
    if (!String(dtoEdicion.descripcionDetallada).trim()) faltantes.push('descripcionDetallada');
    if (!String(dtoEdicion.asignadoAId).trim()) faltantes.push('asignadoAId');
    if (faltantes.length) {
      setCamposFaltantesEdicion(faltantes);
      setMensaje({ tipo: 'error', texto: 'Complete todos los campos obligatorios para guardar la edición.' });
      return;
    }

    setOcupado(true);
    setMensaje(null);
    try {
      const r = await api.actualizarDefecto(proyectoId, defectoEnEdicion.id, dtoEdicion);
      if (r.status === 200) {
        setMensaje({ tipo: 'ok', texto: `Defecto ${defectoEnEdicion.folio} actualizado correctamente.` });
        if (r.data?.alertaEmitida) setAlerta(r.data.alertaEmitida);
        cancelarEdicion();
        await cargarTablero();
      } else {
        setMensaje({ tipo: 'error', texto: r.data?.mensaje || 'Error al actualizar el defecto.' });
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarEstadoDirecto(defectoId, nuevoEstado) {
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await api.actualizarEstadoDefecto(proyectoId, defectoId, nuevoEstado);
      if (r.status === 200) {
        setMensaje({ tipo: 'ok', texto: `Estado del defecto actualizado a "${ETIQUETAS_ESTADO[nuevoEstado] ?? nuevoEstado}".` });
        if (r.data?.alertaEmitida) setAlerta(r.data.alertaEmitida);
        await cargarTablero();
      } else {
        setMensaje({ tipo: 'error', texto: r.data?.mensaje || 'Error al actualizar el estado.' });
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setOcupado(false);
    }
  }

  const falta = (campo) => camposFaltantes.includes(campo);
  const claseCampo = (campo) => `w-full rounded border p-1.5 ${falta(campo) ? 'border-red-600 bg-red-50' : 'border-slate-300 bg-white'}`;
  const propsCampo = (campo, etiqueta) => ({
    id: campo,
    value: dto[campo],
    'aria-label': etiqueta,
    'aria-invalid': falta(campo),
    onChange: (e) => capturarDatosDefecto(campo, e.target.value),
    className: claseCampo(campo),
  });
  const opciones = (valores, etiquetas = {}) => [
    <option key="" value="">Seleccione…</option>,
    ...valores.map((v) => <option key={v} value={v}>{etiquetas[v] ?? v}</option>),
  ];
  const miembros = tablero?.miembros ?? [];
  const opcionesMiembros = opciones(miembros.map((m) => m.id), Object.fromEntries(miembros.map((m) => [m.id, `${m.nombre} (${m.rol})`])));
  const fases = Object.keys(ETIQUETAS_FASE);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Registro y clasificación de defectos</h2>
        {tablero?.umbralesConfigurados && !mostrarFormulario && (
          <button type="button" onClick={seleccionarRegistrarNuevoDefecto}
            className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800">
            Registrar nuevo defecto
          </button>
        )}
      </div>

      {tablero && !tablero.umbralesConfigurados && (
        <p role="alert" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-amber-800">
          Primero configure las métricas de calidad y sus umbrales para poder registrar defectos.
        </p>
      )}

      {alerta && (
        <div role="alert" className={`mt-3 rounded-md border px-3 py-2 ${alerta.nivelSemaforo === 'ROJO_CRITICO' || alerta.porDefectoCritico ? 'border-red-300 bg-red-100 text-red-800' : 'border-yellow-300 bg-yellow-50 text-yellow-800'}`}>
          <strong>⚠ {alerta.mensajeAlerta}</strong>
          <button type="button" onClick={() => setAlerta(null)} className="ml-3 text-sm underline">Cerrar</button>
        </div>
      )}

      {mensaje && (
        <p role={mensaje.tipo === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-md px-3 py-2 ${mensaje.tipo === 'error' ? 'bg-red-100' : 'bg-green-100'}`}>
          {mensaje.texto}
        </p>
      )}

      {mostrarFormulario && (
        <form className="mt-4 grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); registrar(); }}>
          <label className="text-sm">Reportado por
            <select {...propsCampo('reportadoPorId', 'Reportado por')}>{opcionesMiembros}</select>
          </label>
          <label className="text-sm">Asignar a
            <select {...propsCampo('asignadoAId', 'Asignar a')}>{opcionesMiembros}</select>
          </label>
          <label className="text-sm">Severidad
            <select {...propsCampo('severidad', 'Severidad')}>{opciones(SEVERIDADES)}</select>
          </label>
          <label className="text-sm">Prioridad
            <select {...propsCampo('prioridad', 'Prioridad')}>{opciones(PRIORIDADES)}</select>
          </label>
          <label className="text-sm">Fase de detección
            <select {...propsCampo('faseDeteccion', 'Fase de detección')}>{opciones(fases, ETIQUETAS_FASE)}</select>
          </label>
          <label className="text-sm">Fase de origen
            <select {...propsCampo('faseOrigen', 'Fase de origen')}>{opciones(fases, ETIQUETAS_FASE)}</select>
          </label>
          <label className="text-sm sm:col-span-2">Descripción detallada
            <textarea rows={3} {...propsCampo('descripcionDetallada', 'Descripción detallada')} />
          </label>
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" disabled={ocupado || coincidencias.length > 0}
              className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50">
              Guardar defecto
            </button>
            <button type="button" onClick={() => setMostrarFormulario(false)} disabled={ocupado}
              className="rounded border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {coincidencias.length > 0 && (
        <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <strong>Posible duplicado detectado.</strong> El defecto se parece a estos registros previos:
          <ul className="mt-2 list-disc pl-5 text-sm">
            {coincidencias.map((c) => (
              <li key={c.defectoExistenteId}>
                <span className="font-mono">{c.folio}</span> ({c.porcentajeSimilitud}% similar, {c.severidad}): {c.descripcionResumen}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={descartar} disabled={ocupado}
              className="rounded border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50 disabled:opacity-50">
              Descartar registro
            </button>
            <button type="button" onClick={() => registrar(true)} disabled={ocupado}
              className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50">
              Es una incidencia distinta
            </button>
          </div>
        </div>
      )}

      {/* Modal de Edición de Defecto */}
      {defectoEnEdicion && dtoEdicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  {defectoEnEdicion.folio}
                </span>
                <h3 className="text-lg font-bold text-slate-800">Editar Defecto</h3>
              </div>
              <button
                type="button"
                onClick={cancelarEdicion}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 leading-none cursor-pointer"
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={guardarEdicion}>
              <label className="text-sm">Asignar a
                <select
                  value={dtoEdicion.asignadoAId}
                  onChange={(e) => capturarDatosEdicion('asignadoAId', e.target.value)}
                  className={`w-full rounded border p-1.5 ${camposFaltantesEdicion.includes('asignadoAId') ? 'border-red-600 bg-red-50' : 'border-slate-300 bg-white'}`}
                >
                  {opcionesMiembros}
                </select>
              </label>

              <label className="text-sm">Estado
                <select
                  value={dtoEdicion.estado}
                  onChange={(e) => capturarDatosEdicion('estado', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-1.5 font-medium"
                >
                  {ESTADOS.map((est) => (
                    <option key={est} value={est}>{ETIQUETAS_ESTADO[est] ?? est}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm">Severidad
                <select
                  value={dtoEdicion.severidad}
                  onChange={(e) => capturarDatosEdicion('severidad', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-1.5"
                >
                  {opciones(SEVERIDADES)}
                </select>
              </label>

              <label className="text-sm">Prioridad
                <select
                  value={dtoEdicion.prioridad}
                  onChange={(e) => capturarDatosEdicion('prioridad', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-1.5"
                >
                  {opciones(PRIORIDADES)}
                </select>
              </label>

              <label className="text-sm">Fase de detección
                <select
                  value={dtoEdicion.faseDeteccion}
                  onChange={(e) => capturarDatosEdicion('faseDeteccion', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-1.5"
                >
                  {opciones(fases, ETIQUETAS_FASE)}
                </select>
              </label>

              <label className="text-sm">Fase de origen
                <select
                  value={dtoEdicion.faseOrigen}
                  onChange={(e) => capturarDatosEdicion('faseOrigen', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-1.5"
                >
                  {opciones(fases, ETIQUETAS_FASE)}
                </select>
              </label>

              <label className="text-sm sm:col-span-2">Descripción detallada
                <textarea
                  rows={3}
                  value={dtoEdicion.descripcionDetallada}
                  onChange={(e) => capturarDatosEdicion('descripcionDetallada', e.target.value)}
                  className={`w-full rounded border p-1.5 ${camposFaltantesEdicion.includes('descripcionDetallada') ? 'border-red-600 bg-red-50' : 'border-slate-300 bg-white'}`}
                />
              </label>

              <label className="text-sm sm:col-span-2">Notas de resolución / justificación
                <textarea
                  rows={2}
                  placeholder="Detalles de la corrección o justificación de descarte/cierre..."
                  value={dtoEdicion.notasResolucion}
                  onChange={(e) => capturarDatosEdicion('notasResolucion', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white p-1.5 text-xs text-slate-700"
                />
              </label>

              <div className="flex justify-end gap-3 sm:col-span-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  disabled={ocupado}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={ocupado}
                  className="rounded bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 shadow-xs"
                >
                  {ocupado ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tablero && (
        <TableroDefectosWidget
          tablero={tablero}
          onEditarDefecto={iniciarEdicion}
          onCambiarEstadoDefecto={cambiarEstadoDirecto}
        />
      )}
    </section>
  );
}
