const ExcelJS = require('exceljs');

const MAX_SECTIONS = 4;
const MAX_ROWS = 40000;
const MAX_COLUMNS = 32;
const MAX_CELL_LENGTH = 20000;
const MAX_IMAGE_BYTES = 350 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 30 * 1024 * 1024;
const SAFE_KEY = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

const COLORS = {
  navy: 'FF102B46',
  blue: 'FF147FEA',
  paleBlue: 'FFEAF4FF',
  paleGray: 'FFF4F7FA',
  border: 'FFD7E0E8',
  text: 'FF172033',
  muted: 'FF667085',
  white: 'FFFFFFFF'
};

function cleanText(value, maxLength = MAX_CELL_LENGTH) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, maxLength);
}

function cleanKey(value) {
  const key = cleanText(value, 64);
  if (!SAFE_KEY.test(key)) throw new Error('Invalid inventory export key');
  return key;
}

function cleanImage(dataUrl, totals) {
  if (!dataUrl) return '';
  const match = String(dataUrl).match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Invalid inventory export image');
  const bytes = Buffer.byteLength(match[2], 'base64');
  if (bytes > MAX_IMAGE_BYTES) throw new Error('Inventory export image is too large');
  totals.imageBytes += bytes;
  if (totals.imageBytes > MAX_TOTAL_IMAGE_BYTES) throw new Error('Inventory export images exceed the size limit');
  return dataUrl;
}

function cleanCell(value, type) {
  if (type === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
  if (type === 'boolean') return Boolean(value);
  if (type === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (type === 'url') {
    const text = cleanText(value, 2048);
    if (!text) return '';
    const parsed = new URL(text);
    if (parsed.protocol !== 'https:') throw new Error('Invalid inventory export URL');
    return parsed.toString();
  }
  return cleanText(value);
}

function validateInventoryReport(input) {
  if (!input || typeof input !== 'object' || input.schemaVersion !== 1) throw new Error('Invalid inventory export payload');
  if (!['pdf', 'xlsx'].includes(input.format)) throw new Error('Unsupported inventory export format');
  if (!Array.isArray(input.sections) || !input.sections.length || input.sections.length > MAX_SECTIONS) throw new Error('Invalid inventory export sections');

  const totals = { rows: 0, imageBytes: 0 };
  const sections = input.sections.map(section => {
    if (!section || typeof section !== 'object') throw new Error('Invalid inventory export section');
    const key = cleanKey(section.key);
    const columns = Array.isArray(section.columns) ? section.columns.map(column => {
      if (!column || typeof column !== 'object') throw new Error('Invalid inventory export column');
      const type = ['text', 'number', 'boolean', 'date', 'url'].includes(column.type) ? column.type : 'text';
      return {
        key: cleanKey(column.key),
        label: cleanText(column.label, 120),
        type,
        width: Math.min(60, Math.max(8, Number(column.width) || 16)),
        pdf: column.pdf !== false
      };
    }) : [];
    if (!columns.length || columns.length > MAX_COLUMNS || new Set(columns.map(column => column.key)).size !== columns.length) throw new Error('Invalid inventory export columns');
    const rows = Array.isArray(section.rows) ? section.rows.map(row => {
      if (!row || typeof row !== 'object' || !row.cells || typeof row.cells !== 'object') throw new Error('Invalid inventory export row');
      const cells = {};
      for (const column of columns) cells[column.key] = cleanCell(row.cells[column.key], column.type);
      return {
        id: cleanText(row.id, 128),
        cells,
        imageDataUrl: input.includeImages && input.format === 'pdf' ? cleanImage(row.imageDataUrl, totals) : ''
      };
    }) : [];
    totals.rows += rows.length;
    if (totals.rows > MAX_ROWS) throw new Error('Inventory export contains too many rows');
    return { key, title: cleanText(section.title, 160), columns, rows };
  });

  const summary = Array.isArray(input.summary) ? input.summary.slice(0, MAX_SECTIONS).map(item => ({
    key: cleanKey(item.key),
    label: cleanText(item.label, 120),
    count: Math.max(0, Math.floor(Number(item.count) || 0))
  })) : [];

  return {
    schemaVersion: 1,
    format: input.format,
    language: input.language === 'en' ? 'en' : 'de',
    title: cleanText(input.title, 160) || 'Keyboard Manager',
    createdAt: cleanCell(input.createdAt || Date.now(), 'date'),
    appVersion: cleanText(input.appVersion, 32),
    scopeLabel: cleanText(input.scopeLabel, 200),
    filterLabel: cleanText(input.filterLabel, 200),
    includeImages: Boolean(input.includeImages && input.format === 'pdf'),
    summary,
    sections
  };
}

function localDate(value, language, withTime = true) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'de-DE', withTime ? {
    dateStyle: 'medium',
    timeStyle: 'short'
  } : { dateStyle: 'medium' }).format(date);
}

function workbookLabels(language) {
  return language === 'en' ? {
    summary: 'Summary',
    created: 'Created',
    version: 'App version',
    scope: 'Scope',
    filters: 'Filters',
    category: 'Category',
    entries: 'Entries',
    empty: 'No entries available.'
  } : {
    summary: 'Übersicht',
    created: 'Erstellt',
    version: 'App-Version',
    scope: 'Umfang',
    filters: 'Filter',
    category: 'Bestandsart',
    entries: 'Einträge',
    empty: 'Keine Einträge vorhanden.'
  };
}

function styleTitleRow(row) {
  row.height = 34;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
    cell.font = { name: 'Arial', size: 18, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
}

function styleHeaderRow(row) {
  row.height = 26;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.blue } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: COLORS.navy } } };
  });
}

function styleBodyRow(row, index, columns) {
  row.height = 22;
  row.eachCell((cell, columnNumber) => {
    const column = columns[columnNumber - 1];
    cell.font = { name: 'Arial', size: 10, color: { argb: COLORS.text } };
    cell.alignment = {
      vertical: 'top',
      horizontal: column?.type === 'number' ? 'right' : 'left',
      wrapText: true
    };
    cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } } };
    if (index % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.paleGray } };
  });
}

function excelCellValue(value, type) {
  if (type === 'date') return value ? new Date(value) : null;
  if (type === 'url' && value) return { text: value, hyperlink: value, tooltip: value };
  return value;
}

async function createInventoryWorkbook(reportInput) {
  const report = validateInventoryReport({ ...reportInput, format: 'xlsx', includeImages: false });
  const labels = workbookLabels(report.language);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Keyboard Manager';
  workbook.lastModifiedBy = 'Keyboard Manager';
  workbook.created = new Date(report.createdAt);
  workbook.modified = new Date(report.createdAt);
  workbook.subject = report.scopeLabel;
  workbook.title = report.title;
  workbook.company = 'R3D42';

  const summarySheet = workbook.addWorksheet(labels.summary, {
    properties: { defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1 }
  });
  summarySheet.columns = [{ width: 26 }, { width: 46 }];
  summarySheet.mergeCells('A1:B1');
  summarySheet.getCell('A1').value = report.title;
  styleTitleRow(summarySheet.getRow(1));
  const metadata = [
    [labels.created, localDate(report.createdAt, report.language)],
    [labels.version, report.appVersion || '—'],
    [labels.scope, report.scopeLabel || '—'],
    [labels.filters, report.filterLabel || '—']
  ];
  metadata.forEach((values, index) => {
    const row = summarySheet.getRow(index + 3);
    row.values = values;
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.muted } };
    row.getCell(2).font = { name: 'Arial', size: 10, color: { argb: COLORS.text } };
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  });
  const summaryHeader = summarySheet.getRow(8);
  summaryHeader.values = [labels.category, labels.entries];
  styleHeaderRow(summaryHeader);
  report.summary.forEach((item, index) => {
    const row = summarySheet.getRow(index + 9);
    row.values = [item.label, item.count];
    row.getCell(2).numFmt = '#,##0';
    styleBodyRow(row, index, [{ type: 'text' }, { type: 'number' }]);
  });
  summarySheet.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2', showGridLines: false }];
  summarySheet.headerFooter.oddFooter = '&LKeyboard Manager&C' + localDate(report.createdAt, report.language, false) + '&R&P / &N';

  for (const section of report.sections) {
    const name = section.title.slice(0, 31).replace(/[\\/*?:\[\]]/g, '-') || section.key;
    const worksheet = workbook.addWorksheet(name, {
      properties: { defaultRowHeight: 22 },
      views: [{ state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    const lastColumn = Math.max(1, section.columns.length);
    worksheet.mergeCells(1, 1, 1, lastColumn);
    worksheet.getCell(1, 1).value = section.title;
    styleTitleRow(worksheet.getRow(1));
    worksheet.mergeCells(2, 1, 2, lastColumn);
    worksheet.getCell(2, 1).value = `${localDate(report.createdAt, report.language)} · ${report.scopeLabel}${report.filterLabel ? ` · ${report.filterLabel}` : ''}`;
    worksheet.getCell(2, 1).font = { name: 'Arial', size: 9, color: { argb: COLORS.muted } };
    worksheet.getCell(2, 1).alignment = { vertical: 'middle', wrapText: true };
    worksheet.getRow(2).height = 24;
    const header = worksheet.getRow(4);
    header.values = section.columns.map(column => column.label);
    styleHeaderRow(header);
    section.columns.forEach((column, index) => {
      worksheet.getColumn(index + 1).width = column.width;
    });
    if (!section.rows.length) {
      worksheet.mergeCells(5, 1, 5, lastColumn);
      worksheet.getCell(5, 1).value = labels.empty;
      worksheet.getCell(5, 1).font = { name: 'Arial', italic: true, color: { argb: COLORS.muted } };
    } else {
      section.rows.forEach((sourceRow, index) => {
        const row = worksheet.getRow(index + 5);
        row.values = section.columns.map(column => excelCellValue(sourceRow.cells[column.key], column.type));
        styleBodyRow(row, index, section.columns);
        section.columns.forEach((column, columnIndex) => {
          const cell = row.getCell(columnIndex + 1);
          if (column.type === 'number') cell.numFmt = '#,##0';
          if (column.type === 'date') cell.numFmt = 'yyyy-mm-dd hh:mm';
          if (column.type === 'boolean') cell.value = sourceRow.cells[column.key] ? (report.language === 'en' ? 'Yes' : 'Ja') : (report.language === 'en' ? 'No' : 'Nein');
          if (column.type === 'url' && sourceRow.cells[column.key]) {
            cell.font = { name: 'Arial', size: 10, color: { argb: COLORS.blue }, underline: true };
          }
        });
      });
      worksheet.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4, column: section.columns.length }
      };
    }
    worksheet.pageSetup.printTitlesRow = '1:4';
    worksheet.headerFooter.oddFooter = '&LKeyboard Manager&C' + section.title + '&R&P / &N';
  }

  return workbook;
}

async function createInventoryXlsxBuffer(report) {
  const workbook = await createInventoryWorkbook(report);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = {
  createInventoryWorkbook,
  createInventoryXlsxBuffer,
  validateInventoryReport
};
