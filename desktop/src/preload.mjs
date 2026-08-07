import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('dominionDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron
}));
