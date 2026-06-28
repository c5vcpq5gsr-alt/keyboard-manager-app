const path = require('path');
const { app } = require('electron');

app.setPath('userData', path.join(app.getPath('temp'), `keyboard-manager-photo-large-view-test-${process.pid}-${Date.now()}`));

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 3000;
          canvas.height = 2000;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const source = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
          const file = new File([source], 'large-test.jpg', {type:'image/jpeg'});
          const normalized = await normalizePhoto(file);
          const dataUrl = await blobToDataUrl(normalized.blob);
          const id = uid();
          await storePut('photos', {id, boardId:'large-view-test', name:file.name, type:normalized.blob.type, dataUrl, width:normalized.width, height:normalized.height, addedAt:Date.now()});
          const board = {id:'large-view-test', name:'Large View Test', manufacturer:'', format:'', plate:'', pcb:'', keycaps:'', stabs:'', switches:'', remark:'', photoIds:[id], mainPhotoId:id, createdAt:Date.now(), updatedAt:Date.now()};
          state.boards=[board];
          openSpotlight(board.id);
          await openLargePhoto();
          const opened = document.getElementById('largeBack').classList.contains('open');
          await closeLargePhoto();
          const closed = !document.getElementById('largeBack').classList.contains('open');
          return {width:normalized.width,height:normalized.height,resized:normalized.resized,opened,closed};
        })()
      `);
      if (result.width !== 1620 || result.height !== 1080 || !result.resized || !result.opened || !result.closed) {
        throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
      }
      console.log('photo normalization and large view integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
