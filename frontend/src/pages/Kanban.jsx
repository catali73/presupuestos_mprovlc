import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const COLUMNS = [
  { key: 'PREPARADO',          label: 'Preparado',        dot: 'bg-gray-400',   header: 'bg-gray-100 text-gray-700',    border: 'border-gray-200' },
  { key: 'ENVIADO',            label: 'Enviado',          dot: 'bg-blue-500',   header: 'bg-blue-50 text-blue-700',     border: 'border-blue-200' },
  { key: 'APROBADO',           label: 'Aprobado',         dot: 'bg-green-500',  header: 'bg-green-50 text-green-700',   border: 'border-green-200' },
  { key: 'PENDIENTE_FACTURAR', label: 'Pte. Facturar',   dot: 'bg-orange-400', header: 'bg-orange-50 text-orange-700', border: 'border-orange-200' },
  { key: 'FACTURADO',          label: 'Facturado',        dot: 'bg-purple-500', header: 'bg-purple-50 text-purple-700', border: 'border-purple-200' },
  { key: 'DESCARTADO',         label: 'Descartado',       dot: 'bg-gray-300',   header: 'bg-gray-50 text-gray-500',     border: 'border-gray-200' },
];

function fmtEUR(v) {
  if (v == null || (v === '' && v !== 0)) return '';
  const num = parseFloat(v);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

export default function Kanban() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const dragCard = useRef(null);   // { id, fromStatus }
  const [draggingId, setDraggingId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['presupuestos-kanban'],
    queryFn: () => api.get('/presupuestos?limit=500').then(r => r.data.data),
  });

  const byStatus = (status) => (data || []).filter(p => p.status === status);

  const handleDragStart = (e, card) => {
    dragCard.current = card;
    setDraggingId(card.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverCol(null);
    dragCard.current = null;
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverCol(colKey);
  };

  const handleDrop = async (e, colKey) => {
    e.preventDefault();
    setOverCol(null);
    setDraggingId(null); // limpia sombra inmediatamente
    const card = dragCard.current;
    dragCard.current = null;
    if (!card || card.fromStatus === colKey) return;

    // Optimistic update
    qc.setQueryData(['presupuestos-kanban'], (old) =>
      old?.map(p => p.id === card.id ? { ...p, status: colKey } : p)
    );

    try {
      await api.patch(`/presupuestos/${card.id}/status`, { status: colKey });
      qc.invalidateQueries(['presupuestos']);
    } catch {
      qc.invalidateQueries(['presupuestos-kanban']);
    }
  };

  if (isLoading) return (
    <div className="p-8 text-gray-400 text-sm">Cargando...</div>
  );

  return (
    <div className="flex flex-col h-screen">
      <div className="px-8 py-5 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-bold text-gray-900">Estado de presupuestos</h1>
        <p className="text-sm text-gray-500 mt-0.5">Arrastra las tarjetas para cambiar el estado</p>
      </div>

      {/* Tablero */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {COLUMNS.map(col => {
            const cards = byStatus(col.key);
            const isOver = overCol === col.key;

            return (
              <div
                key={col.key}
                className="flex flex-col w-64 shrink-0"
                onDragOver={e => handleDragOver(e, col.key)}
                onDragLeave={() => setOverCol(null)}
                onDrop={e => handleDrop(e, col.key)}
              >
                {/* Cabecera columna */}
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 ${col.header} border ${col.border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                    <span className="font-semibold text-sm">{col.label}</span>
                  </div>
                  <span className="text-xs font-medium opacity-60">{cards.length}</span>
                </div>

                {/* Zona drop */}
                <div className={`flex-1 flex flex-col gap-2 rounded-xl p-1.5 transition-colors min-h-32 ${isOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-dashed' : 'bg-gray-50'}`}>
                  {cards.map(p => (
                    <KanbanCard
                      key={p.id}
                      p={p}
                      isDragging={draggingId === p.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/presupuestos/${p.id}`)}
                    />
                  ))}
                  {cards.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-xs text-gray-400 py-6">
                      Sin presupuestos
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ p, isDragging, onDragStart, onDragEnd, onClick }) {
  const tipoBadge = p.tipo === 'GENERAL'
    ? 'bg-red-100 text-red-700'
    : 'bg-orange-100 text-orange-700';

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, { id: p.id, fromStatus: p.status })}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing select-none transition-all shadow-sm hover:shadow-md hover:border-gray-300 ${isDragging ? 'opacity-40 scale-95' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-mono text-gray-500">{p.numero}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${tipoBadge}`}>
          {p.tipo === 'GENERAL' ? 'GEN' : 'PERS'}
        </span>
      </div>

      <p className="text-sm font-medium text-gray-900 leading-tight mb-1 line-clamp-2">
        {p.evento || '—'}
      </p>

      {p.cliente_nombre && (
        <p className="text-xs text-gray-500 truncate mb-2">{p.cliente_nombre}</p>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        {p.total_bruto > 0
          ? <span className="text-xs font-semibold text-gray-700">{fmtEUR(p.total_bruto)}</span>
          : <span className="text-xs text-gray-300">—</span>
        }
        {p.responsable_nombre && (
          <span className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0" title={p.responsable_nombre}>
            {p.responsable_nombre[0].toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
