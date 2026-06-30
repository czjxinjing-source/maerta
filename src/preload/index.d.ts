import { ElectronAPI } from '@electron-toolkit/preload'

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

type PetApi = {
  getState: () => Promise<PetState>
  listApps: () => Promise<{ apps: PetAppEntry[]; configPath: string }>
  launchApp: (entry: PetAppEntry) => Promise<{ ok: boolean; message: string }>
  moveWindow: (x: number, y: number) => Promise<PetState>
  setSizePreset: (sizePreset: PetSizePreset) => Promise<PetState>
  updateState: (patch: Partial<PetState>) => Promise<PetState>
  setMouseIgnore: (ignore: boolean) => Promise<void>
  hide: () => Promise<void>
  quit: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    pet: PetApi
  }
}
