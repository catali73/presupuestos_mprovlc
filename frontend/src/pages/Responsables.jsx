import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, X } from 'lucide-react';
import api from '../lib/api';

function empty() { return { nombre: '', telefono: '', email: '', password: '', activo: true }; }

export default function Responsables() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  const { data: responsables = [], isLoading } = useQuery({
    queryKey: ['responsables'],
    queryFn: () => api.get('/responsables').then(r => r.data),
  });

  const openCreate = () => { setForm(empty()); setModal({ mode: 'create' }); };
  const openEdit = (r) => { setForm({ ...r, password: '' }); setModal({ mode: 'edit', id: r.id }); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.mode === 'create') await api.post('/responsables', form);
      else await api.put(`/responsables/${modal.id}`, form);
      qc.invalidateQueries(['responsables']);
      setModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Responsables</h1>
          <p className="text-gray-500 text-sm mt-1">Usuarios con acceso al sistema</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Nuevo responsable</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="table-th">Nombre</th>
              <th className="table-th">Email</th>
              <th className="table-th">Teléfono</th>
              <th className="table-th">Estado</th>
              <th className="table-th text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="table-td text-center py-12 text-gray-400">Cargando...</td></tr>
            ) : responsables.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="table-td font-medium">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold">
                      {r.nombre[0]?.toUpperCase()}
                    </div>
                    {r.nombre}
                  </div>
                </td>
                <td className="table-td text-gray-500">{r.email}</td>
                <td className="table-td text-gray-500">{r.telefono || '—'}</td>
                <td className="table-td">
                  <span className={`badge ${r.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="table-td text-right">
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700" onClick={() => openEdit(r)}>
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">{modal.mode === 'create' ? 'Nuevo responsable' : 'Editar responsable'}</h2>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">{modal.mode === 'edit' ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
                <input className="input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              {modal.mode === 'edit' && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="activo" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="rounded" />
                  <label htmlFor="activo" className="text-sm text-gray-700">Activo</label>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.nombre || !form.email || (modal.mode === 'create' && !form.password)}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
