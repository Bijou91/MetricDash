import React, { useEffect, useState } from 'react';
import * as api from '../api/DefectosApiClient';
import TableroDefectosWidget, { ETIQUETAS_FASE } from '../widgets/TableroDefectosWidget';

const SEVERIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'INMEDIATA'];

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
          Primero configure las métricas de calidad y sus umbrales (CU-02) para poder registrar defectos.
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

      {tablero && <TableroDefectosWidget tablero={tablero} />}
    </section>
  );
}
