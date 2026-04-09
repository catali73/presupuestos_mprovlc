import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';

const STATUS_COLORS = {
  PREPARADO: '#6b7280',
  ENVIADO: '#3b82f6',
  APROBADO: '#22c55e',
  DESCARTADO: '#9ca3af',
  FACTURADO: '#8b5cf6',
  PENDIENTE_FACTURAR: '#f97316',
};

const STATUS_LABELS = {
  PREPARADO: 'Preparados',
  ENVIADO: 'Enviados',
  APROBADO: 'Aprobados',
  DESCARTADO: 'Descartados',
  FACTURADO: 'Facturados',
  PENDIENTE_FACTURAR: 'Pte. Facturar',
};

function fmt(v) {
  if (v == null) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const stackMap = Object.fromEntries((data?.stack || []).map(s => [s.status, parseInt(s.count)]));
  const importesMap = Object.fromEntries((data?.importes || []).map(s => [s.status, parseFloat(s.total_bruto)]));

  const stackCards = ['ENVIADO', 'APROBADO', 'PENDIENTE_FACTURAR', 'FACTURADO'];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen de presupuestos</p>
      </div>

      {/* Stack cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stackCards.map(status => (
          <div key={status} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <StatusBadge status={status} />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stackMap[status] || 0}</p>
            <p className="text-sm text-gray-500 mt-1">{fmt(importesMap[status])}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolución mensual */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Presupuestos últimos 12 meses</h2>
          {data?.porMes?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.porMes}>
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#b91c1c" radius={[4, 4, 0, 0]} name="Presupuestos" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm">Sin datos</p>
          )}
        </div>

        {/* Por departamento */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Por departamento</h2>
          <div className="space-y-2">
            {Object.entries(
              (data?.porDepartamento || []).reduce((acc, r) => {
                if (!acc[r.departamento]) acc[r.departamento] = 0;
                acc[r.departamento] += parseInt(r.count);
                return acc;
              }, {})
            ).map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">
                  {dept?.replace(/_/g, ' ') || 'Sin asignar'}
                </span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pendientes de facturar */}
      {data?.pendientes?.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Pendientes de facturar</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-th">Nº</th>
                <th className="table-th">Evento</th>
                <th className="table-th">Cliente</th>
                <th className="table-th">Fecha fin</th>
              </tr>
            </thead>
            <tbody>
              {data.pendientes.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="table-td font-mono text-xs">{p.numero}</td>
                  <td className="table-td">{p.evento}</td>
                  <td className="table-td">{p.cliente}</td>
                  <td className="table-td text-orange-600">
                    {p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString('es-ES') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
