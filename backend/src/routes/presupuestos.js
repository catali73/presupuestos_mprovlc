const router = require('express').Router();
const multer = require('multer');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const generarNumero = require('../utils/numeroPresupuesto');
const { exportExcel, exportPdf, exportExcelLote, exportPdfLote } = require('../utils/exportService');
const emailService = require('../utils/emailService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── LISTADO con filtros ──────────────────────────────────────────────────────
// GET /api/presupuestos?status=&departamento=&tipo=&search=&anyo=&trimestre=&mes=&semana=&page=&limit=
router.get('/', auth, async (req, res) => {
  const { status, responsable_id, departamento, tipo, search, anyo, trimestre, mes, semana, page = 1, limit = 50 } = req.query;
  const conditions = [];
  const params = [];

  if (status)         { params.push(status);        conditions.push(`p.status = $${params.length}`); }
  if (responsable_id) { params.push(responsable_id); conditions.push(`p.responsable_id = $${params.length}`); }
  if (departamento)   { params.push(departamento);   conditions.push(`p.departamento = $${params.length}`); }
  if (tipo)           { params.push(tipo);           conditions.push(`p.tipo = $${params.length}`); }
  if (anyo)           { params.push(parseInt(anyo)); conditions.push(`EXTRACT(YEAR FROM p.fecha_presupuesto) = $${params.length}`); }
  if (trimestre)      { params.push(parseInt(trimestre)); conditions.push(`EXTRACT(QUARTER FROM p.fecha_presupuesto) = $${params.length}`); }
  if (mes)            { params.push(parseInt(mes));  conditions.push(`EXTRACT(MONTH FROM p.fecha_presupuesto) = $${params.length}`); }
  if (semana)         { params.push(parseInt(semana)); conditions.push(`p.semana = $${params.length}`); }
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

// ─── PLANTILLA EXCEL PARA IMPORTACIÓN ────────────────────────────────────────
// GET /api/presupuestos/template
router.get('/template', auth, async (req, res) => {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Presupuestos');

  ws.columns = [
    { header: 'numero',            key: 'numero',            width: 20 },
    { header: 'fecha_presupuesto', key: 'fecha_presupuesto', width: 18 },
    { header: 'evento',            key: 'evento',            width: 35 },
    { header: 'cliente',           key: 'cliente',           width: 25 },
    { header: 'tipo',              key: 'tipo',              width: 12 },
    { header: 'departamento',      key: 'departamento',      width: 24 },
    { header: 'responsable',       key: 'responsable',       width: 24 },
    { header: 'tipologia',         key: 'tipologia',         width: 18 },
    { header: 'localizacion',      key: 'localizacion',      width: 28 },
    { header: 'fecha_inicio',      key: 'fecha_inicio',      width: 15 },
    { header: 'fecha_fin',         key: 'fecha_fin',         width: 15 },
    { header: 'status',            key: 'status',            width: 22 },
    { header: 'semana',            key: 'semana',            width: 10 },
    { header: 'tipo_facturacion',  key: 'tipo_facturacion',  width: 18 },
    { header: 'numero_factura',    key: 'numero_factura',    width: 18 },
    { header: 'importe_sin_iva',   key: 'importe_sin_iva',   width: 18 },
    { header: 'notas',             key: 'notas',             width: 35 },
  ];

  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
    cell.alignment = { vertical: 'middle' };
  });
  ws.getRow(1).height = 20;

  // Fila de ejemplo
  ws.addRow({
    numero: '', fecha_presupuesto: '15/01/2026',
    evento: 'Partido LaLiga - Valencia CF vs Barcelona',
    cliente: 'MEDIAPRO', tipo: 'GENERAL', departamento: 'CAMARAS_ESPECIALES',
    responsable: 'Juan García', tipologia: 'LIGA', localizacion: 'Estadio Mestalla',
    fecha_inicio: '20/01/2026', fecha_fin: '21/01/2026',
    status: 'FACTURADO', semana: 4, tipo_facturacion: 'Factura',
    numero_factura: '', importe_sin_iva: 12500, notas: '',
  });

  // Segunda hoja: valores permitidos
  const ref = wb.addWorksheet('Valores permitidos');
  ref.columns = [{ width: 22 }, { width: 75 }];
  const refRows = [
    ['Campo', 'Valores permitidos / notas'],
    ['numero', 'Si se deja vacío, se genera automáticamente con el formato YYYYMMDDXXX'],
    ['fecha_presupuesto', 'DD/MM/YYYY — si vacío se usa la fecha de importación'],
    ['tipo', 'GENERAL  |  PERSONAL'],
    ['departamento', 'CAMARAS_ESPECIALES  |  PRODUCCIONES_VLC  |  INTERNACIONAL  |  VALENCIA_MEDIA'],
    ['status', 'PREPARADO  |  ENVIADO  |  APROBADO  |  DESCARTADO  |  FACTURADO  |  PENDIENTE_FACTURAR'],
    ['tipo_facturacion', 'Factura  |  Descuento  |  Imputación'],
    ['cliente', 'Debe coincidir exactamente con el nombre del cliente ya dado de alta en la app'],
    ['responsable', 'Debe coincidir exactamente con el nombre del responsable ya dado de alta en la app'],
    ['tipologia', 'Debe coincidir exactamente con el nombre de la tipología dada de alta en la app (ej: LIGA)'],
    ['localizacion', 'Texto libre — opcional'],
    ['numero_factura', 'Número de factura SAP — opcional'],
    ['fecha_inicio / fecha_fin', 'DD/MM/YYYY — opcionales'],
    ['semana', 'Número de semana 1-53 — opcional'],
    ['importe_sin_iva', 'Importe total sin IVA en euros (número, sin símbolo €)'],
  ];
  refRows.forEach((r, i) => {
    const row = ref.addRow(r);
    if (i === 0) {
      row.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
      });
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_importacion_presupuestos.xlsx"');
  res.send(buffer);
});

// ─── IMPORTAR DESDE EXCEL ─────────────────────────────────────────────────────
// POST /api/presupuestos/import
router.post('/import', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichero Excel requerido' });

  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(req.file.buffer);
  } catch (e) {
    return res.status(400).json({ error: 'Fichero no válido: ' + e.message });
  }
  const ws = wb.getWorksheet(1);
  if (!ws) return res.status(400).json({ error: 'No se encontró la primera hoja del Excel' });

  // Mapear cabeceras → número de columna
  const colIdx = {};
  ws.getRow(1).eachCell((cell, colNum) => {
    const key = (cell.value || '').toString().trim().toLowerCase();
    colIdx[key] = colNum;
  });

  // Cargar clientes y responsables para lookup por nombre
  const { rows: clientes }     = await pool.query('SELECT id, nombre FROM clientes');
  const { rows: responsables } = await pool.query('SELECT id, nombre FROM responsables');
  const clienteMap     = Object.fromEntries(clientes.map(c     => [c.nombre.trim().toLowerCase(), c.id]));
  const responsableMap = Object.fromEntries(responsables.map(r => [r.nombre.trim().toLowerCase(), r.id]));

  const VALID_TIPOS    = ['GENERAL', 'PERSONAL'];
  const VALID_STATUSES = ['PREPARADO', 'ENVIADO', 'APROBADO', 'DESCARTADO', 'FACTURADO', 'PENDIENTE_FACTURAR'];
  const VALID_DEPTOS   = ['CAMARAS_ESPECIALES', 'PRODUCCIONES_VLC', 'INTERNACIONAL', 'VALENCIA_MEDIA'];

  function cellVal(row, key) {
    const col = colIdx[key];
    if (!col) return null;
    const v = row.getCell(col).value;
    if (v == null) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object' && v.richText) return v.richText.map(r => r.text).join('');
    if (typeof v === 'object' && v.result != null) return String(v.result);
    return String(v).trim() || null;
  }

  function parseDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    const s = String(val);
    const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
  }

  const results = { created: 0, skipped: 0, errors: [] };

  // Recoger filas (saltando cabecera)
  const filas = [];
  ws.eachRow((row, rowNum) => { if (rowNum > 1) filas.push({ row, rowNum }); });

  for (const { row, rowNum } of filas) {
    const evento        = cellVal(row, 'evento');
    const importe_raw   = cellVal(row, 'importe_sin_iva');
    // Fila vacía → saltar silenciosamente
    if (!evento && !importe_raw) { results.skipped++; continue; }

    try {
      const tipo_raw   = (cellVal(row, 'tipo') || 'GENERAL').toUpperCase();
      const tipo       = VALID_TIPOS.includes(tipo_raw) ? tipo_raw : 'GENERAL';

      const status_raw = (cellVal(row, 'status') || 'PREPARADO').toUpperCase();
      const status     = VALID_STATUSES.includes(status_raw) ? status_raw : 'PREPARADO';

      const depto_raw  = (cellVal(row, 'departamento') || '').toUpperCase().replace(/\s+/g, '_');
      const departamento = VALID_DEPTOS.includes(depto_raw) ? depto_raw : null;

      const clienteNombre = cellVal(row, 'cliente') || '';
      const cliente_id    = clienteNombre ? clienteMap[clienteNombre.toLowerCase()] : null;
      if (clienteNombre && !cliente_id) {
        results.errors.push({ fila: rowNum, evento, error: `Cliente "${clienteNombre}" no encontrado en la app` });
        continue;
      }

      const respNombre    = cellVal(row, 'responsable') || '';
      const responsable_id = respNombre ? responsableMap[respNombre.toLowerCase()] : null;
      if (respNombre && !responsable_id) {
        results.errors.push({ fila: rowNum, evento, error: `Responsable "${respNombre}" no encontrado en la app` });
        continue;
      }

      const importe          = parseFloat(importe_raw) || 0;
      const fecha_presupuesto = parseDate(cellVal(row, 'fecha_presupuesto')) || new Date().toISOString().slice(0, 10);
      const fecha_inicio      = parseDate(cellVal(row, 'fecha_inicio'));
      const fecha_fin         = parseDate(cellVal(row, 'fecha_fin'));
      const semana_raw        = cellVal(row, 'semana');
      const semana            = semana_raw ? parseInt(semana_raw) || null : null;
      const tipo_facturacion  = cellVal(row, 'tipo_facturacion') || null;
      const tipologia         = cellVal(row, 'tipologia') || null;
      const localizacion      = cellVal(row, 'localizacion') || null;
      const numero_factura    = cellVal(row, 'numero_factura') || null;
      const notas             = cellVal(row, 'notas') || null;

      const numero_raw = cellVal(row, 'numero');
      const numero     = numero_raw ? numero_raw.toString().trim() : await generarNumero();

      // Verificar que el número no esté ya en uso
      const { rows: exist } = await pool.query('SELECT id FROM presupuestos WHERE numero=$1', [numero]);
      if (exist.length) {
        results.errors.push({ fila: rowNum, evento, error: `Número "${numero}" ya existe (duplicado)` });
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: pRows } = await client.query(`
          INSERT INTO presupuestos
            (numero, tipo, cliente_id, responsable_id, departamento, tipo_facturacion, semana,
             tipologia, localizacion, numero_factura,
             evento, fecha_presupuesto, fecha_inicio, fecha_fin, status, iva_porcentaje, notas)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,21,$16)
          RETURNING id
        `, [numero, tipo, cliente_id || null, responsable_id || null, departamento,
            tipo_facturacion, semana, tipologia, localizacion, numero_factura,
            evento, fecha_presupuesto, fecha_inicio, fecha_fin,
            status, notas]);

        const pid = pRows[0].id;
        if (importe > 0) {
          await client.query(
            `INSERT INTO lineas_equipamiento (presupuesto_id, descripcion, importe, orden)
             VALUES ($1, 'Presupuesto consolidado', $2, 0)`,
            [pid, importe]
          );
        }
        await client.query('COMMIT');
        results.created++;
      } catch (rowErr) {
        await client.query('ROLLBACK');
        results.errors.push({ fila: rowNum, evento, error: rowErr.message });
      } finally {
        client.release();
      }
    } catch (parseErr) {
      results.errors.push({ fila: rowNum, evento, error: parseErr.message });
    }
  }

  res.json(results);
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
    departamento, tipologia, tipo_facturacion, semana, evento, competicion, localizacion,
    fecha_inicio, fecha_fin, iva_porcentaje = 21, notas, numero_factura,
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
         tipo_facturacion, semana, evento, competicion, localizacion, fecha_inicio, fecha_fin,
         iva_porcentaje, notas, numero_factura)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `, [
      numero, tipo,
      cliente_id || null, contacto_id || null, responsable_id || null,
      departamento || null, tipologia || null, tipo_facturacion || null, semana || null,
      evento || null, competicion || null, localizacion || null,
      fecha_inicio || null, fecha_fin || null, iva_porcentaje, notas || null,
      numero_factura || null,
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
    departamento, tipologia, tipo_facturacion, semana, evento, competicion, localizacion,
    fecha_inicio, fecha_fin, status, iva_porcentaje, notas, numero_factura,
    lineas_equipamiento = [], lineas_personal_general = [], lineas_logistica = [],
    lineas_personal_contratado = [], lineas_personal_altas_bajas = [],
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE presupuestos SET
        tipo=$1, cliente_id=$2, contacto_id=$3, responsable_id=$4,
        departamento=$5, tipologia=$6, tipo_facturacion=$7, semana=$8,
        evento=$9, competicion=$10, localizacion=$11, fecha_inicio=$12, fecha_fin=$13,
        status=$14, iva_porcentaje=$15, notas=$16, numero_factura=$17
      WHERE id=$18
    `, [
      tipo, cliente_id || null, contacto_id || null, responsable_id || null,
      departamento || null, tipologia || null, tipo_facturacion || null, semana || null,
      evento || null, competicion || null,
      localizacion || null, fecha_inicio || null, fecha_fin || null,
      status, iva_porcentaje, notas || null, numero_factura || null, req.params.id,
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

// ─── EXPORT LOTE (PDF combinado o Excel multi-hoja) ──────────────────────────
// POST /api/presupuestos/export-lote
router.post('/export-lote', auth, async (req, res) => {
  const { ids, formato = 'pdf' } = req.body;
  if (!ids?.length) return res.status(400).json({ error: 'ids requerido' });

  try {
    const presupuestos = await Promise.all(ids.map(id => getPresupuestoCompleto(id)));
    const validos = presupuestos.filter(Boolean);

    if (formato === 'excel') {
      const buffer = await exportExcelLote(validos);
      const semana = validos[0]?.semana ? `_S${validos[0].semana}` : '';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="presupuestos_lote${semana}.xlsx"`);
      return res.send(buffer);
    } else {
      const buffer = await exportPdfLote(validos);
      const semana = validos[0]?.semana ? `_S${validos[0].semana}` : '';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="presupuestos_lote${semana}.pdf"`);
      return res.send(buffer);
    }
  } catch (err) {
    console.error('[export-lote]', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});

// ─── FACTURA PDF: SUBIR ───────────────────────────────────────────────────────
// POST /api/presupuestos/:id/factura
router.post('/:id/factura', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichero PDF requerido' });
  if (!req.file.mimetype.includes('pdf')) return res.status(400).json({ error: 'Solo se admiten ficheros PDF' });
  try {
    await pool.query(
      'UPDATE presupuestos SET factura_pdf=$1, factura_pdf_nombre=$2 WHERE id=$3',
      [req.file.buffer, req.file.originalname, req.params.id]
    );
    res.json({ ok: true, nombre: req.file.originalname, size: req.file.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FACTURA PDF: DESCARGAR ───────────────────────────────────────────────────
// GET /api/presupuestos/:id/factura
router.get('/:id/factura', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT factura_pdf, factura_pdf_nombre FROM presupuestos WHERE id=$1',
      [req.params.id]
    );
    if (!rows.length || !rows[0].factura_pdf) return res.status(404).json({ error: 'Sin PDF adjunto' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${rows[0].factura_pdf_nombre || 'factura.pdf'}"`);
    res.send(rows[0].factura_pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FACTURA PDF: BORRAR ──────────────────────────────────────────────────────
// DELETE /api/presupuestos/:id/factura
router.delete('/:id/factura', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE presupuestos SET factura_pdf=NULL, factura_pdf_nombre=NULL WHERE id=$1',
      [req.params.id]
    );
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
      p.id, p.numero, p.fecha_presupuesto, p.tipo, p.status,
      p.cliente_id, p.contacto_id, p.responsable_id,
      p.departamento, p.tipologia, p.tipo_facturacion, p.semana,
      p.evento, p.competicion, p.localizacion,
      p.fecha_inicio, p.fecha_fin, p.iva_porcentaje, p.notas,
      p.numero_factura,
      p.factura_pdf_nombre,
      (p.factura_pdf IS NOT NULL) AS tiene_factura_pdf,
      p.created_at, p.updated_at,
      row_to_json(c) AS cliente,
      row_to_json(r) AS responsable,
      row_to_json(cc) AS contacto
    FROM presupuestos p
    LEFT JOIN (SELECT id, nombre, razon_social, cif, direccion, codigo_postal, ciudad, pais, tipologia FROM clientes) c ON c.id = p.cliente_id
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
          (presupuesto_id, descripcion, tarifa, jornadas, num_pax, dieta_tipo, dieta, num_dietas, importe, es_especial, orden)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [pid, l.descripcion, l.tarifa || null, l.jornadas || null, l.num_pax || null,
          l.dieta_tipo || null, l.dieta || null, l.num_dietas || null, l.importe || null, l.es_especial || false, i]);
    }
    for (const [i, l] of lineas_personal_altas_bajas.entries()) {
      await client.query(`
        INSERT INTO lineas_personal_altas_bajas
          (presupuesto_id, descripcion, tarifa, jornadas, num_pax, dieta_tipo, dieta, num_dietas, importe, orden)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `, [pid, l.descripcion, l.tarifa || null, l.jornadas || null, l.num_pax || null,
          l.dieta_tipo || null, l.dieta || null, l.num_dietas || null, l.importe || null, i]);
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
      INSERT INTO lineas_personal_contratado (presupuesto_id, descripcion, tarifa, jornadas, num_pax, dieta_tipo, dieta, num_dietas, importe, es_especial, orden)
      SELECT $1, descripcion, tarifa, jornadas, num_pax, dieta_tipo, dieta, num_dietas, importe, es_especial, orden
      FROM lineas_personal_contratado WHERE presupuesto_id=$2
    `, [destinoId, origenId]);

    await client.query(`
      INSERT INTO lineas_personal_altas_bajas (presupuesto_id, descripcion, tarifa, jornadas, num_pax, dieta_tipo, dieta, num_dietas, importe, orden)
      SELECT $1, descripcion, tarifa, jornadas, num_pax, dieta_tipo, dieta, num_dietas, importe, orden
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
