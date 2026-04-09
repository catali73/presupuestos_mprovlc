const pool = require('../config/database');

/**
 * Genera el siguiente número de presupuesto con formato YYYYMMDDXXX
 * Ejemplo: 2026040900001
 */
async function generarNumeroPresupuesto() {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  const prefijo = `${yyyy}${mm}${dd}`;

  const { rows } = await pool.query(
    `SELECT numero FROM presupuestos WHERE numero LIKE $1 ORDER BY numero DESC LIMIT 1`,
    [`${prefijo}%`]
  );

  let siguiente = 1;
  if (rows.length) {
    const ultimoSufijo = parseInt(rows[0].numero.slice(8), 10);
    siguiente = ultimoSufijo + 1;
  }

  return `${prefijo}${String(siguiente).padStart(3, '0')}`;
}

module.exports = generarNumeroPresupuesto;
