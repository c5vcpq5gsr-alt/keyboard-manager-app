const path = require('path');
const { app } = require('electron');

app.setPath('userData', path.join(app.getPath('temp'), `keyboard-manager-migration-test-${Date.now()}`));

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          const canvas=document.createElement('canvas');
          canvas.width=3000; canvas.height=2000;
          canvas.getContext('2d').fillRect(0,0,3000,2000);
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
          const board={id:'legacy-board',name:'Legacy Board',manufacturer:'',format:'',plate:'',pcb:'',keycaps:'',stabs:'',switches:'',remark:'',photoIds:['legacy-photo'],mainPhotoId:'legacy-photo',createdAt:1,updatedAt:1};
          const db=await openDB();
          await new Promise((resolve,reject)=>{
            const tx=db.transaction(['meta','boards','photos'],'readwrite');
            tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
            tx.objectStore('meta').put({key:'app',value:{meta:{version:'legacy'},lists:state.lists,gallery:state.gallery}});
            tx.objectStore('boards').put(board);
            tx.objectStore('photos').put({id:'legacy-photo',boardId:'legacy-board',name:'legacy.jpg',type:'image/jpeg',blob,addedAt:1});
          });
          db.close();
          const migrated=await migrateLegacyStorageIfNeeded(true);
          const readBoard=await storeGet('boards','legacy-board');
          const readPhoto=await storeGet('photos','legacy-photo');
          return {migrated,name:readBoard?.name,width:readPhoto?.width,height:readPhoto?.height,hasDataUrl:readPhoto?.dataUrl?.startsWith('data:image/jpeg;base64,')};
        })()
      `);
      if (!result.migrated || result.name !== 'Legacy Board' || result.width !== 1620 || result.height !== 1080 || !result.hasDataUrl) {
        throw new Error(`Unexpected migration result: ${JSON.stringify(result)}`);
      }
      console.log('legacy IndexedDB migration integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
