import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText, ExternalLink } from 'lucide-react';
import api from '../lib/api';
import { fmtEUR } from '../lib/format';

function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

const STATUS_CONFIG = {
  PREPARADO:          { label: 'Preparado',       cls: 'bg-gray-100 text-gray-600' },
  ENVIADO:            { label: 'Enviado',          cls: 'bg-blue-100 text-blue-700' },
  APROBADO:           { label: 'Aprobado',         cls: 'bg-green-100 text-green-700' },
  DESCARTADO:         { label: 'Descartado',       cls: 'bg-gray-200 text-gray-500' },
  FACTURADO:          { label: 'Facturado',        cls: 'bg-purple-100 text-purple-700' },
  PENDIENTE_FACTURAR: { label: 'Pte. Facturar',   cls: 'bg-orange-100 text-orange-700' },
};

export default function FacturacionSemanal() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const currentWeek = getISOWeek();

  const [anyo, setAnyo] = useState(currentYear);
  const [semana, setSemana] = useState(currentWeek);
  const [selected, setSelected] = useState(new Set());
  const [downloading, setDownloading] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['presupuestos-semana', anyo, semana],
    queryFn: () => api.get(`/presupuestos?semana=${semana}&anyo=${anyo}&limit=200`).then(r => r.data.data),
  });

  const presupuestos = data || [];

  // Sync selection when data changes — select all by default
  const allIds = presupuestos.map(p => p.id);
  const isAllSelected = allIds.length > 0 && allIds.every(id => selected.has(id));

  const toggleAll = () => {
    if (isAllSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = allIds.filter(id => selected.has(id));
  const totalSeleccionado = presupuestos
    .filter(p => selected.has(p.id))
    .reduce((s, p) => s + parseFloat(p.total_bruto || 0), 0);

  const handleDescargar = async (formato) => {
    if (!selectedIds.length) return;
    setDownloading(formato);
    try {
      const res = await api.post('/presupuestos/export-lote', { ids: selectedIds, formato }, { responseType: 'blob' });
      const ext = formato === 'excel' ? 'xlsx' : 'pdf';
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `presupuestos_S${semana}_${anyo}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error al generar el archivo');
    } finally {
      setDownloading(null);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const weeks = Array.from({ length: 53 }, (_, i) => i + 1);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Cabecera */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Facturación semanal</h1>
        <p className="text-sm text-gray-500 mt-1">Selecciona año y semana para ver y exportar los presupuestos del grupo</p>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Año</label>
          <select className="select w-28" value={anyo} onChange={e => { setAnyo(parseInt(e.target.value)); setSelected(new Set()); }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Semana</label>
          <select className="select w-24" value={semana} onChange={e => { setSemana(parseInt(e.target.value)); setSelected(new Set()); }}>
            {weeks.map(w => <option key={w} value={w}>S{w}</option>)}
          </select>
        </div>
        <div className="text-sm text-gray-500 pb-1">
          {isLoading ? 'Cargando...' : `${presupuestos.length} presupuesto${presupuestos.length !== 1 ? 's' : ''} en S${semana}/${anyo}`}
        </div>
      </div>

      {/* Tabla */}
      {presupuestos.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={isAllSelected} onChange={toggleAll} className="rounded" />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Número</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Evento</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Importe</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {presupuestos.map(p => {
                const isChecked = selected.has(p.id);
                const cfg = STATUS_CONFIG[p.status] || { label: p.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={p.id} className={`transition-colors ${isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={isChecked} onChange={() => toggleOne(p.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.numero}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${p.tipo === 'GENERAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {p.tipo === 'GENERAL' ? 'General' : 'Personal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.cliente_nombre || '—'}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{p.evento || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtEUR(p.total_bruto)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/presupuestos/${p.id}`)} className="text-gray-400 hover:text-gray-600">
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                <td colSpan={6} className="px-4 py-3 text-gray-600">
                  {selectedIds.length} de {presupuestos.length} seleccionados
                </td>
                <td className="px-4 py-3 text-right text-gray-900">{fmtEUR(totalSeleccionado)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : !isLoading ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-lg mb-1">Sin presupuestos</p>
          <p className="text-sm">No hay presupuestos asignados a la semana {semana} del año {anyo}</p>
        </div>
      ) : null}

      {/* Acciones de exportación */}
      {selectedIds.length > 0 && (
        <div className="card p-4 flex items-center justify-between gap-4 border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-700 font-medium">
            {selectedIds.length} presupuesto{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''} · {fmtEUR(totalSeleccionado)}
          </p>
          <div className="flex gap-3">
            <button
              className="btn-secondary flex items-center gap-2"
              onClick={() => handleDescargar('excel')}
              disabled={!!downloading}
            >
              <FileSpreadsheet size={15} />
              {downloading === 'excel' ? 'Generando...' : 'Excel combinado'}
            </button>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => handleDescargar('pdf')}
              disabled={!!downloading}
            >
              <FileText size={15} />
              {downloading === 'pdf' ? 'Generando...' : 'PDF combinado'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
