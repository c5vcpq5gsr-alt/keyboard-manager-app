const path = require('path');
const { app } = require('electron');

app.setPath('userData', path.join(app.getPath('temp'), 'keyboard-manager-window-close-test'));

let uncaughtError = null;
process.on('uncaughtException', error => {
  uncaughtError = error;
});

app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', () => {
    window.once('closed', () => {
      setTimeout(() => {
        if (uncaughtError) {
          console.error(uncaughtError);
          app.exit(1);
          return;
        }
        console.log('window close integration ok');
        app.exit(0);
      }, 250);
    });
    window.close();
  });
});

require('../main.js');
