import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, UserPlus } from 'lucide-react';
import api from '../lib/api';

function emptyContacto() { return { nombre: '', telefono: '', email: '' }; }
function emptyCliente() {
  return { nombre: '', razon_social: '', cif: '', direccion: '', codigo_postal: '', ciudad: '', pais: 'España', tipologia: '', contactos: [emptyContacto()] };
}

export default function Clientes() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // null | { mode: 'create' | 'edit', data }
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyCliente());

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => api.get('/clientes').then(r => r.data),
  });

  const openCreate = () => { setForm(emptyCliente()); setModal({ mode: 'create' }); };
  const openEdit = (c) => {
    setForm({ ...c, pais: c.pais || 'España', contactos: c.contactos?.length ? c.contactos : [emptyContacto()] });
    setModal({ mode: 'edit', id: c.id });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await api.post('/clientes', form);
      } else {
        await api.put(`/clientes/${modal.id}`, form);
      }
      qc.invalidateQueries(['clientes']);
      setModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    await api.delete(`/clientes/${id}`);
    qc.invalidateQueries(['clientes']);
  };

  const setContacto = (idx, key, val) => {
    setForm(f => ({
      ...f,
      contactos: f.contactos.map((c, i) => i === idx ? { ...c, [key]: val } : c),
    }));
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">{clientes.length} clientes</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Nuevo cliente</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="table-th">Nombre</th>
              <th className="table-th">Razón social / CIF</th>
              <th className="table-th">Tipología</th>
              <th className="table-th">Contactos</th>
              <th className="table-th text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="table-td text-center text-gray-400 py-12">Cargando...</td></tr>
            ) : !clientes.length ? (
              <tr><td colSpan={5} className="table-td text-center text-gray-400 py-12">No hay clientes</td></tr>
            ) : clientes.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="table-td font-medium">{c.nombre}</td>
                <td className="table-td text-gray-500 text-xs">
                  <p>{c.razon_social || '—'}</p>
                  <p className="text-gray-400">{c.cif || ''}</p>
                </td>
                <td className="table-td">
                  {c.tipologia ? (
                    <span className={`badge ${c.tipologia === 'GRUPO' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {c.tipologia}
                    </span>
                  ) : '—'}
                </td>
                <td className="table-td text-xs text-gray-500">
                  {c.contactos?.map(ct => (
                    <div key={ct.id}>{ct.nombre} {ct.email ? `· ${ct.email}` : ''}</div>
                  ))}
                </td>
                <td className="table-td text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700" onClick={() => openEdit(c)}><Pencil size={14} /></button>
                    <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">{modal.mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}</h2>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Datos básicos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Nombre *</label>
                  <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Razón social</label>
                  <input className="input" value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} />
                </div>
                <div>
                  <label className="label">CIF</label>
                  <input className="input" value={form.cif} onChange={e => setForm(f => ({ ...f, cif: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Tipología</label>
                  <select className="select" value={form.tipologia} onChange={e => setForm(f => ({ ...f, tipologia: e.target.value }))}>
                    <option value="">Seleccionar</option>
                    <option value="GRUPO">GRUPO</option>
                    <option value="EXTERNO">EXTERNO</option>
                  </select>
                </div>
              </div>

              {/* Dirección */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dirección</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Calle / Dirección</label>
                    <input className="input" placeholder="Av. Example, 123" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Código postal</label>
                    <input className="input" placeholder="46000" value={form.codigo_postal} onChange={e => setForm(f => ({ ...f, codigo_postal: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Ciudad</label>
                    <input className="input" placeholder="Valencia" value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">País</label>
                    <input className="input" placeholder="España" value={form.pais} onChange={e => setForm(f => ({ ...f, pais: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Contactos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Personas de contacto</p>
                  <button className="btn-ghost text-xs" onClick={() => setForm(f => ({ ...f, contactos: [...f.contactos, emptyContacto()] }))}>
                    <UserPlus size={13} /> Añadir
                  </button>
                </div>
                {form.contactos.map((c, i) => (
                  <div key={i} className="flex gap-2 mb-2 p-3 bg-gray-50 rounded-lg items-center">
                    <input className="input text-xs flex-1 min-w-0" placeholder="Nombre" value={c.nombre} onChange={e => setContacto(i, 'nombre', e.target.value)} />
                    <input className="input text-xs flex-1 min-w-0" placeholder="Email" value={c.email} onChange={e => setContacto(i, 'email', e.target.value)} />
                    <input className="input text-xs w-40 shrink-0" placeholder="+34 600 000 000" value={c.telefono} onChange={e => setContacto(i, 'telefono', e.target.value)} />
                    {form.contactos.length > 1 && (
                      <button onClick={() => setForm(f => ({ ...f, contactos: f.contactos.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600 shrink-0">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.nombre}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
