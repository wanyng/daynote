'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('daynote', {
  read: () => ipcRenderer.sendSync('state:read'),
  save: (state, revision) => ipcRenderer.sendSync('state:save', { state, revision }),
  onState: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('state:changed', listener); return () => ipcRenderer.removeListener('state:changed', listener); },
  window: action => ipcRenderer.send('window:action', action),
  settings: () => ipcRenderer.invoke('settings:read'),
  setPin: value => ipcRenderer.invoke('settings:pin', value),
  chooseStorage: () => ipcRenderer.invoke('storage:choose'),
  openStorage: () => ipcRenderer.invoke('storage:open'),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  confirmDelete: title => ipcRenderer.invoke('task:confirm-delete', title)
});
