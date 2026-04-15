const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

// GET /api/tipologias
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tipologias ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tipologias
router.post('/', auth, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO tipologias (nombre) VALUES ($1) RETURNING *',
      [nombre.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una tipología con ese nombre' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tipologias/:id
router.put('/:id', auth, async (req, res) => {
  const { nombre, activo } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE tipologias SET nombre=$1, activo=$2 WHERE id=$3 RETURNING *',
      [nombre?.trim(), activo ?? true, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe una tipología con ese nombre' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tipologias/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM tipologias WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
