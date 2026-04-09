const config = {
  PREPARADO:          { label: 'Preparado',           cls: 'bg-gray-100 text-gray-700' },
  ENVIADO:            { label: 'Enviado',              cls: 'bg-blue-100 text-blue-700' },
  APROBADO:           { label: 'Aprobado',             cls: 'bg-green-100 text-green-700' },
  DESCARTADO:         { label: 'Descartado',           cls: 'bg-gray-200 text-gray-500' },
  FACTURADO:          { label: 'Facturado',            cls: 'bg-purple-100 text-purple-700' },
  PENDIENTE_FACTURAR: { label: 'Pendiente facturar',  cls: 'bg-orange-100 text-orange-700' },
};

export default function StatusBadge({ status }) {
  const { label, cls } = config[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`badge ${cls}`}>{label}</span>;
}
