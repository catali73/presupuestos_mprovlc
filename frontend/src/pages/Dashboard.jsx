import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';

const STATUS_CARDS = ['ENVIADO', 'APROBADO', 'PENDIENTE_FACTURAR', 'FACTURADO'];
const STATUS_CFG = {
  ENVIADO:            { border: 'border-blue-200',   bg: 'bg-blue-50',   txt: 'text-blue-700' },
  APROBADO:           { border: 'border-green-200',  bg: 'bg-green-50',  txt: 'text-green-700' },
  PENDIENTE_FACTURAR: { border: 'border-orange-200', bg: 'bg-orange-50', txt: 'text-orange-700' },
  FACTURADO:          { border: 'border-purple-200', bg: 'bg-purple-50', txt: 'text-purple-700' },
};

/* ── Formatters ─────────────────────────────────────────────────────────────── */
function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}
function fmtK(v) {
  if (v == null || isNaN(v)) return '—';
  const n = parseFloat(v);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M€`;
  if (abs >= 10_000)    return `${(n / 1_000).toLocaleString('es-ES',     { maximumFractionDigits: 0 })} k€`;
  return fmt(n);
}
function fmtMes(mes) {
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const m = parseInt(mes?.split('-')[1]) - 1;
  return meses[m] ?? mes;
}

/* ── Tooltip gráfico ────────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow rounded-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-600 mb-0.5">{label}</p>
      <p className="text-red-700 font-medium">{fmt(payload[0]?.value)}</p>
      <p className="text-gray-400">{payload[1]?.value} presupuestos</p>
    </div>
  );
}

/* ── Lista compacta con mini-barra ──────────────────────────────────────────── */
function ListaCompacta({ titulo, rows, nameKey, showMedia = false, limit = 8 }) {
  if (!rows?.length) return (
    <div className="card p-4 h-full">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{titulo}</p>
      <p className="text-gray-300 text-sm">Sin datos</p>
    </div>
  );

  const visible = rows.slice(0, limit);
  const total   = rows.reduce((s, r) => s + parseFloat(r.importe || 0), 0);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{titulo}</p>
        <p className="text-xs text-gray-400">{fmtK(total)}</p>
      </div>
      <div className="space-y-2.5">
        {visible.map(r => {
          const imp = parseFloat(r.importe || 0);
          const pct = total > 0 ? (imp / total) * 100 : 0;
          const name = (r[nameKey] || '—').replace(/_/g, ' ');
          return (
            <div key={r[nameKey]} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-700 truncate flex-1" title={name}>{name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-gray-400">{r.count}</span>
                  <span className="text-xs font-semibold text-gray-800 tabular-nums w-16 text-right">{fmtK(imp)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 bg-gray-100 rounded-full h-1">
                  <div className="bg-red-600 h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-gray-300 w-6 text-right">{pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
        {rows.length > limit && (
          <p className="text-[10px] text-gray-300 pt-1">+{rows.length - limit} más…</p>
        )}
      </div>
      {/* Totales */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex justify-between text-xs">
        <span className="text-gray-400">{rows.reduce((s, r) => s + parseInt(r.count), 0)} presupuestos</span>
        <span className="font-semibold text-gray-700">{fmt(total)}</span>
      </div>
    </div>
  );
}

/* ── Componente principal ───────────────────────────────────────────────────── */
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

  const stackMap    = Object.fromEntries((data?.stack    || []).map(s => [s.status, parseInt(s.count)]));
  const importesMap = Object.fromEntries((data?.importes || []).map(s => [s.status, parseFloat(s.total_bruto)]));
  const mesData     = (data?.porMes || []).map(m => ({
    mes:     fmtMes(m.mes),
    importe: parseFloat(m.importe || 0),
    count:   parseInt(m.count),
  }));

  return (
    <div className="p-4 space-y-3">

      {/* ── Cabecera ── */}
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-400">Año {data?.yearActual}</span>
      </div>

      {/* ── Fila 1: Status cards compactos ── */}
      <div className="grid grid-cols-4 gap-3">
        {STATUS_CARDS.map(status => {
          const cfg = STATUS_CFG[status];
          return (
            <div key={status} className={`card px-4 py-3 border ${cfg.border} ${cfg.bg} flex items-center justify-between`}>
              <StatusBadge status={status} />
              <div className="text-right">
                <p className={`text-xl font-bold leading-none ${cfg.txt}`}>{stackMap[status] || 0}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{fmtK(importesMap[status])}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Fila 2: Gráfico mensual + Departamentos ── */}
      <div className="grid grid-cols-5 gap-3">

        {/* Gráfico — ocupa 3/5 */}
        <div className="col-span-3 card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Facturación mensual — últimos 12 meses</p>
            <span className="text-[10px] text-gray-300">s/IVA</span>
          </div>
          {mesData.length ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={mesData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="importe" fill="#b91c1c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-300 text-sm h-40 flex items-center justify-center">Sin datos</p>
          )}
        </div>

        {/* Departamentos — ocupa 2/5 */}
        <div className="col-span-2">
          <ListaCompacta
            titulo={`Por departamento`}
            rows={data?.porDepartamento}
            nameKey="departamento"
          />
        </div>
      </div>

      {/* ── Fila 3: Tipología · Clientes · Pendientes ── */}
      <div className="grid grid-cols-3 gap-3">

        <ListaCompacta
          titulo="Por tipología"
          rows={data?.porTipologia}
          nameKey="tipologia"
        />

        <ListaCompacta
          titulo="Por cliente"
          rows={data?.porCliente}
          nameKey="cliente"
          limit={8}
        />

        {/* Pendientes de facturar */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pendientes de facturar</p>
            {data?.pendientes?.length > 0 && (
              <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">
                {data.pendientes.length}
              </span>
            )}
          </div>
          {data?.pendientes?.length ? (
            <div className="space-y-2">
              {data.pendientes.map(p => (
                <div key={p.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate" title={p.evento}>{p.evento}</p>
                    <p className="text-[10px] text-gray-400 truncate">{p.cliente}</p>
                  </div>
                  <p className="text-[10px] text-orange-500 shrink-0 font-medium">
                    {p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-300 text-xs">Ninguno pendiente</p>
          )}
        </div>
      </div>

    </div>
  );
}
