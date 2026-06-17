const fs = require('fs/promises');
const path = require('path');
const AdmZip = require('adm-zip');
const { app, dialog } = require('electron');

const outputPath = path.join(app.getPath('temp'), 'keyboard-manager-export-integration-test.zip');
const legacyPath = path.join(app.getPath('temp'), 'keyboard-manager-legacy-import-test.json');
let openPath = outputPath;

dialog.showSaveDialog = async () => ({ filePath: outputPath });
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [openPath] });

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const saved = await window.webContents.executeJavaScript(`
        window.api.exportBackup({
          meta:{version:'test'},lists:{},gallery:{},
          boards:[{id:'integration-test',photoIds:['integration-photo'],mainPhotoId:'integration-photo'}],
          photos:[{id:'integration-photo',boardId:'integration-test',name:'photo.png',type:'image/png',width:1,height:1,addedAt:1,dataUrl:'data:image/png;base64,iVBORw0KGgo='}]
        })
      `);
      const zip = new AdmZip(outputPath);
      const manifest = JSON.parse(zip.readAsText('manifest.json'));
      const photo = zip.getEntry('photos/integration-photo.png');
      const imported = await window.webContents.executeJavaScript('window.api.openBackup()');
      const importedContent = JSON.parse(imported.content);
      await fs.writeFile(legacyPath, JSON.stringify({schemaVersion:2,lists:{},boards:[],photos:[]}), 'utf8');
      openPath = legacyPath;
      const legacy = await window.webContents.executeJavaScript('window.api.openBackup()');
      if (!saved || manifest.schemaVersion !== 3 || manifest.boards?.[0]?.id !== 'integration-test' || !photo || imported.kind !== 'zip' || !importedContent.photos?.[0]?.dataUrl || legacy.kind !== 'json') {
        throw new Error('Export result did not match the requested payload');
      }
      console.log('export integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
