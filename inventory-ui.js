(() => {
  function tr(de, en) {
    return currentLanguage() === 'en' ? en : de;
  }

  function selectedRows(entity, filtered) {
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '', currentLanguage() === 'en' ? 'en' : 'de');
    if (entity === 'boards') return filtered ? applyFilters(state.boards) : [...state.boards].sort(byName);
    if (entity === 'keycaps') return filtered ? applyKeycapFilters(state.keycapSets) : [...state.keycapSets].sort(byName);
    if (entity === 'artisans') return filtered ? applyArtisanFilters(state.artisanSets) : [...state.artisanSets].sort(byName);
    return filtered ? applySwitchFilters(state.switchSets) : [...state.switchSets].sort(byName);
  }

  function exportSection(entity, filtered) {
    const source = selectedRows(entity, filtered);
    const dateColumn = { key: 'updatedAt', label: tr('Geändert', 'Updated'), type: 'date', width: 19, pdf: false };
    if (entity === 'boards') {
      return {
        key: 'boards',
        title: 'Keyboards',
        columns: [
          { key: 'name', label: 'Board', type: 'text', width: 24 },
          { key: 'manufacturer', label: tr('Hersteller', 'Manufacturer'), type: 'text', width: 19 },
          { key: 'format', label: 'Format', type: 'text', width: 12 },
          { key: 'plate', label: 'Plate', type: 'text', width: 18, pdf: false },
          { key: 'pcb', label: 'PCB', type: 'text', width: 18, pdf: false },
          { key: 'switches', label: 'Switches', type: 'text', width: 32 },
          { key: 'keycaps', label: 'Keycaps', type: 'text', width: 27 },
          { key: 'stabs', label: 'Stabs', type: 'text', width: 22, pdf: false },
          { key: 'photos', label: tr('Fotos', 'Photos'), type: 'number', width: 10, pdf: false },
          { key: 'notes', label: tr('Bemerkung', 'Notes'), type: 'text', width: 34, pdf: false },
          dateColumn
        ],
        rows: source.map(board => ({
          id: board.id,
          photoId: board.mainPhotoId || (board.photoIds || [])[0] || '',
          cells: {
            name: board.name || '', manufacturer: board.manufacturer || '', format: board.format || '', plate: board.plate || '', pcb: board.pcb || '',
            switches: displayBoardSwitches(board) || '', keycaps: displayBoardKeycaps(board) || '', stabs: board.stabs || '', photos: (board.photoIds || []).length,
            notes: board.remark || '', updatedAt: board.updatedAt || board.createdAt || Date.now()
          }
        }))
      };
    }
    if (entity === 'keycaps') {
      return {
        key: 'keycaps',
        title: tr('Keycap-Sets', 'Keycap Sets'),
        columns: [
          { key: 'name', label: 'Set', type: 'text', width: 26 },
          { key: 'manufacturer', label: tr('Hersteller', 'Manufacturer'), type: 'text', width: 19 },
          { key: 'profile', label: tr('Profil', 'Profile'), type: 'text', width: 14 },
          { key: 'material', label: 'Material', type: 'text', width: 14, pdf: false },
          { key: 'status', label: 'Status', type: 'text', width: 13 },
          { key: 'kits', label: 'Kits', type: 'text', width: 30 },
          { key: 'board', label: 'Board', type: 'text', width: 24 },
          { key: 'source', label: tr('Quelle', 'Source'), type: 'text', width: 20, pdf: false },
          { key: 'sourceUrl', label: tr('Quelllink', 'Source link'), type: 'url', width: 35, pdf: false },
          { key: 'notes', label: tr('Notizen', 'Notes'), type: 'text', width: 38, pdf: false },
          { key: 'photos', label: tr('Fotos', 'Photos'), type: 'number', width: 10, pdf: false },
          dateColumn
        ],
        rows: source.map(set => ({
          id: set.id,
          photoId: set.mainPhotoId || (set.photoIds || [])[0] || '',
          cells: {
            name: set.name || '', manufacturer: set.manufacturer || '', profile: set.profile || '', material: set.material || '', status: set.status || '',
            kits: (set.kits || []).join(', '), board: boardName(set.mountedBoardId) || '', source: set.sourceShop || '', sourceUrl: set.sourceUrl || '',
            notes: set.notes || '', photos: (set.photoIds || []).length, updatedAt: set.updatedAt || set.createdAt || Date.now()
          }
        }))
      };
    }
    if (entity === 'artisans') {
      return {
        key: 'artisans',
        title: 'Artisans',
        columns: [
          { key: 'name', label: 'Artisan', type: 'text', width: 26 },
          { key: 'manufacturer', label: tr('Hersteller', 'Manufacturer'), type: 'text', width: 19 },
          { key: 'profile', label: tr('Profil', 'Profile'), type: 'text', width: 14 },
          { key: 'material', label: 'Material', type: 'text', width: 14, pdf: false },
          { key: 'status', label: 'Status', type: 'text', width: 13 },
          { key: 'tags', label: 'Tags', type: 'text', width: 30 },
          { key: 'board', label: 'Board', type: 'text', width: 24 },
          { key: 'source', label: tr('Quelle', 'Source'), type: 'text', width: 20, pdf: false },
          { key: 'sourceUrl', label: tr('Quelllink', 'Source link'), type: 'url', width: 35, pdf: false },
          { key: 'notes', label: tr('Notizen', 'Notes'), type: 'text', width: 38, pdf: false },
          { key: 'photos', label: tr('Fotos', 'Photos'), type: 'number', width: 10, pdf: false },
          dateColumn
        ],
        rows: source.map(set => ({
          id: set.id,
          photoId: set.mainPhotoId || (set.photoIds || [])[0] || '',
          cells: {
            name: set.name || '', manufacturer: set.manufacturer || '', profile: set.profile || '', material: set.material || '', status: set.status || '',
            tags: (set.tags || []).join(', '), board: boardName(set.mountedBoardId) || '', source: set.sourceShop || '', sourceUrl: set.sourceUrl || '',
            notes: set.notes || '', photos: (set.photoIds || []).length, updatedAt: set.updatedAt || set.createdAt || Date.now()
          }
        }))
      };
    }
    return {
      key: 'switches',
      title: 'Switches',
      columns: [
        { key: 'name', label: tr('Name / Bezeichnung', 'Name'), type: 'text', width: 26 },
        { key: 'switchType', label: 'Switch Type', type: 'text', width: 16 },
        { key: 'topHousing', label: 'Top Housing', type: 'text', width: 17, pdf: false },
        { key: 'bottomHousing', label: 'Bottom Housing', type: 'text', width: 17, pdf: false },
        { key: 'stem', label: 'Stem', type: 'text', width: 14, pdf: false },
        { key: 'springLength', label: 'Spring Length', type: 'text', width: 15, pdf: false },
        { key: 'springType', label: 'Spring Type', type: 'text', width: 17, pdf: false },
        { key: 'preTravel', label: 'Pre-travel', type: 'text', width: 14, pdf: false },
        { key: 'totalTravel', label: 'Total Travel', type: 'text', width: 14, pdf: false },
        { key: 'operatingForce', label: 'Operating Force', type: 'text', width: 17 },
        { key: 'bottomOutForce', label: 'Bottom-out Force', type: 'text', width: 17, pdf: false },
        { key: 'pins', label: 'Pins', type: 'text', width: 10, pdf: false },
        { key: 'ledDiffuser', label: 'LED Diffusor', type: 'boolean', width: 13, pdf: false },
        { key: 'factoryLubed', label: 'Factory Lubed', type: 'boolean', width: 14, pdf: false },
        { key: 'quantity', label: tr('Bestand', 'Stock'), type: 'number', width: 11 },
        { key: 'mounted', label: tr('Verbaut', 'Installed'), type: 'number', width: 11 },
        { key: 'available', label: tr('Verfügbar', 'Available'), type: 'number', width: 11 },
        { key: 'boards', label: tr('Board / Zuordnung', 'Board / allocation'), type: 'text', width: 28 },
        { key: 'notes', label: tr('Notizen', 'Notes'), type: 'text', width: 38, pdf: false },
        { key: 'photos', label: tr('Fotos', 'Photos'), type: 'number', width: 10, pdf: false },
        dateColumn
      ],
      rows: source.map(set => ({
        id: set.id,
        photoId: set.mainPhotoId || (set.photoIds || [])[0] || '',
        cells: {
          name: set.name || '', switchType: set.switchType || '', topHousing: set.topHousingMaterial || '', bottomHousing: set.bottomHousingMaterial || '',
          stem: set.stemMaterial || '', springLength: set.springLength || '', springType: set.springType || '', preTravel: set.preTravel || '', totalTravel: set.totalTravel || '',
          operatingForce: set.operatingForce || '', bottomOutForce: set.bottomOutForce || '', pins: displaySwitchPins(set.pins), ledDiffuser: Boolean(set.ledDiffuser),
          factoryLubed: Boolean(set.factoryLubed), quantity: Number(set.quantity || 0), mounted: Number(set.mountedQuantity || 0), available: availableSwitchQuantity(set),
          boards: displaySwitchBoard(set) || set.importedBoardText || '', notes: set.notes || '', photos: (set.photoIds || []).length,
          updatedAt: set.updatedAt || set.createdAt || Date.now()
        }
      }))
    };
  }

  function resizeThumbnail(dataUrl) {
    return new Promise(resolve => {
      if (!dataUrl) { resolve(''); return; }
      const image = new Image();
      image.onload = () => {
        try {
          const scale = Math.min(1, 180 / image.naturalWidth, 110 / image.naturalHeight);
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        } catch (error) {
          resolve('');
        }
      };
      image.onerror = () => resolve('');
      image.src = dataUrl;
    });
  }

  async function addThumbnails(sections) {
    let remaining = 200;
    for (const section of sections) {
      for (const row of section.rows) {
        const photoId = row.photoId;
        delete row.photoId;
        if (!photoId || remaining <= 0) continue;
        try {
          const photo = await storeGet('photos', photoId);
          if (photo?.dataUrl) {
            row.imageDataUrl = await resizeThumbnail(photo.dataUrl);
            if (row.imageDataUrl) remaining--;
          }
        } catch (error) {}
      }
    }
  }

  async function createPayload(options) {
    const entities = options.scope === 'current' ? [state.viewEntities.ueb || 'boards'] : ['boards', 'keycaps', 'artisans', 'switches'];
    const sections = entities.map(entity => exportSection(entity, options.filtered));
    if (options.includeImages && options.format === 'pdf') await addThumbnails(sections);
    else for (const section of sections) for (const row of section.rows) delete row.photoId;
    return {
      schemaVersion: 1,
      format: options.format,
      language: currentLanguage(),
      title: options.format === 'pdf' ? tr('Keyboard Manager - Bestandsbericht', 'Keyboard Manager - Inventory Report') : tr('Keyboard Manager - Bestandsliste', 'Keyboard Manager - Inventory List'),
      createdAt: new Date().toISOString(),
      appVersion: VERSION,
      scopeLabel: options.scope === 'all' ? tr('Kompletter Bestand', 'Complete inventory') : tr('Aktueller Bereich: ', 'Current section: ') + sections[0].title,
      filterLabel: options.filtered ? tr('Aktuelle Filter angewendet', 'Current filters applied') : tr('Alle Einträge, Filter nicht angewendet', 'All entries, filters not applied'),
      includeImages: Boolean(options.includeImages && options.format === 'pdf'),
      summary: sections.map(section => ({ key: section.key, label: section.title, count: section.rows.length })),
      sections
    };
  }

  function updateOptions() {
    const isPdf = document.getElementById('inventoryExportFormat').value === 'pdf';
    const images = document.getElementById('inventoryExportImages');
    images.disabled = !isPdf || state.inventoryExport.busy;
    if (!isPdf) images.checked = false;
    document.getElementById('inventoryExportImagesChoice').style.opacity = isPdf ? '1' : '.55';
    document.getElementById('inventoryExportHint').textContent = isPdf
      ? tr('PDF erstellt einen druckbaren A4-Bericht im Querformat. Tabellenköpfe und Seitenzahlen werden automatisch eingefügt.', 'PDF creates a printable A4 landscape report. Table headers and page numbers are added automatically.')
      : tr('Excel erstellt eine Arbeitsmappe mit Übersicht und einem Tabellenblatt je Bestandsart.', 'Excel creates a workbook with a summary and one worksheet per inventory category.');
  }

  function setBusy(busy) {
    state.inventoryExport.busy = busy;
    for (const id of ['inventoryExportFormat', 'inventoryExportScope', 'inventoryExportFiltered', 'inventoryExportImages', 'inventoryExportCancel', 'inventoryExportClose', 'inventoryExportStart']) {
      document.getElementById(id).disabled = busy;
    }
    document.getElementById('inventoryExportStatus').textContent = busy ? tr('Export wird vorbereitet…', 'Preparing export…') : '';
    updateOptions();
  }

  function openDialog() {
    if (state.inventoryExport.open || state.inventoryExport.busy) return;
    state.inventoryExport.open = true;
    state.inventoryExport.previousFocus = document.activeElement;
    document.getElementById('inventoryExportFormat').value = 'pdf';
    document.getElementById('inventoryExportScope').value = 'all';
    document.getElementById('inventoryExportFiltered').checked = true;
    document.getElementById('inventoryExportImages').checked = false;
    setBusy(false);
    const back = document.getElementById('inventoryExportBack');
    back.classList.add('open');
    back.setAttribute('aria-hidden', 'false');
    applyLanguage(back);
    document.getElementById('inventoryExportFormat').focus();
  }

  function closeDialog() {
    if (!state.inventoryExport.open || state.inventoryExport.busy) return;
    state.inventoryExport.open = false;
    const back = document.getElementById('inventoryExportBack');
    back.classList.remove('open');
    back.setAttribute('aria-hidden', 'true');
    state.inventoryExport.previousFocus?.focus?.();
    state.inventoryExport.previousFocus = null;
  }

  async function startExport() {
    if (state.inventoryExport.busy) return;
    const options = {
      format: document.getElementById('inventoryExportFormat').value,
      scope: document.getElementById('inventoryExportScope').value,
      filtered: document.getElementById('inventoryExportFiltered').checked,
      includeImages: document.getElementById('inventoryExportImages').checked
    };
    setBusy(true);
    try {
      const saved = await window.api.exportInventory(await createPayload(options));
      setBusy(false);
      if (saved) {
        closeDialog();
        toast('Bestandsexport gespeichert');
      }
    } catch (error) {
      setBusy(false);
      alert('Bestandsexport konnte nicht gespeichert werden: ' + (error?.message || error));
    }
  }

  document.getElementById('btnInventoryExport').addEventListener('click', () => { if (hasDesktopApi()) openDialog(); });
  document.getElementById('inventoryExportFormat').addEventListener('change', updateOptions);
  document.getElementById('inventoryExportClose').addEventListener('click', closeDialog);
  document.getElementById('inventoryExportCancel').addEventListener('click', closeDialog);
  document.getElementById('inventoryExportStart').addEventListener('click', startExport);
  document.getElementById('inventoryExportBack').addEventListener('click', event => { if (event.target.id === 'inventoryExportBack') closeDialog(); });
  window.addEventListener('keydown', event => {
    if (state.inventoryExport.open && event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
    }
  });
})();
