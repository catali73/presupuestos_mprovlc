/**
 * Formatters de moneda — modo europeo garantizado:
 *   separador miles  → punto   (.)
 *   separador decimal → coma   (,)
 *   símbolo           → €
 *
 * Usamos regex sobre el valor absoluto para evitar el bug de Intl.NumberFormat
 * en algunos entornos que no añade el separador de miles en números de 4 dígitos.
 */

function _fmtNum(abs, decimals) {
  const [intPart, decPart] = abs.toFixed(decimals).split('.');
  const intFmt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? `${intFmt},${decPart}` : intFmt;
}

/**
 * Formato completo con 2 decimales: "1.234,56 €"
 * Para valores nulos/vacíos devuelve "—" (o "" si se pasa fallback='')
 */
export function fmtEUR(v, fallback = '—') {
  if (v == null || v === '') return fallback;
  const num = parseFloat(v);
  if (isNaN(num)) return fallback;
  const neg = num < 0;
  return `${neg ? '-' : ''}${_fmtNum(Math.abs(num), 2)} €`;
}

/**
 * Formato sin decimales: "1.234 €"
 */
export function fmtEUR0(v, fallback = '—') {
  if (v == null || isNaN(parseFloat(v))) return fallback;
  const num = parseFloat(v);
  const neg = num < 0;
  return `${neg ? '-' : ''}${_fmtNum(Math.abs(num), 0)} €`;
}

/**
 * Formato compacto para espacios reducidos:
 *   < 10.000        → "1.234 €"  (muestra el punto de miles)
 *   10.000–999.999  → "45 k€"
 *   ≥ 1.000.000     → "1,3 M€"
 */
export function fmtK(v, fallback = '—') {
  if (v == null || v === '') return fallback;
  const num = parseFloat(v);
  if (isNaN(num)) return fallback;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = (abs / 1_000_000).toFixed(1).replace('.', ',');
    return `${sign}${m} M€`;
  }
  if (abs >= 10_000) {
    const k = Math.round(abs / 1_000);
    return `${sign}${k} k€`;
  }
  return fmtEUR0(num, fallback);
}
