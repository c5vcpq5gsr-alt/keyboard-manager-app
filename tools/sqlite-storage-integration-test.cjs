const fs = require('fs/promises');
const path = require('path');
const { app } = require('electron');

const userDataPath = path.join(app.getPath('temp'), `keyboard-manager-sqlite-test-${Date.now()}`);
app.setPath('userData', userDataPath);

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          const canvas=document.createElement('canvas');
          canvas.width=32; canvas.height=24;
          canvas.getContext('2d').fillRect(0,0,32,24);
          const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          const dataUrl=await blobToDataUrl(blob);
          const board={id:'sqlite-board',name:'SQLite Board',manufacturer:'',format:'',plate:'',pcb:'',keycaps:'',stabs:'',switches:'',remark:'',photoIds:['sqlite-photo'],mainPhotoId:'sqlite-photo',createdAt:1,updatedAt:1};
          await storePut('meta',{key:'app',value:{meta:{version:'test'},lists:{},gallery:{}}});
          await storePut('boards',board);
          await storePut('photos',{id:'sqlite-photo',boardId:'sqlite-board',name:'photo.png',type:'image/png',width:32,height:24,addedAt:1,dataUrl});
          const readBoard=await storeGet('boards','sqlite-board');
          const readPhoto=await storeGet('photos','sqlite-photo');
          const byBoard=await storeGetAllByBoardId('sqlite-board');
          return {boardName:readBoard.name,photoPrefix:readPhoto.dataUrl.slice(0,22),byBoard:byBoard.length};
        })()
      `);
      const databaseExists = await fs.stat(path.join(userDataPath, 'keyboard-manager.sqlite')).then(() => true);
      const photoFiles = await fs.readdir(path.join(userDataPath, 'photos'));
      if (!databaseExists || result.boardName !== 'SQLite Board' || result.photoPrefix !== 'data:image/png;base64,' || result.byBoard !== 1 || photoFiles.length !== 1) {
        throw new Error(`Unexpected SQLite result: ${JSON.stringify({ result, databaseExists, photoFiles })}`);
      }
      console.log('sqlite storage integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
