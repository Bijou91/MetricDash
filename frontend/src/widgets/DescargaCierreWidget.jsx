import React, { useState } from 'react';
import * as api from '../api/CierrePeriodoApiClient';

// FN-09: confirma el cierre y ofrece el reporte final y la bitácora.
export default function DescargaCierreWidget({ cierreId }) {
  const [error, setError] = useState(null);
  const descargar = (fn) => fn(cierreId).then(() => setError(null)).catch((e) => setError(e.message));
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <p className="font-semibold text-green-800">El periodo se cerró correctamente.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          onClick={() => descargar(api.descargarReporteFinal)}>
          Descargar reporte final (PDF)
        </button>
        <button type="button" className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          onClick={() => descargar(api.descargarBitacora)}>
          Descargar bitácora de SQA (PDF)
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
