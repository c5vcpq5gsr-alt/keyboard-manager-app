const path = require('path');
const { app } = require('electron');

app.setPath('userData', path.join(app.getPath('temp'), `keyboard-manager-keycap-test-${Date.now()}`));

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          for (let i = 0; i < 100; i++) {
            if (state.ready && document.getElementById('kc_name')) break;
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          setEntityView('erf','keycaps');
          document.getElementById('kc_name').value = 'GMK Integration';
          document.getElementById('kc_manufacturer').value = 'GMK';
          document.getElementById('kc_profile').value = 'Cherry/CYL';
          document.getElementById('kc_material').value = 'ABS';
          document.getElementById('kc_kits').value = 'Base\\nSpacebars';
          await saveKeycapDraft();
          setEntityView('ueb','keycaps');
          const editButton = document.querySelector('#keycapTbody [data-a="edit"]');
          editButton.click();
          const editorTitle = document.getElementById('keycapEditorTitle').textContent;
          setEntityView('gal','keycaps');
          const galleryVisible = getComputedStyle(document.getElementById('keycapGalleryPanel')).display === 'grid';
          const boardGalleryHidden = getComputedStyle(document.getElementById('boardGalleryPanel')).display === 'none';
          const card = document.querySelector('#keycapCards .gcard');
          card.click();
          await new Promise(resolve => setTimeout(resolve, 60));
          const spotlightOpen = document.getElementById('spotBack').classList.contains('open');
          const spotlightTitle = document.getElementById('spotTitle').textContent;
          await closeSpotlight();
          const spotlightClosed = !document.getElementById('spotBack').classList.contains('open');
          setEntityView('erf','artisans');
          document.getElementById('art_name').value = 'Happy Feet Devoura';
          document.getElementById('art_manufacturer').value = 'Alpha Keycaps';
          document.getElementById('art_profile').value = 'MX';
          document.getElementById('art_material').value = 'Resin';
          document.getElementById('art_tags').value = 'Devoura\\nColorway';
          await saveArtisanDraft();
          setEntityView('ueb','artisans');
          const artisanEditButton = document.querySelector('#artisanTbody [data-a="edit"]');
          artisanEditButton.click();
          const artisanEditorTitle = document.getElementById('artisanEditorTitle').textContent;
          setEntityView('gal','artisans');
          const artisanGalleryVisible = getComputedStyle(document.getElementById('artisanGalleryPanel')).display === 'grid';
          const artisanCard = document.querySelector('#artisanCards .gcard');
          artisanCard.click();
          await new Promise(resolve => setTimeout(resolve, 60));
          const artisanSpotlightOpen = document.getElementById('spotBack').classList.contains('open');
          const artisanSpotlightTitle = document.getElementById('spotTitle').textContent;
          await closeSpotlight();
          const artisanSpotlightClosed = !document.getElementById('spotBack').classList.contains('open');
          await setLanguage('en');
          await new Promise(resolve => setTimeout(resolve, 80));
          const langEn = {
            lang: state.language,
            button: document.getElementById('btnLanguage').textContent,
            overview: document.getElementById('sideUeb').textContent,
            exportText: document.getElementById('btnExport').textContent,
            resetText: document.getElementById('btnResetArtisanGalleryFilters').textContent
          };
          await setLanguage('de');
          await new Promise(resolve => setTimeout(resolve, 80));
          const langDe = {
            lang: state.language,
            button: document.getElementById('btnLanguage').textContent,
            overview: document.getElementById('sideUeb').textContent,
            exportText: document.getElementById('btnExport').textContent,
            resetText: document.getElementById('btnResetArtisanGalleryFilters').textContent
          };
          for (let i = 0; i < 5; i++) {
            await setLanguage('en');
            await new Promise(resolve => setTimeout(resolve, 30));
            await setLanguage('de');
            await new Promise(resolve => setTimeout(resolve, 30));
          }
          await setLanguage('en');
          await new Promise(resolve => setTimeout(resolve, 80));
          const repeatedEnglishFilter = document.querySelector('#artisanGalFilters [style*="font-weight"]').textContent;
          const repeatedEnglishReset = document.getElementById('btnResetArtisanGalleryFilters').textContent;
          await setLanguage('de');
          setEntityView('ueb','keycaps');
          const keycapOverviewSort = document.getElementById('kcFilter_sort').value;
          state.keycapFilters.sort = 'name_asc';
          document.getElementById('btnResetKeycapFilters').click();
          const keycapOverviewResetSort = document.getElementById('kcFilter_sort').value;
          setEntityView('gal','keycaps');
          const keycapGallerySort = document.getElementById('kcGalFilter_sort').value;
          state.keycapFilters.sort = 'name_asc';
          document.getElementById('btnResetKeycapGalleryFilters').click();
          const keycapGalleryResetSort = document.getElementById('kcGalFilter_sort').value;
          setEntityView('ueb','artisans');
          const artisanOverviewSort = document.getElementById('artFilter_sort').value;
          state.artisanFilters.sort = 'name_asc';
          document.getElementById('btnResetArtisanFilters').click();
          const artisanOverviewResetSort = document.getElementById('artFilter_sort').value;
          setEntityView('gal','artisans');
          const artisanGallerySort = document.getElementById('artGalFilter_sort').value;
          state.artisanFilters.sort = 'name_asc';
          document.getElementById('btnResetArtisanGalleryFilters').click();
          const artisanGalleryResetSort = document.getElementById('artGalFilter_sort').value;
          return {editorTitle, galleryVisible, boardGalleryHidden, spotlightOpen, spotlightTitle, spotlightClosed, artisanEditorTitle, artisanGalleryVisible, artisanSpotlightOpen, artisanSpotlightTitle, artisanSpotlightClosed, langEn, langDe, repeatedEnglishFilter, repeatedEnglishReset, keycapOverviewSort, keycapOverviewResetSort, keycapGallerySort, keycapGalleryResetSort, artisanOverviewSort, artisanOverviewResetSort, artisanGallerySort, artisanGalleryResetSort};
        })()
      `);
      if (
        result.editorTitle !== 'Keycap-Set bearbeiten' ||
        !result.galleryVisible ||
        !result.boardGalleryHidden ||
        !result.spotlightOpen ||
        !result.spotlightTitle.includes('GMK Integration') ||
        !result.spotlightClosed ||
        result.artisanEditorTitle !== 'Artisan bearbeiten' ||
        !result.artisanGalleryVisible ||
        !result.artisanSpotlightOpen ||
        !result.artisanSpotlightTitle.includes('Happy Feet Devoura') ||
        !result.artisanSpotlightClosed ||
        result.langEn.lang !== 'en' ||
        result.langEn.button !== 'EN' ||
        !result.langEn.overview.includes('Overview') ||
        result.langEn.exportText !== 'Create ZIP backup' ||
        result.langEn.resetText !== 'Reset filters' ||
        result.langDe.lang !== 'de' ||
        result.langDe.button !== 'DE' ||
        !result.langDe.overview.includes('Übersicht') ||
        result.langDe.exportText !== 'ZIP-Backup erstellen' ||
        result.langDe.resetText !== 'Filter zurücksetzen' ||
        result.repeatedEnglishFilter !== 'Filters' ||
        result.repeatedEnglishReset !== 'Reset filters' ||
        result.keycapOverviewSort !== 'manufacturer_asc' ||
        result.keycapOverviewResetSort !== 'manufacturer_asc' ||
        result.keycapGallerySort !== 'manufacturer_asc' ||
        result.keycapGalleryResetSort !== 'manufacturer_asc' ||
        result.artisanOverviewSort !== 'manufacturer_asc' ||
        result.artisanOverviewResetSort !== 'manufacturer_asc' ||
        result.artisanGallerySort !== 'manufacturer_asc' ||
        result.artisanGalleryResetSort !== 'manufacturer_asc'
      ) {
        throw new Error(`Unexpected keycap result: ${JSON.stringify(result)}`);
      }
      console.log('collection management integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
