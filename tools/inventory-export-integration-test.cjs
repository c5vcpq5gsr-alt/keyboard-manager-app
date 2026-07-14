const fs = require('fs/promises');
const path = require('path');
const ExcelJS = require('exceljs');
const { app, dialog } = require('electron');

const userDataPath = path.join(app.getPath('temp'), `keyboard-manager-inventory-export-test-${Date.now()}`);
const pdfPath = path.join(app.getPath('temp'), 'keyboard-manager-inventory-export-test.pdf');
const xlsxPath = path.join(app.getPath('temp'), 'keyboard-manager-inventory-export-test.xlsx');
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgQIAWk2vWQAAAABJRU5ErkJggg==';
let mainWindowSeen = false;

app.setPath('userData', userDataPath);
dialog.showSaveDialog = async options => {
  const extension = options.filters?.[0]?.extensions?.[0];
  return { canceled: false, filePath: extension === 'pdf' ? pdfPath : xlsxPath };
};

function makeSection(key, title, columns, makeCells) {
  return {
    key,
    title,
    columns,
    rows: Array.from({ length: 12 }, (_, index) => ({
      id: `${key}-${index + 1}`,
      imageDataUrl: pixel,
      cells: makeCells(index)
    }))
  };
}

const sections = [
  makeSection('boards', 'Keyboards', [
    { key: 'name', label: 'Board', type: 'text', width: 24 },
    { key: 'manufacturer', label: 'Hersteller', type: 'text', width: 18 },
    { key: 'format', label: 'Format', type: 'text', width: 12 },
    { key: 'switches', label: 'Switches', type: 'text', width: 30 },
    { key: 'keycaps', label: 'Keycaps', type: 'text', width: 26 },
    { key: 'updatedAt', label: 'Geändert', type: 'date', width: 19, pdf: false }
  ], index => ({ name: `Board ${index + 1}`, manufacturer: 'Beispiel Hersteller', format: '65%', switches: 'Sample Linear (70)', keycaps: 'Sample Keycaps', updatedAt: '2026-07-14T18:00:00.000Z' })),
  makeSection('keycaps', 'Keycap-Sets', [
    { key: 'name', label: 'Set', type: 'text', width: 24 },
    { key: 'manufacturer', label: 'Hersteller', type: 'text', width: 18 },
    { key: 'profile', label: 'Profil', type: 'text', width: 14 },
    { key: 'status', label: 'Status', type: 'text', width: 13 },
    { key: 'kits', label: 'Kits', type: 'text', width: 28 },
    { key: 'board', label: 'Board', type: 'text', width: 22 }
  ], index => ({ name: `Keycap Set ${index + 1}`, manufacturer: 'GMK', profile: 'Cherry/CYL', status: 'owned', kits: 'Base, NorDE, Spacebars', board: `Board ${(index % 4) + 1}` })),
  makeSection('artisans', 'Artisans', [
    { key: 'name', label: 'Artisan', type: 'text', width: 24 },
    { key: 'manufacturer', label: 'Hersteller', type: 'text', width: 18 },
    { key: 'profile', label: 'Profil', type: 'text', width: 14 },
    { key: 'status', label: 'Status', type: 'text', width: 13 },
    { key: 'tags', label: 'Tags', type: 'text', width: 28 },
    { key: 'board', label: 'Board', type: 'text', width: 22 }
  ], index => ({ name: `Artisan ${index + 1}`, manufacturer: 'Sample Maker', profile: 'MX', status: 'owned', tags: 'blue, resin, limited', board: `Board ${(index % 4) + 1}` })),
  makeSection('switches', 'Switches', [
    { key: 'name', label: 'Name / Bezeichnung', type: 'text', width: 24 },
    { key: 'switchType', label: 'Switch Type', type: 'text', width: 16 },
    { key: 'operatingForce', label: 'Operating Force', type: 'text', width: 17 },
    { key: 'quantity', label: 'Bestand', type: 'number', width: 11 },
    { key: 'mounted', label: 'Verbaut', type: 'number', width: 11 },
    { key: 'available', label: 'Verfügbar', type: 'number', width: 11 },
    { key: 'boards', label: 'Board / Zuordnung', type: 'text', width: 26 }
  ], index => ({ name: `Switch ${index + 1}`, switchType: 'Linear', operatingForce: '55 g', quantity: 90 + index, mounted: 70, available: 20 + index, boards: 'Board 1 (70)' }))
];

const basePayload = {
  schemaVersion: 1,
  language: 'de',
  title: 'Keyboard Manager - Bestandsbericht',
  createdAt: '2026-07-14T18:00:00.000Z',
  appVersion: 'test',
  scopeLabel: 'Kompletter Bestand',
  filterLabel: 'Aktuelle Filter angewendet',
  summary: sections.map(section => ({ key: section.key, label: section.title, count: section.rows.length })),
  sections
};

app.on('browser-window-created', (_event, window) => {
  if (mainWindowSeen) return;
  mainWindowSeen = true;
  window.webContents.once('did-finish-load', async () => {
    try {
      const pdfSaved = await window.webContents.executeJavaScript(`window.api.exportInventory(${JSON.stringify({ ...basePayload, format: 'pdf', includeImages: true })})`);
      const xlsxSaved = await window.webContents.executeJavaScript(`window.api.exportInventory(${JSON.stringify({ ...basePayload, format: 'xlsx', includeImages: false })})`);
      const pdf = await fs.readFile(pdfPath);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(xlsxPath);
      const switchSheet = workbook.getWorksheet('Switches');
      if (!pdfSaved || !xlsxSaved || pdf.subarray(0, 5).toString('ascii') !== '%PDF-' || pdf.length < 10000) throw new Error('PDF export is missing or invalid');
      if (workbook.worksheets.length !== 5 || !workbook.getWorksheet('Übersicht') || !switchSheet) throw new Error('XLSX worksheets do not match the export');
      if (switchSheet.getCell('D5').value !== 90 || switchSheet.getCell('E5').value !== 70 || switchSheet.getCell('F5').value !== 20) throw new Error('XLSX numeric values were not preserved');
      if (!switchSheet.autoFilter || switchSheet.views?.[0]?.state !== 'frozen') throw new Error('XLSX table usability settings are missing');
      console.log(`inventory export integration ok\npdf=${pdfPath}\nxlsx=${xlsxPath}`);
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
