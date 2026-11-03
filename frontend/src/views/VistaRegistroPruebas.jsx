import React, { useEffect, useState } from 'react';
import * as api from '../api/SQAHttpClient';
import SemaforoWidget, { renderizarEstado } from '../widgets/SemaforoWidget';

const formularioVacio = {
  corteId: '',
  pruebasPlaneadas: '',
  pruebasEjecutadas: '',
  pruebasExitosas: '',
  pruebasFallidas: '',
  notaExplicativa: '',
};

const CAMPOS_REQUERIDOS = [
  ['corteId', 'Versión o corte de evaluación'],
  ['pruebasPlaneadas', 'Pruebas planeadas'],
  ['pruebasEjecutadas', 'Pruebas ejecutadas'],
  ['pruebasExitosas', 'Pruebas exitosas'],
  ['pruebasFallidas', 'Pruebas fallidas'],
];

export default function VistaRegistroPruebas({ proyectoId }) {
  const [contexto, setContexto] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(true);
  const [dto, setDto] = useState(formularioVacio);
  const [camposFaltantes, setCamposFaltantes] = useState([]);
  const [erroresPorCampo, setErroresPorCampo] = useState({});
  const [requiereNota, setRequiereNota] = useState(false);
  const [evaluacionPrevia, setEvaluacionPrevia] = useState(null);
  const [semaforoGlobal, setSemaforoGlobal] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // FN-01: Cargar los cortes disponibles y umbrales vigentes del proyecto
  async function cargarCortesDisponibles() {
    try {
      const r = await api.obtenerCortes(proyectoId);
      if (r.status === 200) {
        setContexto(r.data);
        setSemaforoGlobal(r.data?.ultimasMediciones?.nivelSemaforoGlobal || 'SIN_DATOS');
        if (r.data?.cortesDisponibles?.length === 1 && !dto.corteId) {
          setDto((prev) => ({ ...prev, corteId: r.data.cortesDisponibles[0].id }));
        }
      } else {
        setMensaje({ tipo: 'error', texto: r.data?.mensaje });
      }
    } catch (e) {
      mostrarErrorAlmacenamiento(e.message);
    }
  }

  useEffect(() => {
    cargarCortesDisponibles();
  }, [proyectoId]);

  function actualizarCampo(campo, valor) {
    setDto((prev) => ({ ...prev, [campo]: valor }));
    setCamposFaltantes((prev) => prev.filter((c) => c !== campo));
    setErroresPorCampo((prev) => {
      const copia = { ...prev };
      delete copia[campo];
      return copia;
    });
  }

  // FN-02: Captura y empaqueta los datos del formulario en RegistroPruebasDTO
  function capturarFormulario() {
    const aNum = (v) => (String(v).trim() === '' ? '' : Number(v));
    return {
      proyectoId,
      corteId: dto.corteId,
      pruebasPlaneadas: aNum(dto.pruebasPlaneadas),
      pruebasEjecutadas: aNum(dto.pruebasEjecutadas),
      pruebasExitosas: aNum(dto.pruebasExitosas),
      pruebasFallidas: aNum(dto.pruebasFallidas),
      notaExplicativa: dto.notaExplicativa ? dto.notaExplicativa.trim() : undefined,
    };
  }

  // FA-02.01: Resalta los campos obligatorios faltantes e impide el guardado
  function resaltarCamposFaltantes(errores = []) {
    const campos = errores.map((e) => (typeof e === 'string' ? e : e.campo));
    const mapa = {};
    for (const err of errores) {
      if (err && typeof err === 'object' && err.campo) {
        mapa[err.campo] = err.mensaje;
      }
    }
    setCamposFaltantes(campos);
    setErroresPorCampo(mapa);
    setMensaje({
      tipo: 'error',
      texto: 'Complete todos los campos obligatorios resaltados antes de guardar el registro.',
    });
  }

  // FA-03.01: Muestra los errores de consistencia numérica o de rango
  function mostrarErroresValidacion(errores = []) {
    const campos = errores.map((e) => e.campo).filter(Boolean);
    const mapa = {};
    for (const err of errores) {
      if (err?.campo && !mapa[err.campo]) {
        mapa[err.campo] = err.mensaje;
      }
    }
    setCamposFaltantes(campos);
    setErroresPorCampo(mapa);
    setMensaje({
      tipo: 'error',
      texto: errores[0]?.mensaje || 'Verifique la consistencia numérica de las cantidades ingresadas.',
    });
  }

  // FE-01: Notifica error de persistencia y solicita reintentar
  function mostrarErrorAlmacenamiento(texto) {
    setMensaje({
      tipo: 'error',
      texto: `${texto || 'No se pudo guardar la información.'} Verifique la conexión e intente nuevamente.`,
    });
  }

  // FA-06.01: Muestra alerta visual por estado crítico (ROJO) y solicita nota explicativa obligatoria
  function solicitarNotaExplicativa(resultado) {
    setRequiereNota(true);
    setEvaluacionPrevia(resultado);
    setAlertas(resultado.alertasEmitidas?.length ? resultado.alertasEmitidas : (resultado.alertaEmitida ? [resultado.alertaEmitida] : []));
    setCamposFaltantes(['notaExplicativa']);
    if (resultado.errores?.length) {
      setErroresPorCampo({ notaExplicativa: resultado.errores[0].mensaje });
    }
    setMensaje({
      tipo: 'error',
      texto: 'Al menos una métrica cayó en estado crítico (ROJO). Ingrese una nota explicativa obligatoria para poder confirmar el guardado.',
    });
  }

  // FN-07: Actualiza y muestra el estado del semáforo tras el guardado exitoso
  function mostrarSemaforo(estado) {
    setSemaforoGlobal(estado);
  }

  async function enviarRegistro(e) {
    if (e) e.preventDefault();

    // Validación local FA-02.01
    const faltantesLocal = [];
    for (const [campo, etiqueta] of CAMPOS_REQUERIDOS) {
      if (String(dto[campo] ?? '').trim() === '') {
        faltantesLocal.push({ campo, mensaje: `El campo "${etiqueta}" es obligatorio.` });
      }
    }
    if (faltantesLocal.length > 0) {
      resaltarCamposFaltantes(faltantesLocal);
      return;
    }

    if (requiereNota && !String(dto.notaExplicativa ?? '').trim()) {
      resaltarCamposFaltantes([
        {
          campo: 'notaExplicativa',
          mensaje: 'La nota explicativa es obligatoria cuando una métrica cae en estado crítico (rojo).',
        },
      ]);
      return;
    }

    const payload = capturarFormulario();
    setOcupado(true);
    setMensaje(null);

    try {
      const r = await api.postRegistroPruebas(proyectoId, payload);
      if (r.status === 400) {
        resaltarCamposFaltantes(r.data?.errores?.length ? r.data.errores : r.data?.camposFaltantes || []);
      } else if (r.status === 422) {
        mostrarErroresValidacion(r.data?.errores || []);
      } else if (r.status === 404 || r.status === 409) {
        setMensaje({ tipo: 'error', texto: r.data?.mensaje });
      } else if (r.status === 200 && r.data?.requiereNota) {
        solicitarNotaExplicativa(r.data);
      } else if (r.status === 201 && r.data?.registroExitoso) {
        setRequiereNota(false);
        setEvaluacionPrevia(r.data);
        setAlertas(r.data.alertasEmitidas?.length ? r.data.alertasEmitidas : (r.data.alertaEmitida ? [r.data.alertaEmitida] : []));
        mostrarSemaforo(r.data.nivelSemaforoGlobal);
        setMensaje({
          tipo: 'ok',
          texto: `Ronda de pruebas registrada exitosamente (${r.data.rondaRegistrada?.version || 'Corte'}). Cobertura: ${r.data.coberturaPruebas}% · Tasa de éxito: ${r.data.tasaExitoPruebas}%.`,
        });
        setDto((prev) => ({
          ...formularioVacio,
          corteId: prev.corteId,
        }));
        setCamposFaltantes([]);
        setErroresPorCampo({});
        await cargarCortesDisponibles();
      }
    } catch (err) {
      mostrarErrorAlmacenamiento(err.message);
    } finally {
      setOcupado(false);
    }
  }

  const falta = (campo) => camposFaltantes.includes(campo);
  const claseInput = (campo) =>
    `w-full rounded border p-2 text-sm ${
      falta(campo) ? 'border-red-600 bg-red-50' : 'border-slate-300 bg-white'
    }`;

  const cortes = contexto?.cortesDisponibles ?? [];
  const umbralesConfigurados = contexto?.umbralesConfigurados ?? false;
  const umbrales = contexto?.umbrales ?? {};
  const ultimas = evaluacionPrevia?.registroExitoso
    ? evaluacionPrevia
    : {
        coberturaPruebas: contexto?.ultimasMediciones?.coberturaPruebas ?? null,
        tasaExitoPruebas: contexto?.ultimasMediciones?.tasaExitoPruebas ?? null,
        estadoCobertura: evaluacionPrevia?.estadoCobertura ?? (contexto?.ultimasMediciones?.coberturaPruebas != null ? semaforoGlobal : 'SIN_DATOS'),
        estadoTasaExito: evaluacionPrevia?.estadoTasaExito ?? (contexto?.ultimasMediciones?.tasaExitoPruebas != null ? semaforoGlobal : 'SIN_DATOS'),
      };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Registrar resultados de pruebas</h2>
          <p className="text-xs text-slate-500">
            Capture los resultados de ejecución de casos de prueba por corte para calcular cobertura y tasa de éxito.
          </p>
        </div>
        {umbralesConfigurados && (
          <button
            type="button"
            onClick={() => setMostrarFormulario((v) => !v)}
            className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            {mostrarFormulario ? 'Ocultar formulario' : 'Registrar resultados de pruebas'}
          </button>
        )}
      </div>

      {contexto && !umbralesConfigurados && (
        <p role="alert" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 border border-amber-200">
          Primero configure las métricas de calidad y sus umbrales para poder registrar resultados de pruebas.
        </p>
      )}

      {alertas.length > 0 && (
        <div className="mt-3 space-y-2">
          {alertas.map((alerta, idx) => (
            <div
              key={idx}
              role="alert"
              className={`rounded-md border px-3 py-2 text-sm ${
                alerta.nivelSemaforo === 'ROJO_CRITICO' || alerta.nivelSemaforo === 'ROJO'
                  ? 'border-red-300 bg-red-100 text-red-800'
                  : 'border-yellow-300 bg-yellow-50 text-yellow-800'
              }`}
            >
              <strong>⚠ {alerta.mensajeAlerta}</strong>
            </div>
          ))}
        </div>
      )}

      {mensaje && (
        <p
          role={mensaje.tipo === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            mensaje.tipo === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      {/* Formulario de captura FN-02 / FA-06.01 */}
      {umbralesConfigurados && mostrarFormulario && (
        <form
          onSubmit={enviarRegistro}
          noValidate
          className="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label htmlFor="corteId" className="block text-sm font-medium text-slate-700">
              Versión (línea base) o corte de evaluación
            </label>
            <select
              id="corteId"
              aria-label="Versión o corte de evaluación"
              aria-invalid={falta('corteId')}
              value={dto.corteId}
              onChange={(e) => actualizarCampo('corteId', e.target.value)}
              className={claseInput('corteId')}
            >
              <option value="">Seleccione un corte…</option>
              {cortes.map((c) => (
                <option key={c.id} value={c.id}>
                  Corte #{c.numeroCorte} — {c.nombreCorte}
                </option>
              ))}
            </select>
            {erroresPorCampo.corteId && (
              <p className="mt-1 text-xs text-red-600">{erroresPorCampo.corteId}</p>
            )}
          </div>

          <div>
            <label htmlFor="pruebasPlaneadas" className="block text-sm font-medium text-slate-700">
              Pruebas planeadas
            </label>
            <input
              id="pruebasPlaneadas"
              type="number"
              min="1"
              step="1"
              placeholder="Ej. 100"
              aria-label="Pruebas planeadas"
              aria-invalid={falta('pruebasPlaneadas')}
              value={dto.pruebasPlaneadas}
              onChange={(e) => actualizarCampo('pruebasPlaneadas', e.target.value)}
              className={claseInput('pruebasPlaneadas')}
            />
            {erroresPorCampo.pruebasPlaneadas && (
              <p className="mt-1 text-xs text-red-600">{erroresPorCampo.pruebasPlaneadas}</p>
            )}
          </div>

          <div>
            <label htmlFor="pruebasEjecutadas" className="block text-sm font-medium text-slate-700">
              Pruebas ejecutadas
            </label>
            <input
              id="pruebasEjecutadas"
              type="number"
              min="1"
              step="1"
              placeholder="Ej. 90"
              aria-label="Pruebas ejecutadas"
              aria-invalid={falta('pruebasEjecutadas')}
              value={dto.pruebasEjecutadas}
              onChange={(e) => actualizarCampo('pruebasEjecutadas', e.target.value)}
              className={claseInput('pruebasEjecutadas')}
            />
            {erroresPorCampo.pruebasEjecutadas && (
              <p className="mt-1 text-xs text-red-600">{erroresPorCampo.pruebasEjecutadas}</p>
            )}
          </div>

          <div>
            <label htmlFor="pruebasExitosas" className="block text-sm font-medium text-slate-700">
              Pruebas exitosas (aprobadas)
            </label>
            <input
              id="pruebasExitosas"
              type="number"
              min="0"
              step="1"
              placeholder="Ej. 85"
              aria-label="Pruebas exitosas"
              aria-invalid={falta('pruebasExitosas')}
              value={dto.pruebasExitosas}
              onChange={(e) => actualizarCampo('pruebasExitosas', e.target.value)}
              className={claseInput('pruebasExitosas')}
            />
            {erroresPorCampo.pruebasExitosas && (
              <p className="mt-1 text-xs text-red-600">{erroresPorCampo.pruebasExitosas}</p>
            )}
          </div>

          <div>
            <label htmlFor="pruebasFallidas" className="block text-sm font-medium text-slate-700">
              Pruebas fallidas
            </label>
            <input
              id="pruebasFallidas"
              type="number"
              min="0"
              step="1"
              placeholder="Ej. 5"
              aria-label="Pruebas fallidas"
              aria-invalid={falta('pruebasFallidas')}
              value={dto.pruebasFallidas}
              onChange={(e) => actualizarCampo('pruebasFallidas', e.target.value)}
              className={claseInput('pruebasFallidas')}
            />
            {erroresPorCampo.pruebasFallidas && (
              <p className="mt-1 text-xs text-red-600">{erroresPorCampo.pruebasFallidas}</p>
            )}
          </div>

          {/* FA-06.01: Nota explicativa (obligatoria cuando hay estado crítico ROJO) */}
          {(requiereNota || dto.notaExplicativa) && (
            <div className="sm:col-span-2 rounded-md border border-red-300 bg-red-50/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="notaExplicativa" className="text-sm font-bold text-red-900">
                  Nota explicativa por estado crítico (obligatoria)
                </label>
                {renderizarEstado('ROJO_CRITICO')}
              </div>
              {evaluacionPrevia && (
                <div className="mb-2 flex flex-wrap gap-4 text-xs text-red-800">
                  <span>
                    Cobertura calculada: <strong>{evaluacionPrevia.coberturaPruebas}%</strong> ({renderizarEstado(evaluacionPrevia.estadoCobertura)})
                  </span>
                  <span>
                    Tasa de éxito calculada: <strong>{evaluacionPrevia.tasaExitoPruebas}%</strong> ({renderizarEstado(evaluacionPrevia.estadoTasaExito)})
                  </span>
                </div>
              )}
              <textarea
                id="notaExplicativa"
                rows={3}
                placeholder="Explique las causas por las que la cobertura o tasa de éxito cayeron por debajo del umbral crítico..."
                aria-label="Nota explicativa"
                aria-invalid={falta('notaExplicativa')}
                value={dto.notaExplicativa}
                onChange={(e) => actualizarCampo('notaExplicativa', e.target.value)}
                className={claseInput('notaExplicativa')}
              />
              {erroresPorCampo.notaExplicativa && (
                <p className="mt-1 text-xs font-medium text-red-700">{erroresPorCampo.notaExplicativa}</p>
              )}
            </div>
          )}

          <div className="flex gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={ocupado}
              className="rounded bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {ocupado
                ? 'Guardando…'
                : requiereNota
                ? 'Confirmar y guardar con nota explicativa'
                : 'Guardar resultados de pruebas'}
            </button>
            {requiereNota && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => {
                  setRequiereNota(false);
                  setEvaluacionPrevia(null);
                  setCamposFaltantes([]);
                  setErroresPorCampo({});
                }}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Corregir cantidades
              </button>
            )}
          </div>
        </form>
      )}

      {/* Tablero de indicadores de pruebas FN-07 */}
      {contexto && (
        <section aria-label="Tablero de resultados de pruebas" className="mt-6">
          <h3 className="mb-3 font-semibold text-slate-800">Indicadores de pruebas en el tablero</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <SemaforoWidget
              etiqueta="Cobertura de pruebas"
              valor={ultimas.coberturaPruebas}
              unidad="%"
              estado={ultimas.estadoCobertura || 'SIN_DATOS'}
              umbral={umbrales.coberturaPruebas}
            />
            <SemaforoWidget
              etiqueta="Tasa de éxito de pruebas"
              valor={ultimas.tasaExitoPruebas}
              unidad="%"
              estado={ultimas.estadoTasaExito || 'SIN_DATOS'}
              umbral={umbrales.tasaExitoPruebas}
            />
            <SemaforoWidget
              etiqueta="Estado de salud global del tablero"
              valor={undefined}
              estado={semaforoGlobal || 'SIN_DATOS'}
            />
          </div>

          {/* Historial de rondas registradas */}
          <div className="mt-6">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Historial de rondas de pruebas</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 pr-2">Corte / Versión</th>
                    <th className="py-2 pr-2">Planeadas</th>
                    <th className="py-2 pr-2">Ejecutadas</th>
                    <th className="py-2 pr-2">Exitosas</th>
                    <th className="py-2 pr-2">Fallidas</th>
                    <th className="py-2 pr-2">Cobertura</th>
                    <th className="py-2 pr-2">Tasa de éxito</th>
                    <th className="py-2 pr-2">Nota explicativa</th>
                  </tr>
                </thead>
                <tbody>
                  {(!contexto.rondas || contexto.rondas.length === 0) && (
                    <tr>
                      <td colSpan={8} className="py-3 text-center text-slate-500">
                        Aún no hay rondas de pruebas registradas.
                      </td>
                    </tr>
                  )}
                  {(contexto.rondas || []).map((r) => (
                    <tr key={r.id} className="border-t border-slate-200">
                      <td className="py-2 pr-2 font-medium">{r.version}</td>
                      <td className="py-2 pr-2">{r.pruebasPlaneadas}</td>
                      <td className="py-2 pr-2">{r.pruebasEjecutadas}</td>
                      <td className="py-2 pr-2 text-green-700 font-medium">{r.pruebasExitosas}</td>
                      <td className="py-2 pr-2 text-red-700 font-medium">{r.pruebasFallidas}</td>
                      <td className="py-2 pr-2 font-semibold">{r.coberturaPruebas}%</td>
                      <td className="py-2 pr-2 font-semibold">{r.tasaExitoPruebas}%</td>
                      <td className="py-2 pr-2 max-w-xs truncate text-slate-600" title={r.notaExplicativa || ''}>
                        {r.notaExplicativa || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}

