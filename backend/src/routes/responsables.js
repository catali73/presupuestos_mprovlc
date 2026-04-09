const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const auth = require('../middleware/auth');

// GET /api/responsables
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, telefono, email, activo, created_at FROM responsables ORDER BY nombre'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/responsables
router.post('/', auth, async (req, res) => {
  const { nombre, telefono, email, password } = req.body;
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
  }
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO responsables (nombre, telefono, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, telefono, email, activo, created_at`,
      [nombre, telefono || null, email.toLowerCase(), password_hash]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya existe' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/responsables/:id
router.put('/:id', auth, async (req, res) => {
  const { nombre, telefono, email, password, activo } = req.body;
  try {
    let query, params;
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      query = `UPDATE responsables SET nombre=$1, telefono=$2, email=$3, password_hash=$4, activo=$5
               WHERE id=$6 RETURNING id, nombre, telefono, email, activo`;
      params = [nombre, telefono || null, email.toLowerCase(), password_hash, activo ?? true, req.params.id];
    } else {
      query = `UPDATE responsables SET nombre=$1, telefono=$2, email=$3, activo=$4
               WHERE id=$5 RETURNING id, nombre, telefono, email, activo`;
      params = [nombre, telefono || null, email.toLowerCase(), activo ?? true, req.params.id];
    }
    const { rows } = await pool.query(query, params);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya existe' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/responsables/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('UPDATE responsables SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
