import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, ArrowLeft, Send, Download, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';

const DEPARTAMENTOS = ['CAMARAS_ESPECIALES', 'PRODUCCIONES_VLC', 'INTERNACIONAL', 'VALENCIA_MEDIA'];
const TIPOLOGIAS = ['LIGA', 'CHAMPIONS', 'EVENTOS', 'PROGRAMAS'];
const STATUSES = ['PREPARADO', 'ENVIADO', 'APROBADO', 'DESCARTADO', 'FACTURADO', 'PENDIENTE_FACTURAR'];
const STATUS_LABELS = {
  PREPARADO: 'Preparado', ENVIADO: 'Enviado', APROBADO: 'Aprobado',
  DESCARTADO: 'Descartado', FACTURADO: 'Facturado', PENDIENTE_FACTURAR: 'Pte. Facturar',
};

function emptyLineaGeneral() {
  return { descripcion: '', unidades: '', jornadas: '', coste_jornada: '', importe: '' };
}
function emptyLineaPersonal() {
  return { descripcion: '', tarifa: '', jornadas: '', num_pax: '', dieta_tipo: '', dieta: '', num_dietas: '', importe: '', es_especial: false };
}
function emptyLineaLogisticaGeneral() {
  return { descripcion: '', unidades: '', jornadas: '', coste_jornada: '', importe: '' };
}
function emptyLineaLogisticaPersonal() {
  return { descripcion: '', cantidad: '', precio: '', importe: '' };
}

function calcImporteGeneral(l) {
  const unidades = parseFloat(l.unidades) || 0;
  const jornadas = parseFloat(l.jornadas) || 0;
  const coste = parseFloat(l.coste_jornada) || 0;
  if (unidades && jornadas && coste) return (unidades * jornadas * coste).toFixed(2);
  if (l.importe) return l.importe;
  return '';
}

function calcImportePersonal(l) {
  const tarifa = parseFloat(l.tarifa) || 0;
  const jornadas = parseFloat(l.jornadas) || 0;
  const pax = parseFloat(l.num_pax) || 0;
  const dieta = parseFloat(l.dieta) || 0;
  const nDietas = parseFloat(l.num_dietas) || 0;
  if (tarifa && jornadas && pax) return ((tarifa * jornadas * pax) + (dieta * nDietas)).toFixed(2);
  return l.importe || '';
}

function calcImporteLogisticaPersonal(l) {
  const cantidad = parseFloat(l.cantidad) || 0;
  const precio = parseFloat(l.precio) || 0;
  if (cantidad && precio) return (cantidad * precio).toFixed(2);
  return l.importe || '';
}

function fmt(v) {
  if (v == null || v === '') return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);
}

// ─── Fila editable tipo GENERAL ───────────────────────────────────────────────
function LineaGeneral({ linea, onChange, onRemove, onMoveUp, onMoveDown, tarifas = [], listId = '' }) {
  const handleChange = (key, val) => {
    const updated = { ...linea, [key]: val };
    // Auto-rellenar coste cuando se selecciona del catálogo
    if (key === 'descripcion' && tarifas.length) {
      const found = tarifas.find(t => t.label === val);
      if (found && found.coste != null) updated.coste_jornada = found.coste;
    }
    updated.importe = calcImporteGeneral(updated);
    onChange(updated);
  };

  return (
    <tr className="border-b border-gray-100 group">
      <td className="px-2 py-1.5">
        <input
          list={listId}
          className="input text-xs"
          value={linea.descripcion}
          onChange={e => handleChange('descripcion', e.target.value)}
          placeholder="Descripción o seleccionar..."
        />
      </td>
      <td className="px-2 py-1.5 w-16"><input className="input text-xs text-center" type="number" value={linea.unidades} onChange={e => handleChange('unidades', e.target.value)} /></td>
      <td className="px-2 py-1.5 w-20"><input className="input text-xs text-center" type="number" step="0.5" value={linea.jornadas} onChange={e => handleChange('jornadas', e.target.value)} /></td>
      <td className="px-2 py-1.5 w-28"><input className="input text-xs text-right" type="number" value={linea.coste_jornada} onChange={e => handleChange('coste_jornada', e.target.value)} /></td>
      <td className="px-2 py-1.5 w-28"><input className="input text-xs text-right bg-gray-50" type="number" value={linea.importe} onChange={e => handleChange('importe', e.target.value)} /></td>
      <td className="px-2 py-1.5 w-14">
        <div className="opacity-0 group-hover:opacity-100 flex flex-col items-center gap-0.5">
          <button onClick={onMoveUp} className="text-gray-400 hover:text-gray-600 p-0.5"><ChevronUp size={12} /></button>
          <button onClick={onMoveDown} className="text-gray-400 hover:text-gray-600 p-0.5"><ChevronDown size={12} /></button>
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-0.5"><Trash2 size={12} /></button>
        </div>
      </td>
    </tr>
  );
}

// ─── Fila editable tipo PERSONAL ──────────────────────────────────────────────
function LineaPersonal({ linea, onChange, onRemove, onMoveUp, onMoveDown, tarifasPersonas = [], tarifasDietas = [], listPersonasId = '' }) {
  const handleChange = (key, val) => {
    const updated = { ...linea, [key]: val };
    // Auto-rellenar tarifa cuando se selecciona posición
    if (key === 'descripcion' && tarifasPersonas.length) {
      const found = tarifasPersonas.find(t => t.posicion === val);
      if (found) updated.tarifa = found.tarifa_dia;
    }
    // Auto-rellenar importe dieta cuando se selecciona tipo
    if (key === 'dieta_tipo') {
      const found = tarifasDietas.find(t => t.tipo_dieta === val);
      if (found) updated.dieta = found.importe;
    }
    // Auto-calcular nº dietas = jornadas × nº pax
    if (key === 'jornadas' || key === 'num_pax') {
      const j = parseFloat(key === 'jornadas' ? val : linea.jornadas) || 0;
      const p = parseFloat(key === 'num_pax' ? val : linea.num_pax) || 0;
      if (j && p) updated.num_dietas = j * p;
    }
    updated.importe = calcImportePersonal(updated);
    onChange(updated);
  };

  return (
    <tr className="border-b border-gray-100 group">
      <td className="px-2 py-1.5 w-48">
        <input
          list={listPersonasId}
          className="input text-xs w-full"
          value={linea.descripcion}
          onChange={e => handleChange('descripcion', e.target.value)}
          placeholder="Posición / seleccionar..."
        />
      </td>
      <td className="px-2 py-1.5 w-24">
        <input className="input text-xs text-right w-full" type="number" value={linea.tarifa} onChange={e => handleChange('tarifa', e.target.value)} />
      </td>
      <td className="px-2 py-1.5 w-20">
        <input className="input text-xs text-center w-full" type="number" step="0.5" value={linea.jornadas} onChange={e => handleChange('jornadas', e.target.value)} />
      </td>
      <td className="px-2 py-1.5 w-14">
        <input className="input text-xs text-center w-full" type="number" value={linea.num_pax} onChange={e => handleChange('num_pax', e.target.value)} />
      </td>
      <td className="px-2 py-1.5 w-44">
        <div className="flex gap-1 items-center">
          <select
            className="select text-xs flex-1 min-w-0 py-1"
            value={linea.dieta_tipo || ''}
            onChange={e => handleChange('dieta_tipo', e.target.value)}
          >
            <option value="">Sin dieta</option>
            {tarifasDietas.map(t => (
              <option key={t.id} value={t.tipo_dieta}>{t.tipo_dieta}</option>
            ))}
          </select>
          <input
            className="input text-xs text-right w-16"
            type="number"
            value={linea.dieta}
            onChange={e => handleChange('dieta', e.target.value)}
            placeholder="€"
          />
        </div>
      </td>
      <td className="px-2 py-1.5 w-14">
        <input className="input text-xs text-center w-full bg-gray-50" type="number" value={linea.num_dietas} onChange={e => handleChange('num_dietas', e.target.value)} readOnly title="Calculado: jornadas × nº pax" />
      </td>
      <td className="px-2 py-1.5 w-24">
        <input className="input text-xs text-right bg-gray-50 w-full" type="number" value={linea.importe} onChange={e => handleChange('importe', e.target.value)} />
      </td>
      <td className="px-2 py-1.5 w-14">
        <div className="opacity-0 group-hover:opacity-100 flex flex-col items-center gap-0.5">
          <button onClick={onMoveUp} className="text-gray-400 hover:text-gray-600 p-0.5"><ChevronUp size={12} /></button>
          <button onClick={onMoveDown} className="text-gray-400 hover:text-gray-600 p-0.5"><ChevronDown size={12} /></button>
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-0.5"><Trash2 size={12} /></button>
        </div>
      </td>
    </tr>
  );
}

// ─── Fila logística Personal ──────────────────────────────────────────────────
function LineaLogisticaPersonal({ linea, onChange, onRemove, onMoveUp, onMoveDown }) {
  const handleChange = (key, val) => {
    const updated = { ...linea, [key]: val };
    updated.importe = calcImporteLogisticaPersonal(updated);
    onChange(updated);
  };
  return (
    <tr className="border-b border-gray-100 group">
      <td className="px-2 py-1.5 w-1/2"><input className="input text-xs" value={linea.descripcion} onChange={e => handleChange('descripcion', e.target.value)} placeholder="Descripción" /></td>
      <td className="px-2 py-1.5 w-24"><input className="input text-xs text-center" type="number" value={linea.cantidad} onChange={e => handleChange('cantidad', e.target.value)} placeholder="Cantidad" /></td>
      <td className="px-2 py-1.5 w-28"><input className="input text-xs text-right" type="number" value={linea.precio} onChange={e => handleChange('precio', e.target.value)} placeholder="Precio" /></td>
      <td className="px-2 py-1.5 w-28"><input className="input text-xs text-right bg-gray-50" type="number" value={linea.importe} onChange={e => handleChange('importe', e.target.value)} /></td>
      <td className="px-2 py-1.5 w-14">
        <div className="opacity-0 group-hover:opacity-100 flex flex-col items-center gap-0.5">
          <button onClick={onMoveUp} className="text-gray-400 hover:text-gray-600 p-0.5"><ChevronUp size={12} /></button>
          <button onClick={onMoveDown} className="text-gray-400 hover:text-gray-600 p-0.5"><ChevronDown size={12} /></button>
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-0.5"><Trash2 size={12} /></button>
        </div>
      </td>
    </tr>
  );
}

function SectionTable({ title, color = 'red', children, onAdd }) {
  const colors = {
    red: 'bg-red-700 text-white',
    orange: 'bg-orange-500 text-white',
  };
  return (
    <div className="mb-4">
      <div className={`${colors[color]} px-4 py-2 rounded-t-lg flex items-center justify-between`}>
        <span className="font-semibold text-sm">{title}</span>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs opacity-80 hover:opacity-100">
          <Plus size={13} /> Añadir línea
        </button>
      </div>
      {children}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function PresupuestoForm() {
  const { id, tipo: tipoParam } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !id || id === 'nuevo';
  const tipo = tipoParam || 'GENERAL';

  const [form, setForm] = useState({
    tipo, cliente_id: '', contacto_id: '', responsable_id: '',
    departamento: '', tipologia: '', evento: '', competicion: '',
    localizacion: '', fecha_inicio: '', fecha_fin: '',
    status: 'PREPARADO', iva_porcentaje: tipo === 'PERSONAL' ? 0 : 21, notas: '',
  });
  const [lineasEquip, setLineasEquip] = useState([]);
  const [lineasPersGeneral, setLineasPersGeneral] = useState([]);
  const [lineasLogistica, setLineasLogistica] = useState([]);
  const [lineasPersCont, setLineasPersCont] = useState([]);
  const [lineasPersAB, setLineasPersAB] = useState([]);
  const [showSendModal, setShowSendModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailAsunto, setEmailAsunto] = useState('');
  const [emailMensaje, setEmailMensaje] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [templateCargada, setTemplateCargada] = useState(false);

  // Cargar datos maestros
  const { data: clientes = [] } = useQuery({ queryKey: ['clientes'], queryFn: () => api.get('/clientes').then(r => r.data) });
  const { data: responsables = [] } = useQuery({ queryKey: ['responsables'], queryFn: () => api.get('/responsables').then(r => r.data) });
  const { data: tarifasEquipos = [] } = useQuery({ queryKey: ['tarifas-equipos'], queryFn: () => api.get('/tarifas/equipos').then(r => r.data) });
  const { data: tarifasPersonas = [] } = useQuery({ queryKey: ['tarifas-personas'], queryFn: () => api.get('/tarifas/personas').then(r => r.data) });
  const { data: tarifasDietas = [] } = useQuery({ queryKey: ['tarifas-dietas'], queryFn: () => api.get('/tarifas/dietas').then(r => r.data) });

  // Cargar presupuesto existente
  const { data: presupuesto } = useQuery({
    queryKey: ['presupuesto', id],
    queryFn: () => api.get(`/presupuestos/${id}`).then(r => r.data),
    enabled: !isNew && !!id,
  });

  useEffect(() => {
    if (presupuesto) {
      setForm({
        tipo: presupuesto.tipo,
        cliente_id: presupuesto.cliente_id || '',
        contacto_id: presupuesto.contacto_id || '',
        responsable_id: presupuesto.responsable_id || '',
        departamento: presupuesto.departamento || '',
        tipologia: presupuesto.tipologia || '',
        evento: presupuesto.evento || '',
        competicion: presupuesto.competicion || '',
        localizacion: presupuesto.localizacion || '',
        fecha_inicio: presupuesto.fecha_inicio?.slice(0, 10) || '',
        fecha_fin: presupuesto.fecha_fin?.slice(0, 10) || '',
        status: presupuesto.status,
        iva_porcentaje: presupuesto.iva_porcentaje,
        notas: presupuesto.notas || '',
      });
      setLineasEquip(presupuesto.lineas_equipamiento || []);
      setLineasPersGeneral(presupuesto.lineas_personal_general || []);
      setLineasLogistica(presupuesto.lineas_logistica || []);
      setLineasPersCont(presupuesto.lineas_personal_contratado || []);
      setLineasPersAB(presupuesto.lineas_personal_altas_bajas || []);
    }
  }, [presupuesto]);

  // ─── Plantilla automática para presupuestos PERSONAL nuevos ─────────────────
  useEffect(() => {
    if (!isNew || tipo !== 'PERSONAL' || templateCargada || tarifasPersonas.length === 0) return;

    const contratados = tarifasPersonas
      .filter(t => t.categoria === 'CONTRATADO')
      .map(t => ({ ...emptyLineaPersonal(), descripcion: t.posicion, tarifa: t.tarifa_dia || '' }));

    const altasBajas = tarifasPersonas
      .filter(t => t.categoria === 'ALTAS_BAJAS')
      .map(t => ({ ...emptyLineaPersonal(), descripcion: t.posicion, tarifa: t.tarifa_dia || '' }));

    if (contratados.length > 0) setLineasPersCont(contratados);
    if (altasBajas.length > 0) setLineasPersAB(altasBajas);
    setTemplateCargada(true);
  }, [isNew, tipo, tarifasPersonas, templateCargada]);

  const clienteSeleccionado = clientes.find(c => c.id == form.cliente_id);
  const contactos = clienteSeleccionado?.contactos || [];

  // Totales
  const sumLineas = (arr) => arr.reduce((s, l) => s + (parseFloat(l.importe) || 0), 0);
  const totalBruto = form.tipo === 'GENERAL'
    ? sumLineas(lineasEquip) + sumLineas(lineasPersGeneral) + sumLineas(lineasLogistica)
    : sumLineas(lineasPersCont) + sumLineas(lineasPersAB) + sumLineas(lineasLogistica);
  const iva = totalBruto * (parseFloat(form.iva_porcentaje) / 100);
  const total = totalBruto + iva;

  const buildPayload = () => ({
    ...form,
    lineas_equipamiento: lineasEquip,
    lineas_personal_general: lineasPersGeneral,
    lineas_logistica: lineasLogistica,
    lineas_personal_contratado: lineasPersCont,
    lineas_personal_altas_bajas: lineasPersAB,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await api.post('/presupuestos', buildPayload());
        navigate(`/presupuestos/${data.id}`, { replace: true });
      } else {
        await api.put(`/presupuestos/${id}`, buildPayload());
        qc.invalidateQueries(['presupuesto', id]);
      }
      qc.invalidateQueries(['presupuestos']);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (formato) => {
    if (isNew) return;
    const res = await api.get(`/presupuestos/${id}/export/${formato}`, { responseType: 'blob' });
    const ext = formato === 'excel' ? 'xlsx' : 'pdf';
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = `presupuesto_${presupuesto?.numero}.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendEmail = async () => {
    setSendLoading(true);
    try {
      await api.post(`/presupuestos/${id}/send-email`, {
        to: emailTo,
        cc: emailCc || undefined,
        asunto: emailAsunto,
        mensaje: emailMensaje,
        formato: 'pdf',
      });
      setEmailSent(true);
      qc.invalidateQueries(['presupuesto', id]);
      qc.invalidateQueries(['presupuestos']);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar');
    } finally {
      setSendLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (isNew) return;
    await api.patch(`/presupuestos/${id}/status`, { status: newStatus });
    qc.invalidateQueries(['presupuesto', id]);
    qc.invalidateQueries(['presupuestos']);
  };

  const isGeneral = form.tipo === 'GENERAL';

  const updateLinea = (setter, idx, updated) => setter(prev => prev.map((l, i) => i === idx ? updated : l));
  const removeLinea = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));
  const moveLinea = (setter, idx, dir) => setter(prev => {
    const arr = [...prev];
    const to = idx + dir;
    if (to < 0 || to >= arr.length) return arr;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    return arr;
  });

  // Tarifas preparadas para cada sección
  const tarifasEquiposMapped = tarifasEquipos.map(t => ({ label: t.descripcion, coste: t.tarifa_trabajo }));
  const tarifasCamaras = tarifasPersonas.filter(t => t.categoria === 'CAMARAS_ESPECIALES');
  const tarifasCamarasMapped = tarifasCamaras.map(t => ({ label: t.posicion, coste: t.tarifa_dia }));
  const tarifasContratado = tarifasPersonas.filter(t => t.categoria === 'CONTRATADO');
  const tarifasAltasBajas = tarifasPersonas.filter(t => t.categoria === 'ALTAS_BAJAS');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Datalists para autocompletar */}
      <datalist id="equipos-list">
        {tarifasEquipos.map(t => <option key={t.id} value={t.descripcion} />)}
      </datalist>
      <datalist id="personas-camaras-list">
        {tarifasCamaras.map(t => <option key={t.id} value={t.posicion} />)}
      </datalist>
      <datalist id="personas-cont-list">
        {tarifasContratado.map(t => <option key={t.id} value={t.posicion} />)}
      </datalist>
      <datalist id="personas-ab-list">
        {tarifasAltasBajas.map(t => <option key={t.id} value={t.posicion} />)}
      </datalist>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/presupuestos')} className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">
              {isNew
                ? `Nuevo presupuesto — ${isGeneral ? 'General' : 'Personal Valencia'}`
                : `Presupuesto ${presupuesto?.numero}`}
            </h1>
            {!isNew && <StatusBadge status={form.status} />}
          </div>
          {!isNew && (
            <p className="text-sm text-gray-500 mt-0.5">
              {presupuesto?.fecha_presupuesto ? new Date(presupuesto.fecha_presupuesto).toLocaleDateString('es-ES') : ''}
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <div className="relative group">
                <button className="btn-secondary">
                  Status <ChevronDown size={14} />
                </button>
                <div className="absolute right-0 mt-1 w-48 card shadow-lg z-10 py-1 hidden group-hover:block">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${form.status === s ? 'font-semibold text-red-700' : ''}`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => handleExport('excel')} className="btn-secondary">
                <Download size={14} /> Excel
              </button>
              <button onClick={() => handleExport('pdf')} className="btn-secondary">
                <Download size={14} /> PDF
              </button>
              <button onClick={() => {
                setEmailTo(clienteSeleccionado?.contactos?.[0]?.email || '');
                setEmailCc('');
                setEmailAsunto(`Presupuesto ${form.evento || presupuesto?.numero || ''}`);
                setEmailMensaje('');
                setEmailSent(false);
                setShowSendModal(true);
              }} className="btn-secondary">
                <Send size={14} /> Enviar
              </button>
            </>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Cabecera presupuesto */}
        <div className="lg:col-span-2 card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Datos del presupuesto</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cliente *</label>
              <select className="select" value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value, contacto_id: '' }))}>
                <option value="">Seleccionar cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{isGeneral ? 'Solicitado por' : 'Petición'}</label>
              <select className="select" value={form.contacto_id} onChange={e => setForm(f => ({ ...f, contacto_id: e.target.value }))} disabled={!contactos.length}>
                <option value="">Seleccionar contacto</option>
                {contactos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Responsable</label>
              <select className="select" value={form.responsable_id} onChange={e => setForm(f => ({ ...f, responsable_id: e.target.value }))}>
                <option value="">Seleccionar responsable</option>
                {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Departamento</label>
              <select className="select" value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))}>
                <option value="">Seleccionar</option>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipología</label>
              <select className="select" value={form.tipologia} onChange={e => setForm(f => ({ ...f, tipologia: e.target.value }))}>
                <option value="">Seleccionar</option>
                {TIPOLOGIAS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">IVA (%)</label>
              <input className="input" type="number" value={form.iva_porcentaje} onChange={e => setForm(f => ({ ...f, iva_porcentaje: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Evento / Proyecto</label>
            <input className="input" value={form.evento} onChange={e => setForm(f => ({ ...f, evento: e.target.value }))} />
          </div>

          {!isGeneral && (
            <div>
              <label className="label">Competición</label>
              <input className="input" value={form.competicion} onChange={e => setForm(f => ({ ...f, competicion: e.target.value }))} />
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Localización</label>
              <input className="input" value={form.localizacion} onChange={e => setForm(f => ({ ...f, localizacion: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha inicio</label>
              <input className="input" type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fecha fin</label>
              <input className="input" type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
        </div>

        {/* Totales */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Resumen</h2>
          {isGeneral ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Equipamiento</span><span>{fmt(sumLineas(lineasEquip))}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Personal Cámaras Esp.</span><span>{fmt(sumLineas(lineasPersGeneral))}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Logística</span><span>{fmt(sumLineas(lineasLogistica))}</span></div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Personal contratado</span><span>{fmt(sumLineas(lineasPersCont))}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Altas / Bajas</span><span>{fmt(sumLineas(lineasPersAB))}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Logística</span><span>{fmt(sumLineas(lineasLogistica))}</span></div>
            </div>
          )}
          <div className="border-t pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total bruto</span><span className="font-medium">{fmt(totalBruto)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">IVA ({form.iva_porcentaje}%)</span><span>{fmt(iva)}</span></div>
            <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span className="text-red-700">{fmt(total)}</span></div>
          </div>
        </div>
      </div>

      {/* Líneas del presupuesto */}
      <div className="card overflow-hidden mb-4">
        <div className={`px-6 py-3 border-b border-gray-100 ${isGeneral ? 'bg-red-700' : 'bg-orange-500'}`}>
          <h2 className="font-bold text-white text-sm">
            {isGeneral ? 'Presupuesto General' : 'Presupuesto Personal Valencia'}
          </h2>
        </div>
        <div className="p-4 overflow-x-auto">

          {isGeneral ? (
            <>
              {/* EQUIPAMIENTO */}
              <SectionTable title="EQUIPAMIENTO" color="red" onAdd={() => setLineasEquip(p => [...p, emptyLineaGeneral()])}>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-2 py-2 text-left text-gray-500">Descripción</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-16">UNID.</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-20">JORN.</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-28">COSTE JORN.</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-28">IMPORTE</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody>
                    {lineasEquip.map((l, i) => (
                      <LineaGeneral key={i} linea={l}
                        onChange={u => updateLinea(setLineasEquip, i, u)}
                        onRemove={() => removeLinea(setLineasEquip, i)}
                        onMoveUp={() => moveLinea(setLineasEquip, i, -1)}
                        onMoveDown={() => moveLinea(setLineasEquip, i, 1)}
                        tarifas={tarifasEquiposMapped}
                        listId="equipos-list"
                      />
                    ))}
                    {!lineasEquip.length && <tr><td colSpan={7} className="text-center text-gray-400 py-4 text-xs">Sin líneas — pulsa "Añadir línea"</td></tr>}
                  </tbody>
                </table>
              </SectionTable>

              {/* PERSONAL CÁMARAS ESPECIALES */}
              <SectionTable title="PERSONAL CÁMARAS ESPECIALES" color="red" onAdd={() => setLineasPersGeneral(p => [...p, emptyLineaGeneral()])}>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-2 py-2 text-left text-gray-500">Posición / Descripción</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-16">UNID.</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-20">JORN.</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-28">TARIFA</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-28">IMPORTE</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody>
                    {lineasPersGeneral.map((l, i) => (
                      <LineaGeneral key={i} linea={l}
                        onChange={u => updateLinea(setLineasPersGeneral, i, u)}
                        onRemove={() => removeLinea(setLineasPersGeneral, i)}
                        onMoveUp={() => moveLinea(setLineasPersGeneral, i, -1)}
                        onMoveDown={() => moveLinea(setLineasPersGeneral, i, 1)}
                        tarifas={tarifasCamarasMapped}
                        listId="personas-camaras-list"
                      />
                    ))}
                    {!lineasPersGeneral.length && <tr><td colSpan={7} className="text-center text-gray-400 py-4 text-xs">Sin líneas — pulsa "Añadir línea"</td></tr>}
                  </tbody>
                </table>
              </SectionTable>

              {/* LOGÍSTICA GENERAL */}
              <SectionTable title="LOGÍSTICA" color="red" onAdd={() => setLineasLogistica(p => [...p, emptyLineaLogisticaGeneral()])}>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-2 py-2 text-left text-gray-500">Descripción</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-16">UNID.</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-20">JORN.</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-28">PRECIO</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-28">IMPORTE</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody>
                    {lineasLogistica.map((l, i) => (
                      <LineaGeneral key={i} linea={l}
                        onChange={u => updateLinea(setLineasLogistica, i, u)}
                        onRemove={() => removeLinea(setLineasLogistica, i)}
                        onMoveUp={() => moveLinea(setLineasLogistica, i, -1)}
                        onMoveDown={() => moveLinea(setLineasLogistica, i, 1)}
                      />
                    ))}
                    {!lineasLogistica.length && <tr><td colSpan={7} className="text-center text-gray-400 py-4 text-xs">Sin líneas — pulsa "Añadir línea"</td></tr>}
                  </tbody>
                </table>
              </SectionTable>
            </>
          ) : (
            <>
              {/* PERSONAL CONTRATADO */}
              <SectionTable title="PERSONAL CONTRATADO" color="orange" onAdd={() => setLineasPersCont(p => [...p, emptyLineaPersonal()])}>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-2 py-2 text-left text-gray-500 w-48">Posición / Descripción</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-24">Tarifa</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-20">Jorn.</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-14">Nº PAX</th>
                    <th className="px-2 py-2 text-left text-gray-500 w-44">Dieta</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-14">NºDieta</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-24">Importe</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody>
                    {lineasPersCont.map((l, i) => (
                      <LineaPersonal key={i} linea={l}
                        onChange={u => updateLinea(setLineasPersCont, i, u)}
                        onRemove={() => removeLinea(setLineasPersCont, i)}
                        onMoveUp={() => moveLinea(setLineasPersCont, i, -1)}
                        onMoveDown={() => moveLinea(setLineasPersCont, i, 1)}
                        tarifasPersonas={tarifasContratado}
                        tarifasDietas={tarifasDietas}
                        listPersonasId="personas-cont-list"
                      />
                    ))}
                    {!lineasPersCont.length && <tr><td colSpan={8} className="text-center text-gray-400 py-4 text-xs">Sin líneas — pulsa "Añadir línea"</td></tr>}
                  </tbody>
                </table>
              </SectionTable>

              {/* PERSONAL ALTAS/BAJAS */}
              <SectionTable title="PERSONAL ALTAS / BAJAS" color="orange" onAdd={() => setLineasPersAB(p => [...p, emptyLineaPersonal()])}>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-2 py-2 text-left text-gray-500 w-48">Posición / Descripción</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-24">Tarifa</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-20">Jorn.</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-14">Nº PAX</th>
                    <th className="px-2 py-2 text-left text-gray-500 w-44">Dieta</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-14">NºDieta</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-24">Importe</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody>
                    {lineasPersAB.map((l, i) => (
                      <LineaPersonal key={i} linea={l}
                        onChange={u => updateLinea(setLineasPersAB, i, u)}
                        onRemove={() => removeLinea(setLineasPersAB, i)}
                        onMoveUp={() => moveLinea(setLineasPersAB, i, -1)}
                        onMoveDown={() => moveLinea(setLineasPersAB, i, 1)}
                        tarifasPersonas={tarifasAltasBajas}
                        tarifasDietas={tarifasDietas}
                        listPersonasId="personas-ab-list"
                      />
                    ))}
                    {!lineasPersAB.length && <tr><td colSpan={8} className="text-center text-gray-400 py-4 text-xs">Sin líneas — pulsa "Añadir línea"</td></tr>}
                  </tbody>
                </table>
              </SectionTable>

              {/* LOGÍSTICA PERSONAL */}
              <SectionTable title="LOGÍSTICA" color="orange" onAdd={() => setLineasLogistica(p => [...p, emptyLineaLogisticaPersonal()])}>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-2 py-2 text-left text-gray-500 w-1/2">Descripción</th>
                    <th className="px-2 py-2 text-center text-gray-500 w-24">Cantidad</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-28">Precio</th>
                    <th className="px-2 py-2 text-right text-gray-500 w-28">Importe</th>
                    <th className="w-8" />
                  </tr></thead>
                  <tbody>
                    {lineasLogistica.map((l, i) => (
                      <LineaLogisticaPersonal key={i} linea={l}
                        onChange={u => updateLinea(setLineasLogistica, i, u)}
                        onRemove={() => removeLinea(setLineasLogistica, i)}
                        onMoveUp={() => moveLinea(setLineasLogistica, i, -1)}
                        onMoveDown={() => moveLinea(setLineasLogistica, i, 1)}
                      />
                    ))}
                    {!lineasLogistica.length && <tr><td colSpan={5} className="text-center text-gray-400 py-4 text-xs">Sin líneas — pulsa "Añadir línea"</td></tr>}
                  </tbody>
                </table>
              </SectionTable>
            </>
          )}
        </div>
      </div>

      {/* Modal envío email */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4">
            {emailSent ? (
              /* ── Estado enviado ── */
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <Send size={22} className="text-green-600" />
                </div>
                <p className="font-semibold text-gray-900">Email enviado correctamente</p>
                <p className="text-sm text-gray-500">El presupuesto se ha enviado a <strong>{emailTo}</strong></p>
                <button className="btn-primary mt-2" onClick={() => setShowSendModal(false)}>Cerrar</button>
              </div>
            ) : (
              /* ── Formulario ── */
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Enviar presupuesto por email</h2>
                  <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div>
                  <label className="label">Para *</label>
                  <input
                    className="input"
                    type="email"
                    value={emailTo}
                    onChange={e => setEmailTo(e.target.value)}
                    placeholder="destinatario@empresa.com"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="label">CC <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    className="input"
                    type="email"
                    value={emailCc}
                    onChange={e => setEmailCc(e.target.value)}
                    placeholder="copia@empresa.com"
                  />
                </div>

                <div>
                  <label className="label">Asunto *</label>
                  <input
                    className="input"
                    type="text"
                    value={emailAsunto}
                    onChange={e => setEmailAsunto(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Mensaje</label>
                  <textarea
                    className="input"
                    rows={6}
                    value={emailMensaje}
                    onChange={e => setEmailMensaje(e.target.value)}
                    placeholder="Escribe el mensaje aquí..."
                  />
                </div>

                {/* Indicador adjunto */}
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <Download size={13} className="text-gray-400 shrink-0" />
                  <span>Se adjuntará el PDF del presupuesto <strong>{presupuesto?.numero}</strong></span>
                </div>

                <div className="flex gap-3 justify-end pt-1">
                  <button className="btn-secondary" onClick={() => setShowSendModal(false)}>Cancelar</button>
                  <button
                    className="btn-primary"
                    onClick={handleSendEmail}
                    disabled={sendLoading || !emailTo || !emailAsunto}
                  >
                    <Send size={14} />
                    {sendLoading ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
