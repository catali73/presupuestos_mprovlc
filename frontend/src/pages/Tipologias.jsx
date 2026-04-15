import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import api from '../lib/api';

export default function Tipologias() {
  const qc = useQueryClient();
  const [nueva, setNueva] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [error, setError] = useState('');

  const { data: tipologias = [], isLoading } = useQuery({
    queryKey: ['tipologias'],
    queryFn: () => api.get('/tipologias').then(r => r.data),
  });

  const crear = useMutation({
    mutationFn: (nombre) => api.post('/tipologias', { nombre }),
    onSuccess: () => { qc.invalidateQueries(['tipologias']); setNueva(''); setError(''); },
    onError: (e) => setError(e.response?.data?.error || 'Error al crear'),
  });

  const actualizar = useMutation({
    mutationFn: ({ id, nombre }) => api.put(`/tipologias/${id}`, { nombre }),
    onSuccess: () => { qc.invalidateQueries(['tipologias']); setEditId(null); setError(''); },
    onError: (e) => setError(e.response?.data?.error || 'Error al actualizar'),
  });

  const eliminar = useMutation({
    mutationFn: (id) => api.delete(`/tipologias/${id}`),
    onSuccess: () => qc.invalidateQueries(['tipologias']),
  });

  function handleCrear(e) {
    e.preventDefault();
    if (!nueva.trim()) return;
    crear.mutate(nueva.trim());
  }

  function startEdit(t) {
    setEditId(t.id);
    setEditNombre(t.nombre);
    setError('');
  }

  function handleUpdate(e) {
    e.preventDefault();
    if (!editNombre.trim()) return;
    actualizar.mutate({ id: editId, nombre: editNombre.trim() });
  }

  return (
    <div className="p-4 max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tipologías</h1>
        <p className="text-gray-500 text-sm mt-1">Gestiona las tipologías de presupuesto</p>
      </div>

      {/* Crear nueva */}
      <div className="card p-4 mb-4">
        <form onSubmit={handleCrear} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Nueva tipología (ej: COPA DEL REY)"
            value={nueva}
            onChange={e => { setNueva(e.target.value); setError(''); }}
          />
          <button className="btn-primary" type="submit" disabled={crear.isPending || !nueva.trim()}>
            <Plus size={15} /> Añadir
          </button>
        </form>
        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-center text-gray-400 text-sm">Cargando...</p>
        ) : tipologias.length === 0 ? (
          <p className="p-6 text-center text-gray-400 text-sm">No hay tipologías. Crea la primera arriba.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tipologias.map(t => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                {editId === t.id ? (
                  <form onSubmit={handleUpdate} className="flex items-center gap-2 flex-1">
                    <input
                      className="input flex-1 text-sm"
                      value={editNombre}
                      onChange={e => setEditNombre(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="p-1.5 hover:bg-green-50 rounded-lg text-green-600" title="Guardar">
                      <Check size={15} />
                    </button>
                    <button type="button" onClick={() => setEditId(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400" title="Cancelar">
                      <X size={15} />
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-gray-800">{t.nombre}</span>
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700"
                      title="Editar"
                    ><Pencil size={14} /></button>
                    <button
                      onClick={() => eliminar.mutate(t.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"
                      title="Eliminar"
                    ><Trash2 size={14} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        {tipologias.length} tipología{tipologias.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
