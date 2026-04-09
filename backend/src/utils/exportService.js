const ExcelJS = require('exceljs');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const EMPRESA = {
  nombre: 'Grup Mediapro SLU',
  cif: 'B-60188752',
  oficina: 'Oficina Valencia',
  direccion: 'Pol. Industrial El Oliveral, c/Q nº13',
  localidad: '46394 RIBA-ROJA DE TURIA (VALENCIA)',
};

const ROJO = 'FFC00000';
const NARANJA = 'FFED7D31';
const GRIS_CLARO = 'FFF2F2F2';
const BLANCO = 'FFFFFFFF';

function formatCurrency(val) {
  if (val == null || val === '') return '';
  return parseFloat(val).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function headerStyle(wb, color = ROJO) {
  return {
    font: { bold: true, color: { argb: BLANCO }, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: color } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    },
  };
}

function sectionStyle(color = ROJO) {
  return {
    font: { bold: true, color: { argb: BLANCO }, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: color } },
  };
}

function dataStyle(bg = BLANCO) {
  return {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
    font: { size: 10 },
    border: {
      bottom: { style: 'hair', color: { argb: 'FFD9D9D9' } },
    },
  };
}

function totalStyle() {
  return {
    font: { bold: true, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLARO } },
    border: {
      top: { style: 'medium' }, bottom: { style: 'medium' },
    },
  };
}

function applyStyles(row, style) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    if (style.font) cell.font = { ...cell.font, ...style.font };
    if (style.fill) cell.fill = style.fill;
    if (style.alignment) cell.alignment = style.alignment;
    if (style.border) cell.border = style.border;
  });
}

// ─── EXPORT EXCEL ─────────────────────────────────────────────────────────────

async function exportExcel(p) {
  const wb = new ExcelJS.Workbook();
  wb.creator = EMPRESA.nombre;

  if (p.tipo === 'GENERAL') {
    await buildSheetGeneral(wb, p);
  } else {
    await buildSheetPersonal(wb, p);
  }

  return wb.xlsx.writeBuffer();
}

async function buildSheetGeneral(wb, p) {
  const ws = wb.addWorksheet('Presupuesto', { pageSetup: { fitToPage: true } });

  ws.columns = [
    { key: 'a', width: 3 },
    { key: 'desc', width: 55 },
    { key: 'uds', width: 7 },
    { key: 'unid', width: 8 },
    { key: 'jorn', width: 8 },
    { key: 'coste', width: 16 },
    { key: 'importe', width: 16 },
  ];

  // Cabecera
  let r = ws.addRow(['', 'CLIENTE', '', '', '', '', '']);
  applyStyles(r, sectionStyle(ROJO));
  ws.addRow(['', p.cliente?.nombre || '', '', '', '', '', '']);

  const fechaStr = p.fecha_presupuesto ? new Date(p.fecha_presupuesto).toLocaleDateString('es-ES') : '';
  ws.addRow(['', 'PROYECTO', '', '', '', 'PRESUPUESTO', p.numero]);
  ws.addRow(['', p.evento || '', '', '', '', 'FECHA', fechaStr]);
  ws.addRow(['', '', '', '', '', 'SOLICITADO', p.contacto?.nombre || '']);
  ws.addRow([]);

  // Cabecera columnas
  r = ws.addRow(['', 'DESCRIPCIÓN', 'UDS.', 'UNID.', 'JORN.', 'COSTE JORNADA', 'IMPORTE']);
  applyStyles(r, headerStyle(wb, ROJO));

  function addLineasGeneral(lineas, titulo) {
    const secRow = ws.addRow(['', titulo, '', '', '', '', '']);
    applyStyles(secRow, sectionStyle(ROJO));
    ws.mergeCells(`B${secRow.number}:G${secRow.number}`);

    for (const l of lineas) {
      const dr = ws.addRow([
        '', l.descripcion,
        l.uds || '', l.unidades || '', l.jornadas || '',
        l.coste_jornada != null ? formatCurrency(l.coste_jornada) : '',
        l.importe != null ? formatCurrency(l.importe) : '',
      ]);
      applyStyles(dr, dataStyle());
      dr.getCell(7).numFmt = '#,##0.00';
    }
  }

  addLineasGeneral(p.lineas_equipamiento, 'EQUIPAMIENTO');
  addLineasGeneral(p.lineas_personal_general, 'PERSONAL TÉCNICO');

  // Logística
  const secLog = ws.addRow(['', 'LOGÍSTICA', '', '', '', '', '']);
  applyStyles(secLog, sectionStyle(ROJO));
  ws.mergeCells(`B${secLog.number}:G${secLog.number}`);
  for (const l of p.lineas_logistica) {
    const dr = ws.addRow([
      '', l.descripcion,
      l.uds || '', l.unidades || '', l.jornadas || '',
      l.coste_jornada != null ? formatCurrency(l.coste_jornada) : '',
      l.importe != null ? formatCurrency(l.importe) : '',
    ]);
    applyStyles(dr, dataStyle());
  }

  ws.addRow([]);

  // Totales
  const totalBruto = calcTotalGeneral(p);
  const iva = totalBruto * (p.iva_porcentaje / 100);
  const total = totalBruto + iva;

  const t1 = ws.addRow(['', 'TOTAL PRESUPUESTO', '', '', '', '', formatCurrency(totalBruto)]);
  applyStyles(t1, totalStyle());
  const t2 = ws.addRow(['', 'IVA', '', '', '', p.iva_porcentaje / 100, formatCurrency(iva)]);
  applyStyles(t2, dataStyle(GRIS_CLARO));
  t2.getCell(6).numFmt = '0%';
  const t3 = ws.addRow(['', 'TOTAL', '', '', '', '', formatCurrency(total)]);
  applyStyles(t3, totalStyle());

  ws.addRow([]);

  // Pie empresa
  ws.addRow(['', EMPRESA.nombre]);
  ws.addRow(['', EMPRESA.cif]);
  ws.addRow(['', EMPRESA.oficina]);
  ws.addRow(['', EMPRESA.direccion]);
  ws.addRow(['', EMPRESA.localidad]);
}

async function buildSheetPersonal(wb, p) {
  const ws = wb.addWorksheet('Presupuesto Personal', { pageSetup: { fitToPage: true } });

  ws.columns = [
    { key: 'a', width: 3 },
    { key: 'personal', width: 45 },
    { key: 'tarifa', width: 12 },
    { key: 'jorn', width: 10 },
    { key: 'pax', width: 8 },
    { key: 'dieta', width: 10 },
    { key: 'ndieta', width: 10 },
    { key: 'importe', width: 14 },
  ];

  const fechaStr = p.fecha_presupuesto ? new Date(p.fecha_presupuesto).toLocaleDateString('es-ES') : '';

  ws.addRow(['', 'CLIENTE', '', '', '', '', '', '']);
  ws.addRow(['', p.cliente?.nombre || '', '', '', '', '', '', '']);
  ws.addRow(['', '', '', '', '', 'PETICIÓN', p.contacto?.nombre || '', '']);
  ws.addRow(['', 'PROYECTO', '', 'COMPETICIÓN', '', 'ALBARÁN', p.numero, '']);
  ws.addRow(['', p.evento || '', '', p.competicion || '', '', 'FECHA', fechaStr, '']);
  ws.addRow([]);

  // Cabecera columnas
  const hr = ws.addRow(['', 'PERSONAL', 'TARIFA', 'JORNADAS', 'Nº PAX', 'DIETA', 'NºDIETA', 'IMPORTE']);
  applyStyles(hr, headerStyle(wb, NARANJA));

  function addLineasPersonal(lineas, titulo) {
    const secRow = ws.addRow(['', titulo, '', '', '', '', '', '']);
    applyStyles(secRow, sectionStyle(NARANJA));
    ws.mergeCells(`B${secRow.number}:H${secRow.number}`);

    for (const l of lineas) {
      const dr = ws.addRow([
        '', l.descripcion,
        l.tarifa != null ? formatCurrency(l.tarifa) : '',
        l.jornadas || '', l.num_pax || '',
        l.dieta != null ? formatCurrency(l.dieta) : '',
        l.num_dietas || '',
        l.importe != null ? formatCurrency(l.importe) : '',
      ]);
      applyStyles(dr, dataStyle());
    }
  }

  addLineasPersonal(p.lineas_personal_contratado, 'PERSONAL CONTRATADO');
  addLineasPersonal(p.lineas_personal_altas_bajas, 'PERSONAL ALTAS/ BAJAS');

  // Logística Personal — columnas: desc, cantidad, precio, importe
  const secLog = ws.addRow(['', 'LOGÍSTICA', '', '', 'CANTIDAD', '', 'PRECIO', 'IMPORTE']);
  applyStyles(secLog, sectionStyle(NARANJA));
  for (const l of p.lineas_logistica) {
    const dr = ws.addRow([
      '', l.descripcion, '', '',
      l.cantidad || '',
      '',
      l.precio != null ? formatCurrency(l.precio) : '',
      l.importe != null ? formatCurrency(l.importe) : '',
    ]);
    applyStyles(dr, dataStyle());
  }

  ws.addRow([]);

  const totalBruto = calcTotalPersonal(p);
  const iva = totalBruto * (p.iva_porcentaje / 100);
  const total = totalBruto + iva;

  const t1 = ws.addRow(['', 'TOTAL PRESUPUESTO', '', '', '', '', '', formatCurrency(totalBruto)]);
  applyStyles(t1, totalStyle());
  const t2 = ws.addRow(['', 'IVA', '', '', '', '', p.iva_porcentaje / 100, formatCurrency(iva)]);
  applyStyles(t2, dataStyle(GRIS_CLARO));
  t2.getCell(7).numFmt = '0%';
  const t3 = ws.addRow(['', 'TOTAL', '', '', '', '', '', formatCurrency(total)]);
  applyStyles(t3, totalStyle());

  ws.addRow([]);
  ws.addRow(['', EMPRESA.nombre]);
  ws.addRow(['', EMPRESA.cif]);
  ws.addRow(['', EMPRESA.oficina]);
  ws.addRow(['', EMPRESA.direccion]);
  ws.addRow(['', EMPRESA.localidad]);
}

function calcTotalGeneral(p) {
  const sum = (arr) => arr.reduce((acc, l) => acc + parseFloat(l.importe || 0), 0);
  return sum(p.lineas_equipamiento) + sum(p.lineas_personal_general) + sum(p.lineas_logistica);
}

function calcTotalPersonal(p) {
  const sum = (arr) => arr.reduce((acc, l) => acc + parseFloat(l.importe || 0), 0);
  return sum(p.lineas_personal_contratado) + sum(p.lineas_personal_altas_bajas) + sum(p.lineas_logistica);
}

// ─── EXPORT PDF (pdfkit — sin dependencias del sistema) ──────────────────────

async function exportPdf(p) {
  const PDFDocument = require('pdfkit');
  const isGeneral = p.tipo === 'GENERAL';
  const headerColor = isGeneral ? [192, 0, 0] : [237, 125, 49];
  const fechaStr = p.fecha_presupuesto ? new Date(p.fecha_presupuesto).toLocaleDateString('es-ES') : '';
  const totalBruto = isGeneral ? calcTotalGeneral(p) : calcTotalPersonal(p);
  const iva = totalBruto * (parseFloat(p.iva_porcentaje) / 100);
  const total = totalBruto + iva;
  const fmt = (v) => v != null && v !== '' ? parseFloat(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 80; // ancho útil

    // ─── Cabecera ───────────────────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('CCEE — Gestión Presupuestos', 40, 40);
    doc.fontSize(8).font('Helvetica').fillColor('#666')
      .text(`${EMPRESA.nombre} · ${EMPRESA.cif} · ${EMPRESA.localidad}`, 40, 58);

    // Caja roja/naranja con número y fecha
    doc.fillColor(headerColor).rect(40, 72, W, 22).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
      .text(`${isGeneral ? 'PRESUPUESTO' : 'ALBARÁN'}: ${p.numero}`, 45, 77)
      .text(`FECHA: ${fechaStr}`, 350, 77);

    // Datos generales
    let y = 105;
    doc.fillColor('#333').font('Helvetica-Bold').fontSize(8).text('CLIENTE:', 40, y);
    doc.font('Helvetica').text(p.cliente?.nombre || '—', 100, y);
    doc.font('Helvetica-Bold').text(isGeneral ? 'SOLICITADO:' : 'PETICIÓN:', 350, y);
    doc.font('Helvetica').text(p.contacto?.nombre || '—', 430, y);
    y += 14;
    doc.font('Helvetica-Bold').text('EVENTO:', 40, y);
    doc.font('Helvetica').text(p.evento || '—', 100, y);
    if (!isGeneral && p.competicion) {
      doc.font('Helvetica-Bold').text('COMPET.:', 350, y);
      doc.font('Helvetica').text(p.competicion, 430, y);
    }
    y += 14;
    if (p.localizacion) {
      doc.font('Helvetica-Bold').text('LOCALIZ.:', 40, y);
      doc.font('Helvetica').text(p.localizacion, 100, y);
    }
    if (p.fecha_inicio || p.fecha_fin) {
      doc.font('Helvetica-Bold').text('FECHAS:', 350, y);
      const fi = p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString('es-ES') : '';
      const ff = p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString('es-ES') : '';
      doc.font('Helvetica').text(`${fi}${fi && ff ? ' → ' : ''}${ff}`, 430, y);
    }
    y += 20;

    // ─── Función para dibujar sección ───────────────────────────────────────
    function drawSection(titulo, headers, rows, colWidths) {
      // Título sección
      doc.fillColor(headerColor).rect(40, y, W, 16).fill();
      doc.fillColor('white').font('Helvetica-Bold').fontSize(8).text(titulo, 44, y + 4);
      y += 16;

      // Cabecera columnas
      doc.fillColor([240, 240, 240]).rect(40, y, W, 14).fill();
      let x = 40;
      doc.fillColor('#444').font('Helvetica-Bold').fontSize(7);
      headers.forEach((h, i) => {
        doc.text(h, x + 2, y + 3, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
        x += colWidths[i];
      });
      y += 14;

      // Filas
      rows.forEach((row, ri) => {
        if (y > doc.page.height - 100) { doc.addPage(); y = 40; }
        if (ri % 2 === 0) {
          doc.fillColor([250, 250, 250]).rect(40, y, W, 13).fill();
        }
        doc.fillColor('#333').font('Helvetica').fontSize(7);
        x = 40;
        row.forEach((cell, i) => {
          doc.text(String(cell ?? ''), x + 2, y + 3, { width: colWidths[i] - 4, align: i === 0 ? 'left' : 'right' });
          x += colWidths[i];
        });
        y += 13;
      });
      y += 4;
    }

    if (isGeneral) {
      const cols = [W - 240, 40, 40, 40, 60, 60];
      const heads = ['DESCRIPCIÓN', 'UDS.', 'UNID.', 'JORN.', 'COSTE JORN.', 'IMPORTE'];

      drawSection('EQUIPAMIENTO', heads, p.lineas_equipamiento.map(l => [
        l.descripcion, l.uds || '', l.unidades || '', l.jornadas || '',
        l.coste_jornada != null ? fmt(l.coste_jornada) : '', l.importe != null ? fmt(l.importe) : '',
      ]), cols);

      drawSection('PERSONAL TÉCNICO', heads, p.lineas_personal_general.map(l => [
        l.descripcion, l.uds || '', l.unidades || '', l.jornadas || '',
        l.coste_jornada != null ? fmt(l.coste_jornada) : '', l.importe != null ? fmt(l.importe) : '',
      ]), cols);

      drawSection('LOGÍSTICA', heads, p.lineas_logistica.map(l => [
        l.descripcion, l.uds || '', l.unidades || '', l.jornadas || '',
        l.coste_jornada != null ? fmt(l.coste_jornada) : '', l.importe != null ? fmt(l.importe) : '',
      ]), cols);
    } else {
      const cols = [W - 260, 50, 40, 40, 50, 40, 60];
      const heads = ['PERSONAL', 'TARIFA', 'JORN.', 'Nº PAX', 'DIETA', 'NºDIETA', 'IMPORTE'];

      drawSection('PERSONAL CONTRATADO', heads, p.lineas_personal_contratado.map(l => [
        l.descripcion, l.tarifa != null ? fmt(l.tarifa) : '', l.jornadas || '', l.num_pax || '',
        l.dieta != null ? fmt(l.dieta) : '', l.num_dietas || '', l.importe != null ? fmt(l.importe) : '',
      ]), cols);

      drawSection('PERSONAL ALTAS / BAJAS', heads, p.lineas_personal_altas_bajas.map(l => [
        l.descripcion, l.tarifa != null ? fmt(l.tarifa) : '', l.jornadas || '', l.num_pax || '',
        l.dieta != null ? fmt(l.dieta) : '', l.num_dietas || '', l.importe != null ? fmt(l.importe) : '',
      ]), cols);

      const colsLog = [W - 160, 50, 50, 60];
      drawSection('LOGÍSTICA', ['DESCRIPCIÓN', 'CANTIDAD', 'PRECIO', 'IMPORTE'], p.lineas_logistica.map(l => [
        l.descripcion, l.cantidad || '', l.precio != null ? fmt(l.precio) : '', l.importe != null ? fmt(l.importe) : '',
      ]), colsLog);
    }

    // ─── Totales ─────────────────────────────────────────────────────────────
    if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
    y += 6;
    const tw = 200;
    const tx = 40 + W - tw;

    [[`TOTAL PRESUPUESTO`, fmt(totalBruto)], [`IVA (${p.iva_porcentaje}%)`, fmt(iva)], ['TOTAL', fmt(total)]].forEach(([label, val], i) => {
      const isBold = i === 2;
      doc.fillColor(i % 2 === 0 ? [240, 240, 240] : 'white').rect(tx, y, tw, 16).fill();
      doc.fillColor('#222').font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
        .text(label, tx + 4, y + 4, { width: 110 })
        .text(val, tx + 114, y + 4, { width: tw - 120, align: 'right' });
      y += 16;
    });

    // ─── Pie ─────────────────────────────────────────────────────────────────
    doc.fillColor('#999').fontSize(7).font('Helvetica')
      .text(`${EMPRESA.nombre} · ${EMPRESA.cif} · ${EMPRESA.oficina} · ${EMPRESA.direccion} · ${EMPRESA.localidad}`,
        40, doc.page.height - 40, { width: W, align: 'center' });

    doc.end();
  });
}

module.exports = { exportExcel, exportPdf };
