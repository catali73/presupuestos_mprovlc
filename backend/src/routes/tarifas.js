const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

// ─── TARIFAS EQUIPOS ─────────────────────────────────────────────────────────

router.get('/equipos', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM tarifas_equipos WHERE activo=true ORDER BY descripcion'
  );
  res.json(rows);
});

router.post('/equipos', auth, async (req, res) => {
  const { descripcion, tarifa_montaje, tarifa_trabajo } = req.body;
  if (!descripcion) return res.status(400).json({ error: 'Descripción obligatoria' });
  const { rows } = await pool.query(
    `INSERT INTO tarifas_equipos (descripcion, tarifa_montaje, tarifa_trabajo)
     VALUES ($1,$2,$3) RETURNING *`,
    [descripcion, tarifa_montaje || null, tarifa_trabajo || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/equipos/:id', auth, async (req, res) => {
  const { descripcion, tarifa_montaje, tarifa_trabajo, activo } = req.body;
  const { rows } = await pool.query(
    `UPDATE tarifas_equipos SET descripcion=$1, tarifa_montaje=$2, tarifa_trabajo=$3, activo=$4
     WHERE id=$5 RETURNING *`,
    [descripcion, tarifa_montaje || null, tarifa_trabajo || null, activo ?? true, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
  res.json(rows[0]);
});

router.delete('/equipos/:id', auth, async (req, res) => {
  await pool.query('UPDATE tarifas_equipos SET activo=false WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── TARIFA PERSONAS ─────────────────────────────────────────────────────────

router.get('/personas', auth, async (req, res) => {
  const { categoria } = req.query;
  let query = 'SELECT * FROM tarifa_personas WHERE activo=true';
  const params = [];
  if (categoria) {
    params.push(categoria);
    query += ` AND categoria=$${params.length}`;
  }
  query += ' ORDER BY categoria, posicion';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

router.post('/personas', auth, async (req, res) => {
  const { posicion, tarifa_dia, categoria = 'CONTRATADO' } = req.body;
  if (!posicion || tarifa_dia == null) {
    return res.status(400).json({ error: 'Posición y tarifa_dia son obligatorios' });
  }
  const { rows } = await pool.query(
    'INSERT INTO tarifa_personas (posicion, tarifa_dia, categoria) VALUES ($1,$2,$3) RETURNING *',
    [posicion, tarifa_dia, categoria]
  );
  res.status(201).json(rows[0]);
});

router.put('/personas/:id', auth, async (req, res) => {
  const { posicion, tarifa_dia, categoria, activo } = req.body;
  const { rows } = await pool.query(
    `UPDATE tarifa_personas
     SET posicion=$1, tarifa_dia=$2, categoria=$3, activo=$4
     WHERE id=$5 RETURNING *`,
    [posicion, tarifa_dia, categoria || 'CONTRATADO', activo ?? true, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
  res.json(rows[0]);
});

router.delete('/personas/:id', auth, async (req, res) => {
  await pool.query('UPDATE tarifa_personas SET activo=false WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ─── TARIFA DIETAS ───────────────────────────────────────────────────────────

router.get('/dietas', auth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM tarifa_dietas WHERE activo=true ORDER BY tipo_dieta'
  );
  res.json(rows);
});

router.post('/dietas', auth, async (req, res) => {
  const { tipo_dieta, importe } = req.body;
  if (!tipo_dieta || importe == null) {
    return res.status(400).json({ error: 'Tipo y importe son obligatorios' });
  }
  const { rows } = await pool.query(
    'INSERT INTO tarifa_dietas (tipo_dieta, importe) VALUES ($1,$2) RETURNING *',
    [tipo_dieta, importe]
  );
  res.status(201).json(rows[0]);
});

router.put('/dietas/:id', auth, async (req, res) => {
  const { tipo_dieta, importe, activo } = req.body;
  const { rows } = await pool.query(
    'UPDATE tarifa_dietas SET tipo_dieta=$1, importe=$2, activo=$3 WHERE id=$4 RETURNING *',
    [tipo_dieta, importe, activo ?? true, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
  res.json(rows[0]);
});

router.delete('/dietas/:id', auth, async (req, res) => {
  await pool.query('UPDATE tarifa_dietas SET activo=false WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
