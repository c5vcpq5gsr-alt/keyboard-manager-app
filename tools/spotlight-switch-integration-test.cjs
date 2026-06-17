const path = require('path');
const { app } = require('electron');

app.setPath('userData', path.join(app.getPath('temp'), `keyboard-manager-spotlight-switch-test-${Date.now()}`));

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          const waitForReady = async () => {
            const start = Date.now();
            while (!state.ready) {
              if (Date.now() - start > 3000) throw new Error('App did not become ready');
              await new Promise(resolve => setTimeout(resolve, 20));
            }
          };
          await waitForReady();

          const makePhoto = async (id, boardId, color) => {
            const canvas=document.createElement('canvas');
            canvas.width=32; canvas.height=24;
            const ctx=canvas.getContext('2d');
            ctx.fillStyle=color;
            ctx.fillRect(0,0,32,24);
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
            await storePut('photos',{id,boardId,name:id+'.png',type:'image/png',width:32,height:24,addedAt:1,dataUrl:await blobToDataUrl(blob)});
          };

          await makePhoto('slow-photo','slow-board','#ff0000');
          await makePhoto('fast-photo','fast-board','#00ff00');
          state.boards=[
            {id:'slow-board',name:'Slow Board',photoIds:['slow-photo'],mainPhotoId:'slow-photo',createdAt:1,updatedAt:1},
            {id:'fast-board',name:'Fast Board',photoIds:['fast-photo'],mainPhotoId:'fast-photo',createdAt:1,updatedAt:1}
          ];

          const originalStoreGet=storeGet;
          storeGet=async (store,key)=>{
            if(store==='photos' && key==='slow-photo') await new Promise(resolve=>setTimeout(resolve,150));
            return originalStoreGet(store,key);
          };

          openSpotlight('slow-board');
          await new Promise(resolve=>setTimeout(resolve,10));
          openSpotlight('fast-board');
          await new Promise(resolve=>setTimeout(resolve,250));

          return {
            title:document.getElementById('spotTitle').textContent,
            body:document.getElementById('spotBody').textContent,
            foot:document.getElementById('spotFoot').textContent
          };
        })()
      `);
      if (result.title !== 'Spotlight: Fast Board' || !result.foot.includes('Fast Board') || result.body.includes('Slow Board')) {
        throw new Error(`Unexpected Spotlight result: ${JSON.stringify(result)}`);
      }
      console.log('spotlight fast-switch integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
