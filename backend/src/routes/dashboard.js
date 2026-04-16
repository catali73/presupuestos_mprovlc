const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

// Subquery reutilizable para total bruto de un presupuesto
const totalBrutoSQ = `(
  COALESCE((SELECT SUM(importe) FROM lineas_equipamiento        WHERE presupuesto_id = p.id), 0) +
  COALESCE((SELECT SUM(importe) FROM lineas_personal_general    WHERE presupuesto_id = p.id), 0) +
  COALESCE((SELECT SUM(importe) FROM lineas_logistica           WHERE presupuesto_id = p.id), 0) +
  COALESCE((SELECT SUM(importe) FROM lineas_personal_contratado WHERE presupuesto_id = p.id), 0) +
  COALESCE((SELECT SUM(importe) FROM lineas_personal_altas_bajas WHERE presupuesto_id = p.id), 0)
)`;

// GET /api/dashboard
router.get('/', auth, async (req, res) => {
  const yearActual = new Date().getFullYear();

  try {
    // ── 1. Stack por status (todo el histórico) ───────────────────────────
    const { rows: stack } = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM presupuestos
      GROUP BY status
      ORDER BY status
    `);

    // ── 2. Importes por status ────────────────────────────────────────────
    const { rows: importes } = await pool.query(`
      SELECT
        p.status,
        ROUND(SUM(${totalBrutoSQ}), 2) AS total_bruto
      FROM presupuestos p
      GROUP BY p.status
    `);

    // ── 3. Facturación mensual — últimos 12 meses (count + importe) ───────
    const { rows: porMes } = await pool.query(`
      SELECT
        TO_CHAR(p.fecha_presupuesto, 'YYYY-MM') AS mes,
        COUNT(*) AS count,
        ROUND(SUM(${totalBrutoSQ}), 2) AS importe
      FROM presupuestos p
      WHERE p.fecha_presupuesto >= NOW() - INTERVAL '12 months'
      GROUP BY mes
      ORDER BY mes
    `);

    // ── 4. Por departamento — año actual ──────────────────────────────────
    const { rows: porDepartamento } = await pool.query(`
      SELECT
        COALESCE(p.departamento, 'Sin asignar') AS departamento,
        COUNT(*) AS count,
        ROUND(SUM(${totalBrutoSQ}), 2) AS importe,
        ROUND(AVG(${totalBrutoSQ}), 2) AS media
      FROM presupuestos p
      WHERE EXTRACT(YEAR FROM p.fecha_presupuesto) = $1
      GROUP BY p.departamento
      ORDER BY importe DESC NULLS LAST
    `, [yearActual]);

    // ── 5. Por tipología — año actual ─────────────────────────────────────
    const { rows: porTipologia } = await pool.query(`
      SELECT
        COALESCE(p.tipologia, 'Sin tipología') AS tipologia,
        COUNT(*) AS count,
        ROUND(SUM(${totalBrutoSQ}), 2) AS importe,
        ROUND(AVG(${totalBrutoSQ}), 2) AS media
      FROM presupuestos p
      WHERE EXTRACT(YEAR FROM p.fecha_presupuesto) = $1
      GROUP BY p.tipologia
      ORDER BY importe DESC NULLS LAST
    `, [yearActual]);

    // ── 6. Pendientes de facturar ─────────────────────────────────────────
    const { rows: pendientes } = await pool.query(`
      SELECT p.id, p.numero, p.evento, p.fecha_fin, c.nombre AS cliente
      FROM presupuestos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      WHERE p.status = 'PENDIENTE_FACTURAR'
      ORDER BY p.fecha_fin
      LIMIT 10
    `);

    res.json({ stack, importes, porMes, porDepartamento, porTipologia, pendientes, yearActual });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
