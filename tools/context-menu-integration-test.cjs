const path = require('path');
const { app, Menu } = require('electron');

app.setPath('userData', path.join(app.getPath('temp'), `keyboard-manager-context-menu-test-${Date.now()}`));

const capturedTemplates = [];

function params (overrides = {}) {
  return {
    isEditable: false,
    selectionText: '',
    editFlags: {
      canUndo: false,
      canRedo: false,
      canCut: false,
      canCopy: false,
      canPaste: false,
      canSelectAll: false
    },
    ...overrides
  };
}

app.on('browser-window-created', (_event, window) => {
  Menu.buildFromTemplate = template => {
    capturedTemplates.push(template);
    return { popup: () => {} };
  };
  window.webContents.once('did-finish-load', () => {
    try {
      capturedTemplates.length = 0;

      window.webContents.emit('context-menu', {}, params({
        selectionText: 'Keyboard Manager',
        editFlags: { canCopy: true }
      }));
      window.webContents.emit('context-menu', {}, params({
        isEditable: true,
        editFlags: {
          canUndo: true,
          canRedo: false,
          canCut: true,
          canCopy: true,
          canPaste: true,
          canSelectAll: true
        }
      }));
      window.webContents.emit('context-menu', {}, params());

      if (capturedTemplates.length !== 2) {
        throw new Error(`Expected 2 context menus, got ${capturedTemplates.length}`);
      }

      const selectionMenu = capturedTemplates[0];
      if (selectionMenu.length !== 1 || selectionMenu[0].role !== 'copy' || !selectionMenu[0].enabled) {
        throw new Error(`Unexpected selection menu: ${JSON.stringify(selectionMenu)}`);
      }

      const editableMenu = capturedTemplates[1];
      const editableRoles = editableMenu.filter(item => item.role).map(item => item.role);
      const expectedRoles = ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'];
      if (JSON.stringify(editableRoles) !== JSON.stringify(expectedRoles)) {
        throw new Error(`Unexpected editable menu roles: ${JSON.stringify(editableRoles)}`);
      }
      if (editableMenu.find(item => item.role === 'redo').enabled) {
        throw new Error('Redo should be disabled when Chromium reports canRedo=false');
      }

      console.log('context menu integration ok');
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../main.js');
