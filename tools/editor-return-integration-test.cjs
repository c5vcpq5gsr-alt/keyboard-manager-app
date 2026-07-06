const path = require('path');
const { app } = require('electron');

app.setPath('userData', path.join(app.getPath('temp'), `keyboard-manager-editor-return-test-${Date.now()}`));

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          for (let i = 0; i < 100 && !state.ready; i++) await new Promise(resolve => setTimeout(resolve, 20));
          if (!state.ready) throw new Error('App did not become ready');

          document.body.style.minHeight = '3200px';
          const board = {id:'return-board',name:'Return Board',manufacturer:'',format:'',plate:'',pcb:'',keycaps:'',keycapSetId:'',stabs:'',switches:'',switchSetId:'',switchSetIds:[],remark:'',photoIds:[],mainPhotoId:'',createdAt:1,updatedAt:1};
          const keycap = {...emptyKeycapDraft(), id:'return-keycap', name:'Return Keycap', createdAt:1, updatedAt:1};
          const artisan = {...emptyArtisanDraft(), id:'return-artisan', name:'Return Artisan', createdAt:1, updatedAt:1};
          const switchSet = {...emptySwitchDraft(), id:'return-switch', name:'Return Switch', switchType:'Linear', createdAt:1, updatedAt:1};

          state.boards = [board];
          state.keycapSets = [keycap];
          state.artisanSets = [artisan];
          state.switchSets = [switchSet];
          await storePut('boards', board);
          await storePut('keycapSets', keycap);
          await storePut('artisanSets', artisan);
          await storePut('switchSets', switchSet);
          renderSelects();

          const waitForReturn = async () => {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          };
          const capture = (entity) => ({
            tab: state.tab,
            overviewEntity: state.viewEntities.ueb,
            overviewDisplay: document.getElementById('viewUeb').style.display,
            editorDisplay: document.getElementById('viewErf').style.display,
            scrollY: Math.round(window.scrollY),
            rowFound: Boolean(document.querySelector('[data-overview-entity="'+entity+'"]'))
          });

          const runSave = async (entity, editFn, saveFn) => {
            setEntityView('ueb', entity);
            window.scrollTo(0, 640);
            editFn();
            await saveFn();
            await waitForReturn();
            return capture(entity);
          };

          const runCancel = async (entity, editFn, cancelFn) => {
            setEntityView('ueb', entity);
            window.scrollTo(0, 720);
            editFn();
            await cancelFn();
            await waitForReturn();
            return capture(entity);
          };

          const boardSave = await runSave('boards', () => editExisting('return-board'), saveDraft);
          const keycapSave = await runSave('keycaps', () => editKeycapSet('return-keycap'), saveKeycapDraft);
          const artisanCancel = await runCancel('artisans', () => editArtisanSet('return-artisan'), cancelArtisanEditing);
          const switchCancel = await runCancel('switches', () => editSwitchSet('return-switch'), cancelSwitchEditing);

          return {boardSave, keycapSave, artisanCancel, switchCancel};
        })()
      `);
      for (const [name, value] of Object.entries(result)) {
        const expectedEntity = name.startsWith('board') ? 'boards' : name.startsWith('keycap') ? 'keycaps' : name.startsWith('artisan') ? 'artisans' : 'switches';
        if (
          value.tab !== 'ueb' ||
          value.overviewEntity !== expectedEntity ||
          value.overviewDisplay !== 'block' ||
          value.editorDisplay !== 'none' ||
          !value.rowFound ||
          value.scrollY < 600
        ) {
          throw new Error(`Unexpected editor return for ${name}: ${JSON.stringify(value)}`);
        }
      }
      console.log('editor return integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
