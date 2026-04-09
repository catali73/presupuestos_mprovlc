import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Copy, Download, Mail, ChevronDown, Search, Filter } from 'lucide-react';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';

const DEPARTAMENTOS = ['CAMARAS_ESPECIALES', 'PRODUCCIONES_VLC', 'INTERNACIONAL', 'VALENCIA_MEDIA'];
const STATUSES = ['PREPARADO', 'ENVIADO', 'APROBADO', 'DESCARTADO', 'FACTURADO', 'PENDIENTE_FACTURAR'];
const STATUS_LABELS = {
  PREPARADO: 'Preparado', ENVIADO: 'Enviado', APROBADO: 'Aprobado',
  DESCARTADO: 'Descartado', FACTURADO: 'Facturado', PENDIENTE_FACTURAR: 'Pte. Facturar',
};

export default function Presupuestos() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: '', departamento: '', search: '' });
  const [showNewMenu, setShowNewMenu] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['presupuestos', filters],
    queryFn: () => api.get('/presupuestos', { params: filters }).then(r => r.data),
  });

  const duplicate = useMutation({
    mutationFn: (id) => api.post(`/presupuestos/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries(['presupuestos']),
  });

  const exportDoc = async (id, formato) => {
    const res = await api.get(`/presupuestos/${id}/export/${formato}`, { responseType: 'blob' });
    const ext = formato === 'excel' ? 'xlsx' : 'pdf';
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = `presupuesto.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  const f = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data?.total ?? '—'} presupuestos totales
          </p>
        </div>

        {/* Nuevo presupuesto */}
        <div className="relative">
          <button
            onClick={() => setShowNewMenu(v => !v)}
            className="btn-primary"
          >
            <Plus size={16} /> Nuevo presupuesto <ChevronDown size={14} />
          </button>
          {showNewMenu && (
            <div className="absolute right-0 mt-2 w-52 card shadow-lg z-10 py-1">
              <button
                onClick={() => { navigate('/presupuestos/nuevo/GENERAL'); setShowNewMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-red-700"
              >
                Presupuesto General
              </button>
              <button
                onClick={() => { navigate('/presupuestos/nuevo/PERSONAL'); setShowNewMenu(false); }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium text-orange-600"
              >
                Presupuesto Personal Valencia
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-center">
        <Filter size={14} className="text-gray-400" />
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
        <select className="select w-52" value={filters.departamento} onChange={e => f('departamento', e.target.value)}>
          <option value="">Todos los departamentos</option>
          {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
        </select>
        {(filters.status || filters.departamento || filters.search) && (
          <button className="btn-ghost text-xs" onClick={() => setFilters({ status: '', departamento: '', search: '' })}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-th">Nº / Fecha</th>
                <th className="table-th">Tipo</th>
                <th className="table-th">Evento</th>
                <th className="table-th">Cliente</th>
                <th className="table-th">Departamento</th>
                <th className="table-th">Responsable</th>
                <th className="table-th">Fechas</th>
                <th className="table-th">Status</th>
                <th className="table-th text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="table-td text-center text-gray-400 py-12">Cargando...</td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={9} className="table-td text-center text-gray-400 py-12">No hay presupuestos</td></tr>
              ) : (
                data.data.map(p => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/presupuestos/${p.id}`)}
                  >
                    <td className="table-td">
                      <p className="font-mono text-xs text-gray-500">{p.numero}</p>
                      <p className="text-xs text-gray-400">{p.fecha_presupuesto ? new Date(p.fecha_presupuesto).toLocaleDateString('es-ES') : '—'}</p>
                    </td>
                    <td className="table-td">
                      <span className={`badge text-xs ${p.tipo === 'GENERAL' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {p.tipo === 'GENERAL' ? 'General' : 'Personal'}
                      </span>
                    </td>
                    <td className="table-td font-medium max-w-xs truncate">{p.evento || '—'}</td>
                    <td className="table-td text-gray-600">{p.cliente_nombre || '—'}</td>
                    <td className="table-td text-xs text-gray-500">{p.departamento?.replace(/_/g, ' ') || '—'}</td>
                    <td className="table-td text-gray-600">{p.responsable_nombre || '—'}</td>
                    <td className="table-td text-xs">
                      {p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString('es-ES') : ''}
                      {p.fecha_inicio && p.fecha_fin ? ' → ' : ''}
                      {p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="table-td"><StatusBadge status={p.status} /></td>
                    <td className="table-td text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Duplicar"
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700"
                          onClick={() => duplicate.mutate(p.id)}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          title="Exportar Excel"
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-green-700"
                          onClick={() => exportDoc(p.id, 'excel')}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
