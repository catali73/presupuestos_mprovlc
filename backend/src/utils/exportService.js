const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const LOGO_PATH = path.join(__dirname, '../assets/logo-mediapro-crop.png');

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

// Formateador español fiable sin depender de ICU en Node.js
function fmtES(val, withSymbol = false) {
  if (val == null || val === '') return '';
  const num = parseFloat(val);
  if (isNaN(num)) return '';
  const [int, dec] = num.toFixed(2).split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return withSymbol ? `${intFmt},${dec} €` : `${intFmt},${dec}`;
}

function formatCurrency(val) {
  return fmtES(val);
}

// Mínimo de filas en secciones PDF (rellena con filas vacías)
function padRows(rows, minRows, colCount) {
  const result = [...rows];
  while (result.length < minRows) result.push(Array(colCount).fill(''));
  return result;
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
    { key: 'desc', width: 60 },
    { key: 'unid', width: 8 },
    { key: 'jorn', width: 8 },
    { key: 'coste', width: 16 },
    { key: 'importe', width: 16 },
  ];

  // Logo en Excel (si existe el fichero)
  if (fs.existsSync(LOGO_PATH)) {
    const logoId = wb.addImage({ filename: LOGO_PATH, extension: 'png' });
    ws.addImage(logoId, { tl: { col: 1, row: 0 }, ext: { width: 110, height: 44 } });
  }

  const cli = p.cliente || {};
  const clienteLines = [
    cli.razon_social || cli.nombre || '',
    cli.cif || '',
    cli.direccion || '',
    [cli.codigo_postal, cli.ciudad].filter(Boolean).join(' '),
    cli.pais || '',
  ].filter(Boolean);

  const fechaStr = p.fecha_presupuesto ? new Date(p.fecha_presupuesto).toLocaleDateString('es-ES') : '';

  // Filas de cabecera (logo ocupa col B; datos fiscales del cliente en col F, alineados derecha)
  for (let i = 0; i < Math.max(clienteLines.length, 3); i++) {
    const rowData = ['', '', '', '', '', clienteLines[i] || ''];
    const r2 = ws.addRow(rowData);
    r2.getCell(6).alignment = { horizontal: 'right' };
    r2.getCell(6).font = { size: 9, color: { argb: 'FF333333' } };
  }

  let r = ws.addRow(['', 'PROYECTO', '', '', 'Nº', p.numero]);
  r.getCell(5).font = { bold: true, size: 9 };
  r.getCell(6).alignment = { horizontal: 'right' };
  ws.addRow(['', p.evento || '', '', '', 'FECHA', fechaStr]).getCell(6).alignment = { horizontal: 'right' };
  ws.addRow(['', '', '', '', p.tipo === 'GENERAL' ? 'SOLICITADO' : 'PETICIÓN', p.contacto?.nombre || '']).getCell(6).alignment = { horizontal: 'right' };
  ws.addRow([]);

  // Cabecera columnas
  r = ws.addRow(['', 'DESCRIPCIÓN', 'UNID.', 'JORN.', 'COSTE JORNADA', 'IMPORTE']);
  applyStyles(r, headerStyle(wb, ROJO));

  function addLineasGeneral(lineas, titulo) {
    const secRow = ws.addRow(['', titulo, '', '', '', '']);
    applyStyles(secRow, sectionStyle(ROJO));
    ws.mergeCells(`B${secRow.number}:F${secRow.number}`);

    for (const l of lineas) {
      const dr = ws.addRow([
        '', l.descripcion,
        l.unidades || '', l.jornadas || '',
        l.coste_jornada != null ? formatCurrency(l.coste_jornada) : '',
        l.importe != null ? formatCurrency(l.importe) : '',
      ]);
      applyStyles(dr, dataStyle());
      dr.getCell(6).numFmt = '#,##0.00';
    }
  }

  addLineasGeneral(p.lineas_equipamiento, 'EQUIPAMIENTO');
  addLineasGeneral(p.lineas_personal_general, 'PERSONAL TÉCNICO');

  // Logística
  const secLog = ws.addRow(['', 'LOGÍSTICA', '', '', '', '']);
  applyStyles(secLog, sectionStyle(ROJO));
  ws.mergeCells(`B${secLog.number}:F${secLog.number}`);
  for (const l of p.lineas_logistica) {
    const dr = ws.addRow([
      '', l.descripcion,
      l.unidades || '', l.jornadas || '',
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

  const t1 = ws.addRow(['', 'TOTAL PRESUPUESTO', '', '', '', formatCurrency(totalBruto)]);
  applyStyles(t1, totalStyle());
  const t2 = ws.addRow(['', 'IVA', '', '', p.iva_porcentaje / 100, formatCurrency(iva)]);
  applyStyles(t2, dataStyle(GRIS_CLARO));
  t2.getCell(5).numFmt = '0%';
  const t3 = ws.addRow(['', 'TOTAL', '', '', '', formatCurrency(total)]);
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
  const cli2 = p.cliente || {};
  const clienteLines2 = [
    cli2.razon_social || cli2.nombre || '',
    cli2.cif || '',
    cli2.direccion || '',
    [cli2.codigo_postal, cli2.ciudad].filter(Boolean).join(' '),
    cli2.pais || '',
  ].filter(Boolean);

  if (fs.existsSync(LOGO_PATH)) {
    const logoId2 = wb.addImage({ filename: LOGO_PATH, extension: 'png' });
    ws.addImage(logoId2, { tl: { col: 1, row: 0 }, ext: { width: 110, height: 44 } });
  }

  for (let i = 0; i < Math.max(clienteLines2.length, 3); i++) {
    const r2 = ws.addRow(['', '', '', '', '', '', '', clienteLines2[i] || '']);
    r2.getCell(8).alignment = { horizontal: 'right' };
    r2.getCell(8).font = { size: 9, color: { argb: 'FF333333' } };
  }

  ws.addRow(['', 'PROYECTO', '', 'COMPETICIÓN', '', 'ALBARÁN', p.numero, '']);
  ws.addRow(['', p.evento || '', '', p.competicion || '', '', 'FECHA', fechaStr, '']);
  ws.addRow(['', '', '', '', '', 'PETICIÓN', p.contacto?.nombre || '', '']);
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
  const fmt = (v) => fmtES(v, true);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 80; // ancho útil

    // ─── Cabecera ───────────────────────────────────────────────────────────
    // Logo recortado sin padding: 530×292px → ratio 1.816:1
    const LOGO_RATIO = 292 / 530; // height/width
    const LOGO_W = 130;
    const LOGO_X = 30;
    const LOGO_Y = 8;
    const LOGO_H = Math.round(LOGO_W * LOGO_RATIO); // ~72pt

    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, LOGO_X, LOGO_Y, { width: LOGO_W });
    }

    const barY = LOGO_Y + LOGO_H + 8;

    // Datos fiscales del cliente — derecha, alineados a la derecha
    const cli = p.cliente || {};
    const clienteLines = [
      cli.razon_social || cli.nombre || '',
      cli.cif || '',
      cli.direccion || '',
      [cli.codigo_postal, cli.ciudad].filter(Boolean).join('  '),
      cli.pais || '',
    ].filter(Boolean);

    // Centrados verticalmente con el logo
    const clienteBlockH = clienteLines.length * 10;
    const clienteStartY = LOGO_Y + Math.max(0, (LOGO_H - clienteBlockH) / 2);
    let cy = clienteStartY;
    doc.font('Helvetica').fontSize(7.5).fillColor('#333');
    clienteLines.forEach(line => {
      doc.text(line, LOGO_X + LOGO_W + 8, cy, { width: W - LOGO_W - 8, align: 'right', lineBreak: false });
      cy += 10;
    });
    doc.strokeColor('#e0e0e0').lineWidth(0.5).moveTo(40, barY - 4).lineTo(40 + W, barY - 4).stroke();

    // Caja roja/naranja con número y fecha
    doc.fillColor(headerColor).rect(40, barY, W, 22).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
      .text(`${isGeneral ? 'PRESUPUESTO' : 'ALBARÁN'}: ${p.numero}`, 45, barY + 6, { lineBreak: false })
      .text(`FECHA: ${fechaStr}`, 45, barY + 6, { width: W - 10, align: 'right', lineBreak: false });

    // Datos del presupuesto
    let y = barY + 32;
    doc.fillColor('#333').font('Helvetica-Bold').fontSize(8).text('CLIENTE:', 40, y, { lineBreak: false });
    doc.font('Helvetica').text(cli.nombre || '—', 100, y, { lineBreak: false });
    doc.font('Helvetica-Bold').text(isGeneral ? 'SOLICITADO:' : 'PETICIÓN:', 350, y, { lineBreak: false });
    doc.font('Helvetica').text(p.contacto?.nombre || '—', 430, y, { lineBreak: false });
    y += 14;
    doc.font('Helvetica-Bold').text('EVENTO:', 40, y, { lineBreak: false });
    doc.font('Helvetica').text(p.evento || '—', 100, y, { lineBreak: false });
    if (!isGeneral && p.competicion) {
      doc.font('Helvetica-Bold').text('COMPET.:', 350, y, { lineBreak: false });
      doc.font('Helvetica').text(p.competicion, 430, y, { lineBreak: false });
    }
    y += 14;
    if (p.localizacion) {
      doc.font('Helvetica-Bold').text('LOCALIZ.:', 40, y, { lineBreak: false });
      doc.font('Helvetica').text(p.localizacion, 100, y, { lineBreak: false });
    }
    if (p.fecha_inicio || p.fecha_fin) {
      doc.font('Helvetica-Bold').text('FECHAS:', 350, y, { lineBreak: false });
      const fi = p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString('es-ES') : '';
      const ff = p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString('es-ES') : '';
      doc.font('Helvetica').text(`${fi}${fi && ff ? ' → ' : ''}${ff}`, 430, y, { lineBreak: false });
    }
    y += 20;

    // ─── Función para dibujar sección ───────────────────────────────────────
    function drawSection(titulo, headers, rows, colWidths) {
      // Salto de página si no cabe el bloque mínimo
      if (y > doc.page.height - 120) { doc.addPage(); y = 40; }

      // Título sección
      doc.fillColor(headerColor).rect(40, y, W, 18).fill();
      doc.fillColor('white').font('Helvetica-Bold').fontSize(9).text(titulo, 44, y + 5);
      y += 18;

      // Cabecera columnas
      doc.fillColor([235, 235, 235]).rect(40, y, W, 14).fill();
      let x = 40;
      doc.fillColor('#444').font('Helvetica-Bold').fontSize(7);
      headers.forEach((h, i) => {
        doc.text(h, x + 2, y + 4, { width: colWidths[i] - 4, align: i === 0 ? 'left' : 'right' });
        x += colWidths[i];
      });
      y += 14;

      // Filas de datos
      const ROW_H = 14;
      if (rows.length === 0) {
        // Sección vacía — mostrar fila indicativa
        doc.fillColor([250, 250, 250]).rect(40, y, W, ROW_H).fill();
        doc.fillColor('#aaa').font('Helvetica').fontSize(7).text('Sin líneas', 44, y + 4, { lineBreak: false });
        y += ROW_H;
      } else {
        rows.forEach((row, ri) => {
          if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
          if (ri % 2 === 0) {
            doc.fillColor([250, 250, 250]).rect(40, y, W, ROW_H).fill();
          } else {
            doc.fillColor('white').rect(40, y, W, ROW_H).fill();
          }
          doc.fillColor('#333').font('Helvetica').fontSize(7);
          x = 40;
          row.forEach((cell, i) => {
            // lineBreak: false evita que texto largo desborde la fila
            doc.text(String(cell ?? ''), x + 2, y + 4, {
              width: colWidths[i] - 4,
              align: i === 0 ? 'left' : 'right',
              lineBreak: false,
            });
            x += colWidths[i];
          });
          y += ROW_H;
        });
      }

      // Línea separadora y espacio entre secciones
      doc.strokeColor('#ddd').lineWidth(0.5).moveTo(40, y).lineTo(40 + W, y).stroke();
      y += 10;
    }

    if (isGeneral) {
      const cols = [W - 200, 40, 40, 60, 60];
      const heads = ['DESCRIPCIÓN', 'UNID.', 'JORN.', 'COSTE JORN.', 'IMPORTE'];

      drawSection('EQUIPAMIENTO', heads, padRows(p.lineas_equipamiento.map(l => [
        l.descripcion, l.unidades || '', l.jornadas || '',
        l.coste_jornada != null ? fmt(l.coste_jornada) : '', l.importe != null ? fmt(l.importe) : '',
      ]), 10, 5), cols);

      drawSection('PERSONAL TÉCNICO', heads, padRows(p.lineas_personal_general.map(l => [
        l.descripcion, l.unidades || '', l.jornadas || '',
        l.coste_jornada != null ? fmt(l.coste_jornada) : '', l.importe != null ? fmt(l.importe) : '',
      ]), 10, 5), cols);

      drawSection('LOGÍSTICA', heads, padRows(p.lineas_logistica.map(l => [
        l.descripcion, l.unidades || '', l.jornadas || '',
        l.coste_jornada != null ? fmt(l.coste_jornada) : '', l.importe != null ? fmt(l.importe) : '',
      ]), 5, 5), cols);
    } else {
      const cols = [W - 280, 50, 40, 40, 50, 40, 60];
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
      doc.fillColor('#222').font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      doc.text(label, tx + 4, y + 4, { width: 110, lineBreak: false });
      doc.text(val, tx + 114, y + 4, { width: tw - 120, align: 'right', lineBreak: false });
      y += 16;
    });

    // ─── Pie (siempre en la última página, dentro del margen seguro) ──────────
    const footerY = doc.page.height - 58;
    doc.moveTo(40, footerY - 6).lineTo(40 + W, footerY - 6).strokeColor('#ddd').lineWidth(0.5).stroke();
    doc.fillColor('#999').fontSize(6.5).font('Helvetica')
      .text(
        `${EMPRESA.nombre} · ${EMPRESA.cif} · ${EMPRESA.oficina} · ${EMPRESA.direccion} · ${EMPRESA.localidad}`,
        40, footerY, { width: W, align: 'center', lineBreak: false }
      );

    doc.end();
  });
}

module.exports = { exportExcel, exportPdf };
