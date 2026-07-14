const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  exportBackup: (data) => ipcRenderer.invoke('backup:export', data),
  exportInventory: (data) => ipcRenderer.invoke('inventory:export', data),
  openBackup: () => ipcRenderer.invoke('backup:open'),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  storage: {
    get: (store, key) => ipcRenderer.invoke('storage:get', store, key),
    put: (store, value) => ipcRenderer.invoke('storage:put', store, value),
    delete: (store, key) => ipcRenderer.invoke('storage:delete', store, key),
    all: (store) => ipcRenderer.invoke('storage:all', store),
    photosByBoard: (boardId) => ipcRenderer.invoke('storage:photos-by-board', boardId),
    photosByOwner: (ownerType, ownerId) => ipcRenderer.invoke('storage:photos-by-owner', ownerType, ownerId),
    replaceAll: (payload) => ipcRenderer.invoke('storage:replace-all', payload),
    info: () => ipcRenderer.invoke('storage:info')
  }
});
