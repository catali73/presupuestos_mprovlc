const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');

// GET /api/clientes
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
        COALESCE(json_agg(cc ORDER BY cc.id) FILTER (WHERE cc.id IS NOT NULL), '[]') AS contactos
      FROM clientes c
      LEFT JOIN contactos_cliente cc ON cc.cliente_id = c.id
      WHERE c.activo = true
      GROUP BY c.id
      ORDER BY c.nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clientes/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
        COALESCE(json_agg(cc ORDER BY cc.id) FILTER (WHERE cc.id IS NOT NULL), '[]') AS contactos
      FROM clientes c
      LEFT JOIN contactos_cliente cc ON cc.cliente_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clientes
router.post('/', auth, async (req, res) => {
  const { nombre, razon_social, cif, direccion, tipologia, contactos = [] } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO clientes (nombre, razon_social, cif, direccion, tipologia)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, razon_social || null, cif || null, direccion || null, tipologia || null]
    );
    const newCliente = rows[0];

    for (const c of contactos) {
      await client.query(
        `INSERT INTO contactos_cliente (cliente_id, nombre, telefono, email) VALUES ($1,$2,$3,$4)`,
        [newCliente.id, c.nombre, c.telefono || null, c.email || null]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(await getClienteConContactos(newCliente.id));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/clientes/:id
router.put('/:id', auth, async (req, res) => {
  const { nombre, razon_social, cif, direccion, tipologia, activo, contactos } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE clientes SET nombre=$1, razon_social=$2, cif=$3, direccion=$4, tipologia=$5, activo=$6
       WHERE id=$7`,
      [nombre, razon_social || null, cif || null, direccion || null, tipologia || null, activo ?? true, req.params.id]
    );

    if (Array.isArray(contactos)) {
      // Sincronizar contactos: borrar los que no vienen y actualizar/insertar los que sí
      const ids = contactos.filter(c => c.id).map(c => c.id);
      if (ids.length) {
        await client.query(
          `DELETE FROM contactos_cliente WHERE cliente_id=$1 AND id NOT IN (${ids.map((_, i) => `$${i + 2}`).join(',')})`,
          [req.params.id, ...ids]
        );
      } else {
        await client.query('DELETE FROM contactos_cliente WHERE cliente_id=$1', [req.params.id]);
      }

      for (const c of contactos) {
        if (c.id) {
          await client.query(
            `UPDATE contactos_cliente SET nombre=$1, telefono=$2, email=$3 WHERE id=$4`,
            [c.nombre, c.telefono || null, c.email || null, c.id]
          );
        } else {
          await client.query(
            `INSERT INTO contactos_cliente (cliente_id, nombre, telefono, email) VALUES ($1,$2,$3,$4)`,
            [req.params.id, c.nombre, c.telefono || null, c.email || null]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json(await getClienteConContactos(req.params.id));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/clientes/:id  (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('UPDATE clientes SET activo=false WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getClienteConContactos(id) {
  const { rows } = await pool.query(`
    SELECT c.*,
      COALESCE(json_agg(cc ORDER BY cc.id) FILTER (WHERE cc.id IS NOT NULL), '[]') AS contactos
    FROM clientes c
    LEFT JOIN contactos_cliente cc ON cc.cliente_id = c.id
    WHERE c.id = $1
    GROUP BY c.id
  `, [id]);
  return rows[0];
}

module.exports = router;
