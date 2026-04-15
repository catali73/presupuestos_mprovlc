import { useState, useRef } from 'react';
import { X, FileDown, Upload, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import api from '../lib/api';

export default function ImportModal({ onClose, onSuccess }) {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null); // { created, skipped, errors }
  const inputRef              = useRef();

  async function downloadTemplate() {
    const res = await api.get('/presupuestos/template', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'plantilla_importacion_presupuestos.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/presupuestos/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.created > 0) onSuccess();
    } catch (err) {
      setResult({ created: 0, skipped: 0, errors: [{ fila: '—', evento: '', error: err.response?.data?.error || err.message }] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg p-6 space-y-5">

        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">Importar presupuestos</h2>
            <p className="text-xs text-gray-500 mt-0.5">Carga masiva desde Excel</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={18} /></button>
        </div>

        {/* Paso 1 */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">1 · Descarga la plantilla</p>
          <p className="text-sm text-gray-600">
            Rellénala con los datos de cada presupuesto. La columna <code className="bg-gray-100 px-1 rounded text-xs">cliente</code> y <code className="bg-gray-100 px-1 rounded text-xs">responsable</code> deben coincidir exactamente con los nombres dados de alta en la app.
          </p>
          <button onClick={downloadTemplate} className="btn-secondary text-sm mt-1">
            <FileDown size={15} /> Descargar plantilla Excel
          </button>
        </div>

        {/* Paso 2 */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">2 · Sube el Excel relleno</p>
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
            }`}
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <div className="space-y-1">
                <CheckCircle size={22} className="text-green-500 mx-auto" />
                <p className="text-sm font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-green-600">{(file.size / 1024).toFixed(0)} KB · haz clic para cambiar</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload size={22} className="text-gray-400 mx-auto" />
                <p className="text-sm text-gray-500">Haz clic o arrastra el fichero .xlsx aquí</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { setFile(e.target.files[0] || null); setResult(null); }}
            />
          </div>
        </div>

        {/* Resultados */}
        {result && (
          <div className="space-y-2">
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-green-700">
                <CheckCircle size={15} />
                <span className="font-semibold">{result.created}</span> creados
              </div>
              {result.skipped > 0 && (
                <div className="text-gray-400 text-xs self-center">{result.skipped} filas vacías ignoradas</div>
              )}
              {result.errors.length > 0 && (
                <div className="flex items-center gap-1.5 text-red-600">
                  <AlertCircle size={15} />
                  <span className="font-semibold">{result.errors.length}</span> errores
                </div>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-700">
                    <span className="font-mono bg-red-100 px-1 rounded">Fila {e.fila}</span>
                    {e.evento ? <span className="ml-1 text-red-500">({e.evento})</span> : null}
                    {' — '}{e.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-3 justify-end pt-1">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cerrar</button>
          <button
            className="btn-primary"
            onClick={handleImport}
            disabled={!file || loading}
          >
            {loading ? (
              <><Loader size={15} className="animate-spin" /> Importando...</>
            ) : (
              <><Upload size={15} /> Importar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
