const router = require('express').Router();
const pool = require('../config/database');
const auth = require('../middleware/auth');
const generarNumero = require('../utils/numeroPresupuesto');
const { exportExcel, exportPdf } = require('../utils/exportService');
const emailService = require('../utils/emailService');

// ─── LISTADO con filtros ──────────────────────────────────────────────────────
// GET /api/presupuestos?status=&departamento=&tipo=&search=&anyo=&trimestre=&mes=&page=&limit=
router.get('/', auth, async (req, res) => {
  const { status, responsable_id, departamento, tipo, search, anyo, trimestre, mes, page = 1, limit = 50 } = req.query;
  const conditions = [];
  const params = [];

  if (status)         { params.push(status);        conditions.push(`p.status = $${params.length}`); }
  if (responsable_id) { params.push(responsable_id); conditions.push(`p.responsable_id = $${params.length}`); }
  if (departamento)   { params.push(departamento);   conditions.push(`p.departamento = $${params.length}`); }
  if (tipo)           { params.push(tipo);           conditions.push(`p.tipo = $${params.length}`); }
  if (anyo)           { params.push(parseInt(anyo)); conditions.push(`EXTRACT(YEAR FROM p.fecha_presupuesto) = $${params.length}`); }
  if (trimestre)      { params.push(parseInt(trimestre)); conditions.push(`EXTRACT(QUARTER FROM p.fecha_presupuesto) = $${params.length}`); }
  if (mes)            { params.push(parseInt(mes));  conditions.push(`EXTRACT(MONTH FROM p.fecha_presupuesto) = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.evento ILIKE $${params.length} OR p.numero ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Subquery para calcular total_bruto de cada presupuesto sumando todas las tablas de líneas
  const totalBrutoSQ = `(
    COALESCE((SELECT SUM(importe) FROM lineas_equipamiento      WHERE presupuesto_id = p.id), 0) +
    COALESCE((SELECT SUM(importe) FROM lineas_personal_general  WHERE presupuesto_id = p.id), 0) +
    COALESCE((SELECT SUM(importe) FROM lineas_personal_contratado WHERE presupuesto_id = p.id), 0) +
    COALESCE((SELECT SUM(importe) FROM lineas_personal_altas_bajas WHERE presupuesto_id = p.id), 0) +
    COALESCE((SELECT SUM(importe) FROM lineas_logistica         WHERE presupuesto_id = p.id), 0)
  )`;

  try {
    const { rows } = await pool.query(`
      SELECT
        p.id, p.numero, p.fecha_presupuesto, p.tipo, p.status,
        p.departamento, p.tipologia, p.evento, p.localizacion,
        p.fecha_inicio, p.fecha_fin, p.iva_porcentaje, p.created_at,
        c.nombre AS cliente_nombre,
        r.nombre AS responsable_nombre,
        cc.nombre AS contacto_nombre,
        ${totalBrutoSQ} AS total_bruto
      FROM presupuestos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN responsables r ON r.id = p.responsable_id
      LEFT JOIN contactos_cliente cc ON cc.id = p.contacto_id
      ${where}
      ORDER BY p.fecha_presupuesto DESC, p.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, parseInt(limit), offset]);

    const { rows: aggRows } = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(${totalBrutoSQ}), 0) AS importe_total
       FROM presupuestos p
       LEFT JOIN clientes c ON c.id = p.cliente_id
       ${where}`,
      params
    );

    res.json({
      data: rows,
      total: parseInt(aggRows[0].count),
      importe_total: parseFloat(aggRows[0].importe_total),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DETALLE COMPLETO ─────────────────────────────────────────────────────────
// GET /api/presupuestos/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const presupuesto = await getPresupuestoCompleto(req.params.id);
    if (!presupuesto) return res.status(404).json({ error: 'No encontrado' });
    res.json(presupuesto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CREAR ────────────────────────────────────────────────────────────────────
// POST /api/presupuestos
router.post('/', auth, async (req, res) => {
  const {
    tipo, cliente_id, contacto_id, responsable_id,
    departamento, tipologia, evento, competicion, localizacion,
    fecha_inicio, fecha_fin, iva_porcentaje = 21, notas,
    lineas_equipamiento = [], lineas_personal_general = [], lineas_logistica = [],
    lineas_personal_contratado = [], lineas_personal_altas_bajas = [],
  } = req.body;

  if (!tipo || !['GENERAL', 'PERSONAL'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo debe ser GENERAL o PERSONAL' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const numero = await generarNumero();

    const { rows } = await client.query(`
      INSERT INTO presupuestos
        (numero, tipo, cliente_id, contacto_id, responsable_id, departamento, tipologia,
         evento, competicion, localizacion, fecha_inicio, fecha_fin, iva_porcentaje, notas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      numero, tipo,
      cliente_id || null, contacto_id || null, responsable_id || null,
      departamento || null, tipologia || null,
      evento || null, competicion || null, localizacion || null,
      fecha_inicio || null, fecha_fin || null, iva_porcentaje, notas || null,
    ]);
    const pid = rows[0].id;

    await insertLineas(client, pid, tipo, {
      lineas_equipamiento, lineas_personal_general, lineas_logistica,
      lineas_personal_contratado, lineas_personal_altas_bajas,
    });

    await client.query('COMMIT');
    res.status(201).json(await getPresupuestoCompleto(pid));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────
// PUT /api/presupuestos/:id
router.put('/:id', auth, async (req, res) => {
  const {
    tipo, cliente_id, contacto_id, responsable_id,
    departamento, tipologia, evento, competicion, localizacion,
    fecha_inicio, fecha_fin, status, iva_porcentaje, notas,
    lineas_equipamiento = [], lineas_personal_general = [], lineas_logistica = [],
    lineas_personal_contratado = [], lineas_personal_altas_bajas = [],
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE presupuestos SET
        tipo=$1, cliente_id=$2, contacto_id=$3, responsable_id=$4,
        departamento=$5, tipologia=$6, evento=$7, competicion=$8,
        localizacion=$9, fecha_inicio=$10, fecha_fin=$11,
        status=$12, iva_porcentaje=$13, notas=$14
      WHERE id=$15
    `, [
      tipo, cliente_id || null, contacto_id || null, responsable_id || null,
      departamento || null, tipologia || null, evento || null, competicion || null,
      localizacion || null, fecha_inicio || null, fecha_fin || null,
      status, iva_porcentaje, notas || null, req.params.id,
    ]);

    // Borrar y re-insertar todas las líneas
    await deleteLineas(client, req.params.id);
    await insertLineas(client, req.params.id, tipo, {
      lineas_equipamiento, lineas_personal_general, lineas_logistica,
      lineas_personal_contratado, lineas_personal_altas_bajas,
    });

    await client.query('COMMIT');
    res.json(await getPresupuestoCompleto(req.params.id));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── CAMBIAR SOLO EL STATUS ───────────────────────────────────────────────────
// PATCH /api/presupuestos/:id/status
router.patch('/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  const validStatus = ['PREPARADO', 'ENVIADO', 'APROBADO', 'DESCARTADO', 'FACTURADO', 'PENDIENTE_FACTURAR'];
  if (!validStatus.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE presupuestos SET status=$1 WHERE id=$2 RETURNING id, numero, status',
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DUPLICAR ─────────────────────────────────────────────────────────────────
// POST /api/presupuestos/:id/duplicate
router.post('/:id/duplicate', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orig } = await client.query('SELECT * FROM presupuestos WHERE id=$1', [req.params.id]);
    if (!orig.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No encontrado' });
    }
    const p = orig[0];
    const numero = await generarNumero();

    const { rows: newP } = await client.query(`
      INSERT INTO presupuestos
        (numero, tipo, cliente_id, contacto_id, responsable_id, departamento, tipologia,
         evento, competicion, localizacion, fecha_inicio, fecha_fin, iva_porcentaje, notas, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'PREPARADO')
      RETURNING *
    `, [
      numero, p.tipo, p.cliente_id, p.contacto_id, p.responsable_id,
      p.departamento, p.tipologia, p.evento, p.competicion, p.localizacion,
      p.fecha_inicio, p.fecha_fin, p.iva_porcentaje, p.notas,
    ]);
    const newId = newP[0].id;

    // Duplicar líneas con las columnas correctas para cada tabla
    await duplicarLineas(client, req.params.id, newId, p.tipo);

    await client.query('COMMIT');
    res.status(201).json(await getPresupuestoCompleto(newId));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── EXPORTAR EXCEL ───────────────────────────────────────────────────────────
// GET /api/presupuestos/:id/export/excel
router.get('/:id/export/excel', auth, async (req, res) => {
  try {
    const presupuesto = await getPresupuestoCompleto(req.params.id);
    if (!presupuesto) return res.status(404).json({ error: 'No encontrado' });
    const buffer = await exportExcel(presupuesto);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="presupuesto_${presupuesto.numero}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── EXPORTAR PDF ─────────────────────────────────────────────────────────────
// GET /api/presupuestos/:id/export/pdf
router.get('/:id/export/pdf', auth, async (req, res) => {
  try {
    const presupuesto = await getPresupuestoCompleto(req.params.id);
    if (!presupuesto) return res.status(404).json({ error: 'No encontrado' });
    const buffer = await exportPdf(presupuesto);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="presupuesto_${presupuesto.numero}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ENVIAR POR EMAIL ─────────────────────────────────────────────────────────
// POST /api/presupuestos/:id/send-email
router.post('/:id/send-email', auth, async (req, res) => {
  const { to, cc, asunto, mensaje, formato = 'pdf' } = req.body;
  if (!to) return res.status(400).json({ error: 'Destinatario requerido' });
  try {
    const presupuesto = await getPresupuestoCompleto(req.params.id);
    if (!presupuesto) return res.status(404).json({ error: 'No encontrado' });

    let buffer, filename, mimetype;
    if (formato === 'excel') {
      buffer = await exportExcel(presupuesto);
      filename = `presupuesto_${presupuesto.numero}.xlsx`;
      mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      buffer = await exportPdf(presupuesto);
      filename = `presupuesto_${presupuesto.numero}.pdf`;
      mimetype = 'application/pdf';
    }

    await emailService.send({
      to, cc, subject: asunto || `Presupuesto ${presupuesto.numero}`,
      text: mensaje || '',
      attachments: [{ filename, content: buffer, contentType: mimetype }],
    });

    // Cambiar status a ENVIADO si estaba en PREPARADO
    if (presupuesto.status === 'PREPARADO') {
      await pool.query("UPDATE presupuestos SET status='ENVIADO' WHERE id=$1", [req.params.id]);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ELIMINAR ─────────────────────────────────────────────────────────────────
// DELETE /api/presupuestos/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM presupuestos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function getPresupuestoCompleto(id) {
  const { rows } = await pool.query(`
    SELECT
      p.*,
      row_to_json(c) AS cliente,
      row_to_json(r) AS responsable,
      row_to_json(cc) AS contacto
    FROM presupuestos p
    LEFT JOIN (SELECT id, nombre, razon_social, cif, direccion, tipologia FROM clientes) c ON c.id = p.cliente_id
    LEFT JOIN (SELECT id, nombre, email, telefono FROM responsables) r ON r.id = p.responsable_id
    LEFT JOIN (SELECT id, nombre, email, telefono FROM contactos_cliente) cc ON cc.id = p.contacto_id
    WHERE p.id = $1
  `, [id]);

  if (!rows.length) return null;
  const p = rows[0];

  const [equip, persGeneral, logistica, persCont, persAB] = await Promise.all([
    pool.query('SELECT * FROM lineas_equipamiento WHERE presupuesto_id=$1 ORDER BY orden', [id]),
    pool.query('SELECT * FROM lineas_personal_general WHERE presupuesto_id=$1 ORDER BY orden', [id]),
    pool.query('SELECT * FROM lineas_logistica WHERE presupuesto_id=$1 ORDER BY orden', [id]),
    pool.query('SELECT * FROM lineas_personal_contratado WHERE presupuesto_id=$1 ORDER BY orden', [id]),
    pool.query('SELECT * FROM lineas_personal_altas_bajas WHERE presupuesto_id=$1 ORDER BY orden', [id]),
  ]);

  return {
    ...p,
    lineas_equipamiento: equip.rows,
    lineas_personal_general: persGeneral.rows,
    lineas_logistica: logistica.rows,
    lineas_personal_contratado: persCont.rows,
    lineas_personal_altas_bajas: persAB.rows,
  };
}

async function deleteLineas(client, presupuestoId) {
  const tables = [
    'lineas_equipamiento', 'lineas_personal_general', 'lineas_logistica',
    'lineas_personal_contratado', 'lineas_personal_altas_bajas',
  ];
  for (const t of tables) {
    await client.query(`DELETE FROM ${t} WHERE presupuesto_id=$1`, [presupuestoId]);
  }
}

async function insertLineas(client, pid, tipo, lineas) {
  const {
    lineas_equipamiento, lineas_personal_general, lineas_logistica,
    lineas_personal_contratado, lineas_personal_altas_bajas,
  } = lineas;

  if (tipo === 'GENERAL') {
    for (const [i, l] of lineas_equipamiento.entries()) {
      await client.query(`
        INSERT INTO lineas_equipamiento (presupuesto_id, descripcion, uds, unidades, jornadas, coste_jornada, importe, orden)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [pid, l.descripcion, l.uds || null, l.unidades || null, l.jornadas || null, l.coste_jornada || null, l.importe || null, i]);
    }
    for (const [i, l] of lineas_personal_general.entries()) {
      await client.query(`
        INSERT INTO lineas_personal_general (presupuesto_id, descripcion, uds, unidades, jornadas, coste_jornada, importe, orden)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [pid, l.descripcion, l.uds || null, l.unidades || null, l.jornadas || null, l.coste_jornada || null, l.importe || null, i]);
    }
  }

  if (tipo === 'PERSONAL') {
    for (const [i, l] of lineas_personal_contratado.entries()) {
      await client.query(`
        INSERT INTO lineas_personal_contratado
          (presupuesto_id, descripcion, tarifa, jornadas, num_pax, dieta, num_dietas, importe, es_especial, orden)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [pid, l.descripcion, l.tarifa || null, l.jornadas || null, l.num_pax || null,
          l.dieta || null, l.num_dietas || null, l.importe || null, l.es_especial || false, i]);
    }
    for (const [i, l] of lineas_personal_altas_bajas.entries()) {
      await client.query(`
        INSERT INTO lineas_personal_altas_bajas
          (presupuesto_id, descripcion, tarifa, jornadas, num_pax, dieta, num_dietas, importe, orden)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [pid, l.descripcion, l.tarifa || null, l.jornadas || null, l.num_pax || null,
          l.dieta || null, l.num_dietas || null, l.importe || null, i]);
    }
  }

  // Logística en ambos tipos
  for (const [i, l] of lineas_logistica.entries()) {
    await client.query(`
      INSERT INTO lineas_logistica
        (presupuesto_id, descripcion, uds, unidades, jornadas, coste_jornada, cantidad, precio, importe, orden)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [pid, l.descripcion,
        l.uds || null, l.unidades || null, l.jornadas || null, l.coste_jornada || null,
        l.cantidad || null, l.precio || null, l.importe || null, i]);
  }
}

async function duplicarLineas(client, origenId, destinoId, tipo) {
  // Limpiar lo que insertó el intento anterior en el router
  await deleteLineas(client, destinoId);

  if (tipo === 'GENERAL') {
    await client.query(`
      INSERT INTO lineas_equipamiento (presupuesto_id, descripcion, unidades, jornadas, coste_jornada, importe, orden)
      SELECT $1, descripcion, unidades, jornadas, coste_jornada, importe, orden
      FROM lineas_equipamiento WHERE presupuesto_id=$2
    `, [destinoId, origenId]);

    await client.query(`
      INSERT INTO lineas_personal_general (presupuesto_id, descripcion, unidades, jornadas, coste_jornada, importe, orden)
      SELECT $1, descripcion, unidades, jornadas, coste_jornada, importe, orden
      FROM lineas_personal_general WHERE presupuesto_id=$2
    `, [destinoId, origenId]);
  }

  if (tipo === 'PERSONAL') {
    await client.query(`
      INSERT INTO lineas_personal_contratado (presupuesto_id, descripcion, tarifa, jornadas, num_pax, dieta, num_dietas, importe, es_especial, orden)
      SELECT $1, descripcion, tarifa, jornadas, num_pax, dieta, num_dietas, importe, es_especial, orden
      FROM lineas_personal_contratado WHERE presupuesto_id=$2
    `, [destinoId, origenId]);

    await client.query(`
      INSERT INTO lineas_personal_altas_bajas (presupuesto_id, descripcion, tarifa, jornadas, num_pax, dieta, num_dietas, importe, orden)
      SELECT $1, descripcion, tarifa, jornadas, num_pax, dieta, num_dietas, importe, orden
      FROM lineas_personal_altas_bajas WHERE presupuesto_id=$2
    `, [destinoId, origenId]);
  }

  await client.query(`
    INSERT INTO lineas_logistica (presupuesto_id, descripcion, unidades, jornadas, coste_jornada, cantidad, precio, importe, orden)
    SELECT $1, descripcion, unidades, jornadas, coste_jornada, cantidad, precio, importe, orden
    FROM lineas_logistica WHERE presupuesto_id=$2
  `, [destinoId, origenId]);
}

module.exports = router;
