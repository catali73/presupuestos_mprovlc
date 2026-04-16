import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';

const STATUS_CARDS = ['ENVIADO', 'APROBADO', 'PENDIENTE_FACTURAR', 'FACTURADO'];
const STATUS_COLORS = {
  ENVIADO:            { bar: '#3b82f6', bg: 'bg-blue-50',   border: 'border-blue-200',   num: 'text-blue-700' },
  APROBADO:           { bar: '#22c55e', bg: 'bg-green-50',  border: 'border-green-200',  num: 'text-green-700' },
  PENDIENTE_FACTURAR: { bar: '#f97316', bg: 'bg-orange-50', border: 'border-orange-200', num: 'text-orange-700' },
  FACTURADO:          { bar: '#8b5cf6', bg: 'bg-purple-50', border: 'border-purple-200', num: 'text-purple-700' },
};

function fmt(v, compact = false) {
  if (v == null || v === '' || isNaN(v)) return '—';
  if (compact && Math.abs(v) >= 1_000_000)
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(v / 1_000_000) + ' M€';
  if (compact && Math.abs(v) >= 1_000)
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v / 1_000) + ' k€';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function fmtMes(mes) {
  // "2026-01" → "Ene"
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const m = parseInt(mes?.split('-')[1]) - 1;
  return meses[m] ?? mes;
}

// Tooltip personalizado para el gráfico
function TooltipImporte({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-md rounded-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p className="text-red-700">{fmt(payload[0]?.value)}</p>
      <p className="text-gray-400">{payload[1]?.value} presupuestos</p>
    </div>
  );
}

// Tabla de desglose (departamento o tipología)
function TablaDesglose({ titulo, rows, keyField }) {
  if (!rows?.length) return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-800 mb-3 text-sm">{titulo}</h2>
      <p className="text-gray-400 text-sm">Sin datos</p>
    </div>
  );

  const total = rows.reduce((s, r) => s + parseFloat(r.importe || 0), 0);

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-sm">{titulo}</h2>
        <span className="text-xs text-gray-400">{fmt(total)}</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="table-th-sm text-left">Nombre</th>
            <th className="table-th-sm text-right w-12">Nº</th>
            <th className="table-th-sm text-right w-28">Importe s/IVA</th>
            <th className="table-th-sm text-right w-28">Media</th>
            <th className="table-th-sm w-24">% total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const imp = parseFloat(r.importe || 0);
            const pct = total > 0 ? (imp / total) * 100 : 0;
            return (
              <tr key={r[keyField]} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="table-td-sm font-medium text-gray-800">
                  {r[keyField]?.replace(/_/g, ' ') || '—'}
                </td>
                <td className="table-td-sm text-right text-gray-600">{r.count}</td>
                <td className="table-td-sm text-right tabular-nums font-medium text-gray-800">
                  {fmt(imp)}
                </td>
                <td className="table-td-sm text-right tabular-nums text-gray-500">
                  {fmt(parseFloat(r.media || 0))}
                </td>
                <td className="table-td-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-red-600 h-1.5 rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50">
            <td className="table-td-sm text-xs font-semibold text-gray-500">TOTAL</td>
            <td className="table-td-sm text-right text-xs font-semibold text-gray-700">
              {rows.reduce((s, r) => s + parseInt(r.count), 0)}
            </td>
            <td className="table-td-sm text-right tabular-nums font-bold text-gray-900">{fmt(total)}</td>
            <td className="table-td-sm text-right tabular-nums text-gray-500">
              {rows.length ? fmt(total / rows.reduce((s, r) => s + parseInt(r.count), 0)) : '—'}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
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

  const stackMap   = Object.fromEntries((data?.stack   || []).map(s => [s.status, parseInt(s.count)]));
  const importesMap = Object.fromEntries((data?.importes || []).map(s => [s.status, parseFloat(s.total_bruto)]));

  const mesData = (data?.porMes || []).map(m => ({
    mes:     fmtMes(m.mes),
    importe: parseFloat(m.importe || 0),
    count:   parseInt(m.count),
  }));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Resumen · Año {data?.yearActual}</p>
      </div>

      {/* ── Status cards compactos ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATUS_CARDS.map(status => {
          const cfg = STATUS_COLORS[status];
          return (
            <div key={status} className={`card p-4 border ${cfg.border} ${cfg.bg}`}>
              <StatusBadge status={status} />
              <div className="mt-2 flex items-end justify-between">
                <p className={`text-2xl font-bold ${cfg.num}`}>{stackMap[status] || 0}</p>
                <p className="text-xs text-gray-500 text-right leading-tight">
                  {fmt(importesMap[status], true)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Gráfico facturación mensual ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Facturación mensual — últimos 12 meses</h2>
          <span className="text-xs text-gray-400">Importe s/IVA</span>
        </div>
        {mesData.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mesData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip content={<TooltipImporte />} cursor={{ fill: '#f9fafb' }} />
              <Bar dataKey="importe" fill="#b91c1c" radius={[4, 4, 0, 0]} name="Importe" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-400 text-sm">Sin datos</p>
        )}
      </div>

      {/* ── Desglose por departamento y tipología ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TablaDesglose
          titulo={`Por departamento · ${data?.yearActual}`}
          rows={data?.porDepartamento}
          keyField="departamento"
        />
        <TablaDesglose
          titulo={`Por tipología · ${data?.yearActual}`}
          rows={data?.porTipologia}
          keyField="tipologia"
        />
      </div>

      {/* ── Desglose por cliente ── */}
      <TablaDesglose
        titulo={`Por cliente · ${data?.yearActual}`}
        rows={data?.porCliente}
        keyField="cliente"
      />

      {/* ── Pendientes de facturar ── */}
      {data?.pendientes?.length > 0 && (
        <div className="card">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">
              Pendientes de facturar
              <span className="ml-2 text-xs font-normal text-orange-500">
                {data.pendientes.length} presupuestos
              </span>
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-th-sm">Nº</th>
                <th className="table-th-sm">Evento</th>
                <th className="table-th-sm">Cliente</th>
                <th className="table-th-sm">Fecha fin</th>
              </tr>
            </thead>
            <tbody>
              {data.pendientes.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="table-td-sm font-mono text-xs">{p.numero}</td>
                  <td className="table-td-sm">{p.evento}</td>
                  <td className="table-td-sm">{p.cliente}</td>
                  <td className="table-td-sm text-orange-600">
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
