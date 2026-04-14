const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

// GET /api/dashboard
// Query params opcionales: responsable_id, departamento, year, month
router.get('/', auth, async (req, res) => {
  const { responsable_id, departamento, year, month } = req.query;
  const conditions = [];
  const params = [];

  if (responsable_id) { params.push(responsable_id); conditions.push(`responsable_id = $${params.length}`); }
  if (departamento) { params.push(departamento); conditions.push(`departamento = $${params.length}`); }
  if (year) {
    params.push(year);
    conditions.push(`EXTRACT(YEAR FROM fecha_presupuesto) = $${params.length}`);
  }
  if (month) {
    params.push(month);
    conditions.push(`EXTRACT(MONTH FROM fecha_presupuesto) = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // Stack por status
    const { rows: stack } = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM presupuestos ${where}
      GROUP BY status
      ORDER BY status
    `, params);

    // Totales importe por status — subconsultas por tabla para evitar producto cartesiano
    const { rows: importes } = await pool.query(`
      SELECT
        p.status,
        ROUND(SUM(
          COALESCE((SELECT SUM(importe) FROM lineas_equipamiento        WHERE presupuesto_id = p.id), 0) +
          COALESCE((SELECT SUM(importe) FROM lineas_personal_general    WHERE presupuesto_id = p.id), 0) +
          COALESCE((SELECT SUM(importe) FROM lineas_logistica           WHERE presupuesto_id = p.id), 0) +
          COALESCE((SELECT SUM(importe) FROM lineas_personal_contratado WHERE presupuesto_id = p.id), 0) +
          COALESCE((SELECT SUM(importe) FROM lineas_personal_altas_bajas WHERE presupuesto_id = p.id), 0)
        ), 2) AS total_bruto
      FROM presupuestos p
      ${where}
      GROUP BY p.status
    `, params);

    // Por departamento
    const { rows: porDepartamento } = await pool.query(`
      SELECT departamento, status, COUNT(*) AS count
      FROM presupuestos ${where}
      GROUP BY departamento, status
      ORDER BY departamento, status
    `, params);

    // Últimos 12 meses — presupuestos creados
    const { rows: porMes } = await pool.query(`
      SELECT
        TO_CHAR(fecha_presupuesto, 'YYYY-MM') AS mes,
        COUNT(*) AS count
      FROM presupuestos
      WHERE fecha_presupuesto >= NOW() - INTERVAL '12 months'
      GROUP BY mes
      ORDER BY mes
    `);

    // Pendientes de facturar
    const { rows: pendientes } = await pool.query(`
      SELECT p.id, p.numero, p.evento, p.fecha_fin, c.nombre AS cliente
      FROM presupuestos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      WHERE p.status = 'PENDIENTE_FACTURAR'
      ORDER BY p.fecha_fin
      LIMIT 10
    `);

    res.json({ stack, importes, porDepartamento, porMes, pendientes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
