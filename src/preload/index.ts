import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type PetSizePreset = 'small' | 'medium' | 'large'
type ActionFrequency = 'calm' | 'normal' | 'lively'

type PetState = {
  x?: number
  y?: number
  sizePreset?: PetSizePreset
  configPath: string
  petScale: number
  singleClickEnabled: boolean
  doubleClickMenuEnabled: boolean
  randomActionEnabled: boolean
  autoSleepEnabled: boolean
  dialogueEnabled: boolean
  alwaysOnTop: boolean
  settingsVisible: boolean
  actionFrequency: ActionFrequency
}

type PetAppEntry = {
  name: string
  type?: 'app' | 'url' | 'app_or_url'
  path?: string
  fallbackUrl?: string
}

const petApi = {
  getState: (): Promise<PetState> => ipcRenderer.invoke('pet:get-state'),
  listApps: (): Promise<{ apps: PetAppEntry[]; configPath: string }> =>
    ipcRenderer.invoke('pet:list-apps'),
  launchApp: (entry: PetAppEntry): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('pet:launch-app', entry),
  moveWindow: (x: number, y: number): Promise<PetState> => ipcRenderer.invoke('pet:move-window', x, y),
  setSizePreset: (sizePreset: PetSizePreset): Promise<PetState> =>
    ipcRenderer.invoke('pet:set-size-preset', sizePreset),
  updateState: (patch: Partial<PetState>): Promise<PetState> => ipcRenderer.invoke('pet:update-state', patch),
  setMouseIgnore: (ignore: boolean): Promise<void> => ipcRenderer.invoke('pet:set-mouse-ignore', ignore),
  hide: (): Promise<void> => ipcRenderer.invoke('pet:hide'),
  quit: (): Promise<void> => ipcRenderer.invoke('pet:quit')
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('pet', petApi)
} else {
  // @ts-ignore exposed in dev fallback
  window.electron = electronAPI
  // @ts-ignore exposed in dev fallback
  window.pet = petApi
}
