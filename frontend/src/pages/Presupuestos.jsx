import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Copy, Download, ChevronDown, Search, Filter, X, Trash2 } from 'lucide-react';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';

const DEPARTAMENTOS = ['CAMARAS_ESPECIALES', 'PRODUCCIONES_VLC', 'INTERNACIONAL', 'VALENCIA_MEDIA'];
const STATUSES = ['PREPARADO', 'ENVIADO', 'APROBADO', 'DESCARTADO', 'FACTURADO', 'PENDIENTE_FACTURAR'];
const STATUS_LABELS = {
  PREPARADO: 'Preparado', ENVIADO: 'Enviado', APROBADO: 'Aprobado',
  DESCARTADO: 'Descartado', FACTURADO: 'Facturado', PENDIENTE_FACTURAR: 'Pte. Facturar',
};
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

function fmtEUR(val) {
  if (val == null || val === '') return '—';
  const num = parseFloat(val);
  if (isNaN(num)) return '—';
  const [int, dec] = num.toFixed(2).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec + ' €';
}

const emptyFilters = { status: '', departamento: '', search: '', anyo: '', trimestre: '', mes: '' };

export default function Presupuestos() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filters, setFilters] = useState(emptyFilters);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, numero, evento }

  const { data, isLoading } = useQuery({
    queryKey: ['presupuestos', filters],
    queryFn: () => api.get('/presupuestos', { params: filters }).then(r => r.data),
  });

  const duplicate = useMutation({
    mutationFn: (id) => api.post(`/presupuestos/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries(['presupuestos']),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/presupuestos/${id}`),
    onSuccess: () => { qc.invalidateQueries(['presupuestos']); setConfirmDelete(null); },
  });

  const exportDoc = async (id, formato) => {
    const res = await api.get(`/presupuestos/${id}/export/${formato}`, { responseType: 'blob' });
    const ext = formato === 'excel' ? 'xlsx' : 'pdf';
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = `presupuesto.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  const f = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));
  const hasFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data?.total ?? '—'} presupuestos
          </p>
        </div>

        <div className="relative">
          <button onClick={() => setShowNewMenu(v => !v)} className="btn-primary">
            <Plus size={16} /> Nuevo presupuesto <ChevronDown size={14} />
          </button>
          {showNewMenu && (
            <div className="absolute right-0 mt-2 w-52 card shadow-lg z-10 py-1">
              <button
                onClick={() => { navigate('/presupuestos/nuevo/GENERAL'); setShowNewMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-red-700"
              >Presupuesto General</button>
              <button
                onClick={() => { navigate('/presupuestos/nuevo/PERSONAL'); setShowNewMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-orange-600"
              >Presupuesto Personal Valencia</button>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter size={14} className="text-gray-400 shrink-0" />
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-8"
              placeholder="Buscar evento, nº, cliente..."
              value={filters.search}
              onChange={e => f('search', e.target.value)}
            />
          </div>
          <select className="select w-44" value={filters.status} onChange={e => f('status', e.target.value)}>
            <option value="">Todos los status</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select className="select w-48" value={filters.departamento} onChange={e => f('departamento', e.target.value)}>
            <option value="">Todos los departamentos</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
          </select>
          {hasFilters && (
            <button className="btn-ghost text-xs" onClick={() => setFilters(emptyFilters)}>
              <X size={13} /> Limpiar
            </button>
          )}
        </div>

        {/* Filtros de fecha */}
        <div className="flex flex-wrap gap-3 items-center pl-5">
          <span className="text-xs text-gray-400 shrink-0">Fecha:</span>
          <select className="select w-28" value={filters.anyo} onChange={e => f('anyo', e.target.value)}>
            <option value="">Año</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            className="select w-32"
            value={filters.trimestre}
            onChange={e => { f('trimestre', e.target.value); f('mes', ''); }}
          >
            <option value="">Trimestre</option>
            <option value="1">Q1 · Ene–Mar</option>
            <option value="2">Q2 · Abr–Jun</option>
            <option value="3">Q3 · Jul–Sep</option>
            <option value="4">Q4 · Oct–Dic</option>
          </select>
          <select
            className="select w-36"
            value={filters.mes}
            onChange={e => { f('mes', e.target.value); f('trimestre', ''); }}
          >
            <option value="">Mes</option>
            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Barra de totales */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-sm text-gray-500">
          {isLoading ? 'Calculando...' : `${data?.total ?? 0} presupuesto${data?.total !== 1 ? 's' : ''}`}
          {hasFilters ? ' (filtrados)' : ''}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Total s/IVA:</span>
          <span className="text-base font-bold text-gray-800">
            {isLoading ? '…' : fmtEUR(data?.importe_total)}
          </span>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-th-sm w-36">Nº / Fecha</th>
                <th className="table-th-sm">Evento</th>
                <th className="table-th-sm w-36">Cliente</th>
                <th className="table-th-sm w-40">Depto · Responsable</th>
                <th className="table-th-sm w-32">Fechas</th>
                <th className="table-th-sm w-28 text-right">Importe s/IVA</th>
                <th className="table-th-sm w-32">Status</th>
                <th className="table-th-sm w-24 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="table-td-sm text-center text-gray-400 py-12">Cargando...</td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={8} className="table-td-sm text-center text-gray-400 py-12">No hay presupuestos</td></tr>
              ) : (
                data.data.map(p => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/presupuestos/${p.id}`)}
                  >
                    {/* Nº + Fecha + Tipo badge */}
                    <td className="table-td-sm whitespace-nowrap">
                      <span className={`badge text-[10px] px-1.5 py-0 mb-0.5 ${p.tipo === 'GENERAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {p.tipo === 'GENERAL' ? 'GEN' : 'PERS'}
                      </span>
                      <p className="font-mono text-xs text-gray-600 leading-tight">{p.numero}</p>
                      <p className="text-[10px] text-gray-400">{p.fecha_presupuesto ? new Date(p.fecha_presupuesto).toLocaleDateString('es-ES') : '—'}</p>
                    </td>
                    {/* Evento */}
                    <td className="table-td-sm max-w-0">
                      <p className="font-medium text-gray-800 truncate" title={p.evento}>{p.evento || '—'}</p>
                    </td>
                    {/* Cliente */}
                    <td className="table-td-sm max-w-0">
                      <p className="text-gray-600 truncate" title={p.cliente_nombre}>{p.cliente_nombre || '—'}</p>
                    </td>
                    {/* Depto + Responsable fusionados */}
                    <td className="table-td-sm">
                      <p className="text-gray-500 leading-tight truncate" title={p.departamento?.replace(/_/g, ' ')}>
                        {p.departamento?.replace(/_/g, ' ') || '—'}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">{p.responsable_nombre || ''}</p>
                    </td>
                    {/* Fechas */}
                    <td className="table-td-sm whitespace-nowrap text-gray-500">
                      {p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString('es-ES') : ''}
                      {p.fecha_inicio && p.fecha_fin ? <br /> : null}
                      {p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString('es-ES') : (!p.fecha_inicio ? '—' : '')}
                    </td>
                    {/* Importe */}
                    <td className="table-td-sm text-right font-medium text-gray-800 tabular-nums whitespace-nowrap">
                      {parseFloat(p.total_bruto) > 0 ? fmtEUR(p.total_bruto) : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Status */}
                    <td className="table-td-sm"><StatusBadge status={p.status} /></td>
                    {/* Acciones */}
                    <td className="table-td-sm text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          title="Duplicar"
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700"
                          onClick={() => duplicate.mutate(p.id)}
                        ><Copy size={13} /></button>
                        <button
                          title="Exportar Excel"
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-green-700"
                          onClick={() => exportDoc(p.id, 'excel')}
                        ><Download size={13} /></button>
                        <button
                          title="Eliminar"
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"
                          onClick={() => setConfirmDelete({ id: p.id, numero: p.numero, evento: p.evento })}
                        ><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Fila de total al pie de la tabla */}
            {!isLoading && data?.data?.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={5} className="table-td-sm text-xs text-gray-500 font-medium">
                    {data.total} presupuesto{data.total !== 1 ? 's' : ''}{hasFilters ? ' filtrados' : ''}
                  </td>
                  <td className="table-td-sm text-right font-bold text-gray-900 tabular-nums whitespace-nowrap">
                    {fmtEUR(data.importe_total)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {/* Modal confirmación de borrado */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Eliminar presupuesto</h3>
                <p className="text-xs text-gray-500 mt-0.5">{confirmDelete.numero}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              ¿Seguro que quieres eliminar{' '}
              <span className="font-medium">"{confirmDelete.evento || confirmDelete.numero}"</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end pt-1">
              <button
                className="btn-secondary"
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMutation.isPending}
              >Cancelar</button>
              <button
                className="btn-danger"
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
              >{deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
