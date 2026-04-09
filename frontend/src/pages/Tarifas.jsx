import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import api from '../lib/api';

function TarifaTable({ titulo, queryKey, endpoint, columns, emptyForm, renderRow, FormFields }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => api.get(endpoint).then(r => r.data),
  });

  const openCreate = () => { setForm(emptyForm); setModal({ mode: 'create' }); };
  const openEdit = (row) => { setForm(row); setModal({ mode: 'edit', id: row.id }); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.mode === 'create') await api.post(endpoint, form);
      else await api.put(`${endpoint}/${modal.id}`, form);
      qc.invalidateQueries([queryKey]);
      setModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar?')) return;
    await api.delete(`${endpoint}/${id}`);
    qc.invalidateQueries([queryKey]);
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-800">{titulo}</h2>
        <button className="btn-primary btn py-1.5 text-xs" onClick={openCreate}>
          <Plus size={13} /> Añadir
        </button>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map(c => <th key={c} className="table-th">{c}</th>)}
            <th className="table-th text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={columns.length + 1} className="table-td text-center py-8 text-gray-400">Cargando...</td></tr>
          ) : !data.length ? (
            <tr><td colSpan={columns.length + 1} className="table-td text-center py-8 text-gray-400">Sin registros</td></tr>
          ) : data.map(row => (
            <tr key={row.id} className="hover:bg-gray-50">
              {renderRow(row)}
              <td className="table-td text-right">
                <div className="flex items-center justify-end gap-1">
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700" onClick={() => openEdit(row)}><Pencil size={13} /></button>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600" onClick={() => handleDelete(row.id)}><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">{modal.mode === 'create' ? `Nueva entrada — ${titulo}` : 'Editar'}</h2>
              <button onClick={() => setModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <FormFields form={form} setForm={setForm} />
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CATEGORIA_LABELS = {
  CAMARAS_ESPECIALES: 'Cámaras Especiales',
  CONTRATADO: 'Personal Contratado',
  ALTAS_BAJAS: 'Altas / Bajas',
};

const CATEGORIA_COLORS = {
  CAMARAS_ESPECIALES: 'bg-red-100 text-red-800',
  CONTRATADO: 'bg-orange-100 text-orange-800',
  ALTAS_BAJAS: 'bg-blue-100 text-blue-800',
};

function fmtMoney(v) { return v != null ? `${parseFloat(v).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : '—'; }

export default function Tarifas() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tarifas & Equipos</h1>
        <p className="text-gray-500 text-sm mt-1">Tablas editables de referencia para los presupuestos</p>
      </div>

      {/* Tarifas Equipos */}
      <TarifaTable
        titulo="Tarifas de Equipos"
        queryKey="tarifas-equipos"
        endpoint="/tarifas/equipos"
        emptyForm={{ descripcion: '', tarifa_montaje: '', tarifa_trabajo: '' }}
        columns={['Descripción equipo', 'Tarifa día montaje', 'Tarifa día trabajo']}
        renderRow={row => (
          <>
            <td className="table-td font-medium">{row.descripcion}</td>
            <td className="table-td">{fmtMoney(row.tarifa_montaje)}</td>
            <td className="table-td">{fmtMoney(row.tarifa_trabajo)}</td>
          </>
        )}
        FormFields={({ form, setForm }) => (
          <>
            <div>
              <label className="label">Descripción *</label>
              <input className="input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Tarifa día montaje</label>
                <input className="input" type="number" value={form.tarifa_montaje} onChange={e => setForm(f => ({ ...f, tarifa_montaje: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tarifa día trabajo</label>
                <input className="input" type="number" value={form.tarifa_trabajo} onChange={e => setForm(f => ({ ...f, tarifa_trabajo: e.target.value }))} />
              </div>
            </div>
          </>
        )}
      />

      {/* Tarifa Personas */}
      <TarifaTable
        titulo="Tarifa Personas (por posición)"
        queryKey="tarifas-personas"
        endpoint="/tarifas/personas"
        emptyForm={{ posicion: '', tarifa_dia: '', categoria: 'CONTRATADO' }}
        columns={['Posición', 'Tarifa día', 'Tipología']}
        renderRow={row => (
          <>
            <td className="table-td font-medium">{row.posicion}</td>
            <td className="table-td">{fmtMoney(row.tarifa_dia)}</td>
            <td className="table-td">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORIA_COLORS[row.categoria] || 'bg-gray-100 text-gray-600'}`}>
                {CATEGORIA_LABELS[row.categoria] || row.categoria || '—'}
              </span>
            </td>
          </>
        )}
        FormFields={({ form, setForm }) => (
          <>
            <div>
              <label className="label">Posición *</label>
              <input className="input" value={form.posicion} onChange={e => setForm(f => ({ ...f, posicion: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tarifa día *</label>
              <input className="input" type="number" value={form.tarifa_dia} onChange={e => setForm(f => ({ ...f, tarifa_dia: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tipología *</label>
              <select className="select" value={form.categoria || 'CONTRATADO'} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                <option value="CAMARAS_ESPECIALES">Cámaras Especiales (→ Presup. General)</option>
                <option value="CONTRATADO">Personal Contratado (→ Presup. Personal)</option>
                <option value="ALTAS_BAJAS">Altas / Bajas (→ Presup. Personal)</option>
              </select>
            </div>
          </>
        )}
      />

      {/* Tarifa Dietas */}
      <TarifaTable
        titulo="Tarifa Dietas"
        queryKey="tarifas-dietas"
        endpoint="/tarifas/dietas"
        emptyForm={{ tipo_dieta: '', importe: '' }}
        columns={['Tipo dieta', 'Importe']}
        renderRow={row => (
          <>
            <td className="table-td font-medium">{row.tipo_dieta}</td>
            <td className="table-td">{fmtMoney(row.importe)}</td>
          </>
        )}
        FormFields={({ form, setForm }) => (
          <>
            <div>
              <label className="label">Tipo dieta *</label>
              <input className="input" value={form.tipo_dieta} onChange={e => setForm(f => ({ ...f, tipo_dieta: e.target.value }))} />
            </div>
            <div>
              <label className="label">Importe *</label>
              <input className="input" type="number" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} />
            </div>
          </>
        )}
      />
    </div>
  );
}
