const path = require('path');
const { app } = require('electron');

app.setPath('userData', path.join(app.getPath('temp'), `keyboard-manager-switch-test-${Date.now()}`));

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          for(let i=0;i<100 && !state.ready;i++) await new Promise(resolve=>setTimeout(resolve,50));
          if(!state.ready) throw new Error('App did not become ready');
          window.confirm=()=>true;
          const macroSwitch={id:'macro-switch',name:'Macro Switch',switchType:'Clicky',pins:'5',quantity:10,mountedQuantity:3,installations:[{boardId:'switch-board',quantity:3}],photoIds:[],mainPhotoId:'',createdAt:1,updatedAt:1};
          const board={id:'switch-board',name:'Switch Test Board',manufacturer:'',format:'65%',plate:'',pcb:'',keycaps:'',keycapSetId:'',stabs:'',switches:'Macro Switch',switchSetId:'macro-switch',switchSetIds:['macro-switch'],remark:'',photoIds:[],mainPhotoId:'',createdAt:1,updatedAt:1};
          const secondBoard={id:'switch-board-2',name:'Second Switch Board',manufacturer:'',format:'60%',plate:'',pcb:'',keycaps:'',keycapSetId:'',stabs:'',switches:'',switchSetId:'',remark:'',photoIds:[],mainPhotoId:'',createdAt:1,updatedAt:1};
          state.boards=[board, secondBoard];
          state.switchSets=[macroSwitch];
          await storePut('boards', board);
          await storePut('boards', secondBoard);
          await storePut('switchSets', macroSwitch);
          renderSelects();
          setEntityView('erf','switches');
          const hasOldNameDefault=Array.from(document.getElementById('sw_name').options).some(option=>option.value==='Gateron Oil King');
          const hasLinearType=Array.from(document.getElementById('sw_switchType').options).some(option=>option.value==='Linear');
          ensureInList('switchNames','Gateron Oil King');
          ensureInList('switchOperatingForces','55g');
          renderSwitchSelects();
          document.getElementById('sw_name').value='Gateron Oil King';
          document.getElementById('sw_switchType').value='Linear';
          document.getElementById('sw_topHousingMaterial').value='Nylon';
          document.getElementById('sw_bottomHousingMaterial').value='PC';
          document.getElementById('sw_stemMaterial').value='POM';
          document.getElementById('sw_springType').value='Long spring';
          document.getElementById('sw_operatingForce').value='55g';
          document.getElementById('sw_quantity').value='90';
          document.getElementById('sw_notes').value='Full switch notes';
          document.getElementById('sw_notes').dispatchEvent(new Event('input'));
          document.getElementById('sw_bottomOutForce_new').value='63g';
          document.getElementById('sw_bottomOutForce_new').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
          const afterNewBottomOut={
            name:document.getElementById('sw_name').value,
            switchType:document.getElementById('sw_switchType').value,
            topHousingMaterial:document.getElementById('sw_topHousingMaterial').value,
            bottomHousingMaterial:document.getElementById('sw_bottomHousingMaterial').value,
            stemMaterial:document.getElementById('sw_stemMaterial').value,
            springType:document.getElementById('sw_springType').value,
            operatingForce:document.getElementById('sw_operatingForce').value,
            bottomOutForce:document.getElementById('sw_bottomOutForce').value
          };
          document.getElementById('sw_addInstallation').click();
          let rows=Array.from(document.querySelectorAll('#sw_installations .installRow'));
          rows[0].querySelector('[data-a="board"]').value='switch-board';
          rows[0].querySelector('[data-a="board"]').dispatchEvent(new Event('change'));
          rows[0].querySelector('[data-a="qty"]').value='65';
          rows[0].querySelector('[data-a="qty"]').dispatchEvent(new Event('input'));
          document.getElementById('sw_addInstallation').click();
          rows=Array.from(document.querySelectorAll('#sw_installations .installRow'));
          rows[1].querySelector('[data-a="board"]').value='switch-board-2';
          rows[1].querySelector('[data-a="board"]').dispatchEvent(new Event('change'));
          rows[1].querySelector('[data-a="qty"]').value='25';
          rows[1].querySelector('[data-a="qty"]').dispatchEvent(new Event('input'));
          const hasHeChoice=Array.from(document.querySelectorAll('input[name="sw_pins"]')).some(input=>input.value==='HE');
          setRadioValue('sw_pins','HE');
          setRadioValue('sw_ledDiffuser','yes');
          setRadioValue('sw_factoryLubed','yes');
          state.switchDraft.importedBoardText='Second Switch Board (25)';
          state.switchDraft.importedBoardAllocations=[{board:'Second Switch Board',quantity:25}];
          state.switchDraft.importSource='Switch-Bestand.ods';
          state.switchDraft.importRow=3;
          state.switchDraft.importWarnings=['Board-Summe 25 passt nicht zu Anzahl verbaut 90'];
          await saveSwitchDraft();
          const firstSaved=state.switchSets.find(set=>set.name==='Gateron Oil King');
          const firstInstallations=firstSaved?.installations||[];
          editSwitchSet(firstSaved.id);
          const editRows=Array.from(document.querySelectorAll('#sw_installations .installRow'));
          editRows[1].querySelector('[data-a="remove"]').click();
          await saveSwitchDraft();
          setEntityView('ueb','switches');
          const saved=state.switchSets.find(set=>set.name==='Gateron Oil King');
          const macroAfter=state.switchSets.find(set=>set.id==='macro-switch');
          const linkedBoard=state.boards.find(item=>item.id==='switch-board');
          const secondLinkedBoard=state.boards.find(item=>item.id==='switch-board-2');
          const hasSwitchTypeFilter=Boolean(document.getElementById('swFilter_switchType'));
          const hasOperatingForceFilter=Boolean(document.getElementById('swFilter_operatingForce'));
          const hasPinsFilter=Boolean(document.getElementById('swFilter_pins'));
          const hasHeFilter=Array.from(document.getElementById('swFilter_pins').options).some(option=>option.value==='HE' && option.textContent==='HE');
          const hasSearchFilter=Boolean(document.getElementById('swFilter_q'));
          const removedOldFilters=!document.getElementById('swFilter_ledDiffuser') && !document.getElementById('swFilter_factoryLubed');
          state.switchFilters.q='Oil';
          renderSwitches(false);
          const searchHitText=document.getElementById('switchTbody').innerText;
          state.switchFilters.q='No Match';
          renderSwitches(false);
          const searchMissText=document.getElementById('switchTbody').innerText;
          state.switchFilters.q='';
          renderSwitches(false);
          const rowText=document.getElementById('switchTbody').innerText;
          openSwitchSpotlight(saved.id);
          await new Promise(resolve=>setTimeout(resolve,50));
          const spotlightTextBeforeClear=document.getElementById('spotBody').innerText + ' ' + document.getElementById('spotFoot').innerText;
          document.getElementById('spotClearImportWarnings').click();
          await new Promise(resolve=>setTimeout(resolve,100));
          const afterClear=state.switchSets.find(set=>set.id===saved.id);
          const spotlightText=document.getElementById('spotBody').innerText + ' ' + document.getElementById('spotFoot').innerText;
          const normalizedHeImport=await normalizeImport({boards:[],lists:{},switchSets:[{name:'Imported HE Switch',pins:'he'}]});
          return {
            hasOldNameDefault,
            hasLinearType,
            hasHeChoice,
            afterNewBottomOut,
            firstInstallations,
            hasSwitchTypeFilter,
            hasOperatingForceFilter,
            hasPinsFilter,
            hasHeFilter,
            hasSearchFilter,
            removedOldFilters,
            searchHitText,
            searchMissText,
            saved: Boolean(saved),
            switchType: saved?.switchType,
            operatingForce: saved?.operatingForce,
            pins: saved?.pins,
            quantity: saved?.quantity,
            mountedQuantity: saved?.mountedQuantity,
            mountedBoardId: saved?.mountedBoardId,
            installations: saved?.installations,
            boardSwitchSetId: linkedBoard?.switchSetId,
            boardSwitchSetIds: linkedBoard?.switchSetIds,
            boardSwitches: linkedBoard?.switches,
            boardSwitchDisplay: displayBoardSwitches(linkedBoard),
            macroInstallations: macroAfter?.installations,
            secondBoardSwitchSetId: secondLinkedBoard?.switchSetId,
            secondBoardSwitchSetIds: secondLinkedBoard?.switchSetIds,
            secondBoardSwitches: secondLinkedBoard?.switches,
            overview: rowText,
            spotlightTextBeforeClear,
            importWarningsAfterClear: afterClear?.importWarnings,
            spotlightText,
            importedHePins: normalizedHeImport.switchSets[0]?.pins
          };
        })()
      `);
      if (
        result.hasOldNameDefault ||
        !result.hasLinearType ||
        !result.hasHeChoice ||
        !result.hasSwitchTypeFilter ||
        !result.hasOperatingForceFilter ||
        !result.hasPinsFilter ||
        !result.hasHeFilter ||
        !result.hasSearchFilter ||
        !result.removedOldFilters ||
        result.afterNewBottomOut.name !== 'Gateron Oil King' ||
        result.afterNewBottomOut.switchType !== 'Linear' ||
        result.afterNewBottomOut.topHousingMaterial !== 'Nylon' ||
        result.afterNewBottomOut.bottomHousingMaterial !== 'PC' ||
        result.afterNewBottomOut.stemMaterial !== 'POM' ||
        result.afterNewBottomOut.springType !== 'Long spring' ||
        result.afterNewBottomOut.operatingForce !== '55g' ||
        result.afterNewBottomOut.bottomOutForce !== '63g' ||
        !result.searchHitText.includes('Gateron Oil King') ||
        !result.searchMissText.includes('Keine Switches') ||
        !result.saved ||
        !Array.isArray(result.firstInstallations) ||
        result.firstInstallations.length !== 2 ||
        result.switchType !== 'Linear' ||
        result.operatingForce !== '55g' ||
        !result.spotlightTextBeforeClear.includes('Import-Hinweise') ||
        !result.spotlightTextBeforeClear.includes('Board-Summe 25') ||
        result.spotlightText.includes('Second Switch Board (25)') ||
        result.spotlightText.includes('Import-Hinweise') ||
        !Array.isArray(result.importWarningsAfterClear) ||
        result.importWarningsAfterClear.length !== 0 ||
        result.spotlightText.includes('Import-Verteilung') ||
        result.spotlightText.includes('Importquelle') ||
        !result.spotlightText.includes('Bottom-out Force') ||
        !result.spotlightText.includes('63g') ||
        !result.spotlightText.includes('Verfügbar') ||
        !result.spotlightText.includes('25') ||
        !result.spotlightText.includes('Full switch notes') ||
        result.pins !== 'HE' ||
        result.importedHePins !== 'HE' ||
        result.quantity !== 90 ||
        result.mountedQuantity !== 65 ||
        result.mountedBoardId !== 'switch-board' ||
        !Array.isArray(result.installations) ||
        result.installations.length !== 1 ||
        !result.installations.some(item => item.boardId === 'switch-board' && item.quantity === 65) ||
        !result.boardSwitchSetId ||
        !Array.isArray(result.boardSwitchSetIds) ||
        result.boardSwitchSetIds.length !== 2 ||
        !result.boardSwitchSetIds.includes('macro-switch') ||
        !result.boardSwitchSetIds.some(id => id !== 'macro-switch') ||
        !Array.isArray(result.macroInstallations) ||
        !result.macroInstallations.some(item => item.boardId === 'switch-board' && item.quantity === 3) ||
        result.secondBoardSwitchSetId ||
        !result.boardSwitches.includes('Macro Switch') ||
        !result.boardSwitches.includes('Gateron Oil King') ||
        !result.boardSwitchDisplay.includes('Macro Switch') ||
        !result.boardSwitchDisplay.includes('Gateron Oil King') ||
        Array.isArray(result.secondBoardSwitchSetIds) && result.secondBoardSwitchSetIds.length !== 0 ||
        !result.overview.includes('Gateron Oil King') ||
        !result.overview.includes('Linear') ||
        !result.overview.includes('55g') ||
        !result.overview.includes('HE') ||
        result.overview.includes('HE PIN') ||
        !result.spotlightText.includes('HE') ||
        result.spotlightText.includes('HE PIN') ||
        !result.overview.includes('90 / 65 / 25') ||
        !result.overview.includes('Switch Test Board (65)') ||
        result.overview.includes('Second Switch Board (25)') ||
        result.overview.includes('Top: Nylon') ||
        result.overview.includes('Long spring')
      ) {
        throw new Error(`Unexpected switch result: ${JSON.stringify(result)}`);
      }
      console.log('switch collection integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
