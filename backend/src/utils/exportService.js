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

// ─── EXPORT PDF (HTML → Puppeteer) ───────────────────────────────────────────

async function exportPdf(p) {
  const puppeteer = require('puppeteer');
  const html = buildHtml(p);

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
  });
  await browser.close();
  return buffer;
}

function buildHtml(p) {
  const isGeneral = p.tipo === 'GENERAL';
  const fechaStr = p.fecha_presupuesto ? new Date(p.fecha_presupuesto).toLocaleDateString('es-ES') : '';
  const totalBruto = isGeneral ? calcTotalGeneral(p) : calcTotalPersonal(p);
  const iva = totalBruto * (p.iva_porcentaje / 100);
  const total = totalBruto + iva;
  const fmt = (v) => v != null ? parseFloat(v).toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '';

  const headerColor = isGeneral ? '#C00000' : '#ED7D31';

  const styles = `
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #333; }
    h3 { margin: 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: ${headerColor}; color: white; padding: 4px 6px; text-align: center; font-size: 8pt; }
    td { padding: 3px 6px; border-bottom: 1px solid #eee; }
    .section-row td { background: ${headerColor}; color: white; font-weight: bold; padding: 3px 6px; }
    .total-row td { background: #f2f2f2; font-weight: bold; border-top: 2px solid #999; }
    .right { text-align: right; }
    .center { text-align: center; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .meta-left p { margin: 2px 0; }
    .meta-right { text-align: right; }
    .meta-right p { margin: 2px 0; }
    .footer { margin-top: 20px; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 6px; }
  `;

  const metaBlock = `
    <div class="meta">
      <div class="meta-left">
        <p><strong>CLIENTE:</strong> ${p.cliente?.nombre || ''}</p>
        <p><strong>${isGeneral ? 'PROYECTO' : 'PROYECTO'}:</strong> ${p.evento || ''}</p>
        ${p.competicion ? `<p><strong>COMPETICIÓN:</strong> ${p.competicion}</p>` : ''}
        ${p.localizacion ? `<p><strong>LOCALIZACIÓN:</strong> ${p.localizacion}</p>` : ''}
      </div>
      <div class="meta-right">
        <p><strong>${isGeneral ? 'PRESUPUESTO' : 'ALBARÁN'}:</strong> ${p.numero}</p>
        <p><strong>FECHA:</strong> ${fechaStr}</p>
        <p><strong>${isGeneral ? 'SOLICITADO' : 'PETICIÓN'}:</strong> ${p.contacto?.nombre || ''}</p>
      </div>
    </div>
  `;

  let tableHtml = '';

  if (isGeneral) {
    tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="text-align:left;width:50%">DESCRIPCIÓN</th>
            <th>UDS.</th><th>UNID.</th><th>JORN.</th>
            <th class="right">COSTE JORNADA</th>
            <th class="right">IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          ${buildSectionGeneral('EQUIPAMIENTO', p.lineas_equipamiento, fmt)}
          ${buildSectionGeneral('PERSONAL TÉCNICO', p.lineas_personal_general, fmt)}
          ${buildSectionLogisticaGeneral(p.lineas_logistica, fmt)}
        </tbody>
      </table>
    `;
  } else {
    tableHtml = `
      <table>
        <thead>
          <tr>
            <th style="text-align:left;width:40%">PERSONAL</th>
            <th class="right">TARIFA</th><th>JORNADAS</th>
            <th>Nº PAX</th><th class="right">DIETA</th>
            <th>NºDIETA</th><th class="right">IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          ${buildSectionPersonal('PERSONAL CONTRATADO', p.lineas_personal_contratado, fmt)}
          ${buildSectionPersonal('PERSONAL ALTAS/ BAJAS', p.lineas_personal_altas_bajas, fmt)}
          ${buildSectionLogisticaPersonal(p.lineas_logistica, fmt)}
        </tbody>
      </table>
    `;
  }

  const totalesHtml = `
    <table style="width:40%;margin-left:auto">
      <tbody>
        <tr class="total-row"><td>TOTAL PRESUPUESTO</td><td class="right">${fmt(totalBruto)}</td></tr>
        <tr><td>IVA (${p.iva_porcentaje}%)</td><td class="right">${fmt(iva)}</td></tr>
        <tr class="total-row"><td><strong>TOTAL</strong></td><td class="right"><strong>${fmt(total)}</strong></td></tr>
      </tbody>
    </table>
  `;

  const footerHtml = `
    <div class="footer">
      ${EMPRESA.nombre} · ${EMPRESA.cif} · ${EMPRESA.oficina} · ${EMPRESA.direccion} · ${EMPRESA.localidad}
    </div>
  `;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${styles}</style></head>
    <body>${metaBlock}${tableHtml}${totalesHtml}${footerHtml}</body></html>`;
}

function buildSectionGeneral(titulo, lineas, fmt) {
  const rows = lineas.map(l => `
    <tr>
      <td>${l.descripcion}</td>
      <td class="center">${l.uds || ''}</td>
      <td class="center">${l.unidades || ''}</td>
      <td class="center">${l.jornadas || ''}</td>
      <td class="right">${l.coste_jornada != null ? fmt(l.coste_jornada) : ''}</td>
      <td class="right">${l.importe != null ? fmt(l.importe) : ''}</td>
    </tr>
  `).join('');
  return `<tr class="section-row"><td colspan="6">${titulo}</td></tr>${rows}`;
}

function buildSectionLogisticaGeneral(lineas, fmt) {
  const rows = lineas.map(l => `
    <tr>
      <td>${l.descripcion}</td>
      <td class="center">${l.uds || ''}</td>
      <td class="center">${l.unidades || ''}</td>
      <td class="center">${l.jornadas || ''}</td>
      <td class="right">${l.coste_jornada != null ? fmt(l.coste_jornada) : ''}</td>
      <td class="right">${l.importe != null ? fmt(l.importe) : ''}</td>
    </tr>
  `).join('');
  return `<tr class="section-row"><td colspan="6">LOGÍSTICA</td></tr>${rows}`;
}

function buildSectionPersonal(titulo, lineas, fmt) {
  const rows = lineas.map(l => `
    <tr>
      <td>${l.descripcion}</td>
      <td class="right">${l.tarifa != null ? fmt(l.tarifa) : ''}</td>
      <td class="center">${l.jornadas || ''}</td>
      <td class="center">${l.num_pax || ''}</td>
      <td class="right">${l.dieta != null ? fmt(l.dieta) : ''}</td>
      <td class="center">${l.num_dietas || ''}</td>
      <td class="right">${l.importe != null ? fmt(l.importe) : ''}</td>
    </tr>
  `).join('');
  return `<tr class="section-row"><td colspan="7">${titulo}</td></tr>${rows}`;
}

function buildSectionLogisticaPersonal(lineas, fmt) {
  const rows = lineas.map(l => `
    <tr>
      <td>${l.descripcion}</td>
      <td></td>
      <td></td>
      <td class="center">${l.cantidad || ''}</td>
      <td></td>
      <td class="right">${l.precio != null ? fmt(l.precio) : ''}</td>
      <td class="right">${l.importe != null ? fmt(l.importe) : ''}</td>
    </tr>
  `).join('');
  return `<tr class="section-row"><td colspan="7">LOGÍSTICA</td></tr>${rows}`;
}

module.exports = { exportExcel, exportPdf };
