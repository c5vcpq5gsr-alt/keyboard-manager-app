const path = require('path');
const { app } = require('electron');

app.setPath('userData', path.join(app.getPath('temp'), `keyboard-manager-board-link-autofill-test-${Date.now()}`));

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          for(let i=0;i<100 && !state.ready;i++) await new Promise(resolve=>setTimeout(resolve,50));
          if(!state.ready) throw new Error('App did not become ready');
          const keycapSet={id:'autofill-keycaps',name:'Autofill Keycaps',manufacturer:'',profile:'',material:'',status:'owned',kits:[],photoIds:[],mainPhotoId:'',createdAt:1,updatedAt:1};
          const switchSet={id:'autofill-switches',name:'Autofill Switches',switchType:'Linear',operatingForce:'55g',pins:'5',quantity:90,mountedQuantity:0,installations:[],photoIds:[],mainPhotoId:'',createdAt:1,updatedAt:1};
          const switchVariant={id:'autofill-switches-heavy',name:'Autofill Switches',switchType:'Linear',operatingForce:'60g',pins:'5',quantity:70,mountedQuantity:0,installations:[],photoIds:[],mainPhotoId:'',createdAt:1,updatedAt:1};
          state.keycapSets=[keycapSet];
          state.switchSets=[switchSet, switchVariant];
          await storePut('keycapSets', keycapSet);
          await storePut('switchSets', switchSet);
          await storePut('switchSets', switchVariant);
          newDraft();
          document.getElementById('f_name').value='Autofill Board';
          document.getElementById('f_keycapSetId').value='autofill-keycaps';
          document.getElementById('f_keycapSetId').dispatchEvent(new Event('change'));
          document.getElementById('f_addSwitchSetLink').click();
          const boardSwitchOptions=Array.from(document.querySelectorAll('#f_switchSetLinks option')).map(option=>option.textContent);
          let switchRows=Array.from(document.querySelectorAll('#f_switchSetLinks .installRow'));
          switchRows[0].querySelector('[data-a="switchSet"]').value='autofill-switches';
          switchRows[0].querySelector('[data-a="switchSet"]').dispatchEvent(new Event('change'));
          document.getElementById('f_addSwitchSetLink').click();
          switchRows=Array.from(document.querySelectorAll('#f_switchSetLinks .installRow'));
          switchRows[1].querySelector('[data-a="switchSet"]').value='autofill-switches-heavy';
          switchRows[1].querySelector('[data-a="switchSet"]').dispatchEvent(new Event('change'));
          const formKeycaps=document.getElementById('f_keycaps').value;
          const formSwitches=document.getElementById('f_switches').value;
          await saveDraft();
          const saved=state.boards.find(board=>board.name==='Autofill Board');
          return {
            formKeycaps,
            formSwitches,
            savedKeycaps:saved?.keycaps,
            savedSwitches:saved?.switches,
            savedKeycapSetId:saved?.keycapSetId,
            savedSwitchSetId:saved?.switchSetId,
            savedSwitchSetIds:saved?.switchSetIds,
            switchOptionLabels:boardSwitchOptions
          };
        })()
      `);
      if (
        result.formKeycaps !== 'Autofill Keycaps' ||
        result.formSwitches !== 'Autofill Switches, Autofill Switches' ||
        result.savedKeycaps !== 'Autofill Keycaps' ||
        result.savedSwitches !== 'Autofill Switches, Autofill Switches' ||
        result.savedKeycapSetId !== 'autofill-keycaps' ||
        result.savedSwitchSetId !== 'autofill-switches' ||
        !Array.isArray(result.savedSwitchSetIds) ||
        result.savedSwitchSetIds.length !== 2 ||
        !result.savedSwitchSetIds.includes('autofill-switches-heavy') ||
        !result.switchOptionLabels.includes('Autofill Switches (Linear · 55g · 5 PIN)') ||
        !result.switchOptionLabels.includes('Autofill Switches (Linear · 60g · 5 PIN)')
      ) {
        throw new Error(`Unexpected autofill result: ${JSON.stringify(result)}`);
      }
      console.log('board link autofill integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
