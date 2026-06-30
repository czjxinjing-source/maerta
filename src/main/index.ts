import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell, screen } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

type PetSizePreset = 'small' | 'medium' | 'large'
type ActionFrequency = 'calm' | 'normal' | 'lively'

type PetState = {
  x?: number
  y?: number
  sizePreset: PetSizePreset
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

const WINDOW_SIZE: Record<PetSizePreset, { width: number; height: number }> = {
  small: { width: 560, height: 460 },
  medium: { width: 620, height: 520 },
  large: { width: 700, height: 600 }
}

const DEFAULT_APPS: PetAppEntry[] = [
  { name: '微信', type: 'app', path: 'C:\\Program Files\\Tencent\\WeChat\\WeChat.exe' },
  { name: 'QQ', type: 'app', path: 'C:\\Program Files\\Tencent\\QQNT\\QQ.exe' },
  { name: 'ChatGPT', type: 'app_or_url', path: '', fallbackUrl: 'https://chatgpt.com/' },
  { name: 'Codex', type: 'app_or_url', path: '', fallbackUrl: 'https://chatgpt.com/codex' }
]

const PET_DISPLAY_NAME = '玛尔塔'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let movePersistTimer: ReturnType<typeof setTimeout> | null = null
let petStateCache: PetState = {
  sizePreset: 'small',
  petScale: 0.8,
  singleClickEnabled: true,
  doubleClickMenuEnabled: true,
  randomActionEnabled: true,
  autoSleepEnabled: true,
  dialogueEnabled: true,
  alwaysOnTop: true,
  settingsVisible: false,
  actionFrequency: 'normal'
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
}

function getStateFilePath(): string {
  return path.join(app.getPath('userData'), 'pet-state.json')
}

function getTrayIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.png')
  }
  return path.join(app.getAppPath(), 'resources', 'icon.png')
}

function getDevAppsPath(): string {
  return path.join(app.getAppPath(), 'apps.json')
}

function getBundledAppsPath(): string {
  return path.join(process.resourcesPath, 'apps.json')
}

function getUserAppsPath(): string {
  return path.join(app.getPath('userData'), 'apps.json')
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function normalizeState(input: Partial<PetState> | null): PetState {
  const sizePreset =
    input?.sizePreset === 'small' || input?.sizePreset === 'medium' || input?.sizePreset === 'large'
      ? input.sizePreset
      : 'small'

  const normalized: PetState = {
    sizePreset,
    petScale: Math.min(1.5, Math.max(0.5, typeof input?.petScale === 'number' ? input.petScale : 0.8)),
    singleClickEnabled: input?.singleClickEnabled ?? true,
    doubleClickMenuEnabled: input?.doubleClickMenuEnabled ?? true,
    randomActionEnabled: input?.randomActionEnabled ?? true,
    autoSleepEnabled: input?.autoSleepEnabled ?? true,
    dialogueEnabled: input?.dialogueEnabled ?? true,
    alwaysOnTop: input?.alwaysOnTop ?? true,
    settingsVisible: input?.settingsVisible ?? false,
    actionFrequency:
      input?.actionFrequency === 'calm' || input?.actionFrequency === 'lively' || input?.actionFrequency === 'normal'
        ? input.actionFrequency
        : 'normal'
  }

  if (typeof input?.x === 'number') normalized.x = Math.round(input.x)
  if (typeof input?.y === 'number') normalized.y = Math.round(input.y)

  return normalized
}

function getDefaultPosition(sizePreset: PetSizePreset): { x: number; y: number } {
  const workArea = screen.getPrimaryDisplay().workArea
  const size = WINDOW_SIZE[sizePreset]

  return {
    x: Math.round(workArea.x + workArea.width - size.width - 40),
    y: Math.round(workArea.y + workArea.height - size.height - 60)
  }
}

function clampPosition(sizePreset: PetSizePreset, x: number, y: number): { x: number; y: number } {
  const size = WINDOW_SIZE[sizePreset]
  const display = screen.getDisplayNearestPoint({
    x: Math.round(x + size.width / 2),
    y: Math.round(y + size.height / 2)
  })
  const workArea = display.workArea
  const minX = workArea.x
  const minY = workArea.y
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - size.width)
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - size.height)

  return {
    x: Math.min(maxX, Math.max(minX, Math.round(x))),
    y: Math.min(maxY, Math.max(minY, Math.round(y)))
  }
}

async function loadPetState(): Promise<PetState> {
  const state = normalizeState(await readJsonFile<PetState>(getStateFilePath()))

  if (typeof state.x !== 'number' || typeof state.y !== 'number') {
    const defaults = getDefaultPosition(state.sizePreset)
    state.x = defaults.x
    state.y = defaults.y
  } else {
    const clamped = clampPosition(state.sizePreset, state.x, state.y)
    state.x = clamped.x
    state.y = clamped.y
  }

  petStateCache = state
  return state
}

async function savePetState(nextState: Partial<PetState>): Promise<PetState> {
  petStateCache = normalizeState({ ...petStateCache, ...nextState })
  if (typeof petStateCache.x === 'number' && typeof petStateCache.y === 'number') {
    const clamped = clampPosition(petStateCache.sizePreset, petStateCache.x, petStateCache.y)
    petStateCache.x = clamped.x
    petStateCache.y = clamped.y
  }
  await writeJsonFile(getStateFilePath(), petStateCache)
  return petStateCache
}

async function ensureAppsConfig(): Promise<string> {
  const userAppsPath = getUserAppsPath()
  const existing = await readJsonFile<PetAppEntry[]>(userAppsPath)

  if (existing) {
    return userAppsPath
  }

  const sourcePath = app.isPackaged ? getBundledAppsPath() : getDevAppsPath()
  const sourceContent = await readJsonFile<PetAppEntry[]>(sourcePath)
  await writeJsonFile(userAppsPath, sourceContent ?? DEFAULT_APPS)
  return userAppsPath
}

async function readAppsConfig(): Promise<{ apps: PetAppEntry[]; configPath: string }> {
  const configPath = await ensureAppsConfig()
  const apps = await readJsonFile<PetAppEntry[]>(configPath)

  return {
    apps: Array.isArray(apps)
      ? apps.filter(
          (entry) =>
            typeof entry?.name === 'string' &&
            (typeof entry?.path === 'string' || typeof entry?.fallbackUrl === 'string')
        )
      : DEFAULT_APPS,
    configPath
  }
}

async function launchPathOrUrl(target: string): Promise<{ ok: boolean; message: string }> {
  if (/^https?:\/\//i.test(target)) {
    await shell.openExternal(target)
    return { ok: true, message: '已打开网址。' }
  }

  try {
    await fs.access(target)
  } catch {
    return { ok: false, message: '路径不存在，请修改 apps.json' }
  }

  const result = await shell.openPath(target)
  if (result) {
    return { ok: false, message: result }
  }

  return { ok: true, message: '已打开。' }
}

async function launchConfiguredTarget(entry: PetAppEntry): Promise<{ ok: boolean; message: string }> {
  if (entry.path) {
    const result = await launchPathOrUrl(entry.path)
    if (result.ok || !entry.fallbackUrl) return result
  }

  if (entry.fallbackUrl) {
    return launchPathOrUrl(entry.fallbackUrl)
  }

  return { ok: false, message: '请先在 apps.json 里配置路径或备用网址。' }
}

function getCurrentWindowState(): PetState {
  if (!mainWindow) {
    return petStateCache
  }

  const [x, y] = mainWindow.getPosition()
  return {
    ...petStateCache,
    x,
    y
  }
}

async function persistCurrentWindowState(): Promise<void> {
  if (!mainWindow) return
  const [x, y] = mainWindow.getPosition()
  await savePetState({ x, y })
}

function schedulePersistCurrentWindowState(): void {
  if (movePersistTimer) {
    clearTimeout(movePersistTimer)
  }

  movePersistTimer = setTimeout(() => {
    movePersistTimer = null
    void persistCurrentWindowState()
  }, 280)
}

function showPetWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

function hidePetWindow(): void {
  mainWindow?.hide()
}

function togglePetWindowVisibility(): void {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    hidePetWindow()
    return
  }
  showPetWindow()
}

function refreshTrayMenu(): void {
  if (!tray) return

  const isVisible = mainWindow?.isVisible() ?? false
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? '隐藏桌宠' : '显示桌宠',
      click: () => togglePetWindowVisibility()
    },
    { type: 'separator' },
    {
      label: '退出桌宠',
      click: () => app.quit()
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip(PET_DISPLAY_NAME)
}

function createTray(): void {
  if (tray) return
  const trayImage = nativeImage.createFromPath(getTrayIconPath())
  tray = new Tray(trayImage)
  tray.on('double-click', () => {
    togglePetWindowVisibility()
    refreshTrayMenu()
  })
  tray.on('click', () => {
    togglePetWindowVisibility()
    refreshTrayMenu()
  })
  refreshTrayMenu()
}

async function createWindow(): Promise<void> {
  const state = await loadPetState()
  const size = WINDOW_SIZE[state.sizePreset]
  const defaults = getDefaultPosition(state.sizePreset)

  mainWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: state.x ?? defaults.x,
    y: state.y ?? defaults.y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    movable: true,
    alwaysOnTop: state.alwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    autoHideMenuBar: true,
    roundedCorners: false,
    thickFrame: false,
    backgroundColor: '#00000000',
    title: PET_DISPLAY_NAME,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    refreshTrayMenu()
  })

  mainWindow.on('moved', () => {
    schedulePersistCurrentWindowState()
  })

  mainWindow.on('show', () => {
    refreshTrayMenu()
  })

  mainWindow.on('hide', () => {
    refreshTrayMenu()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.codex.desktoppet')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('pet:get-state', async () => {
    const state = getCurrentWindowState()
    const { configPath } = await readAppsConfig()
    return { ...state, configPath }
  })

  ipcMain.handle('pet:list-apps', async () => {
    return readAppsConfig()
  })

  ipcMain.handle('pet:launch-app', async (_, entry: PetAppEntry) => {
    return launchConfiguredTarget(entry)
  })

  ipcMain.handle('pet:move-window', async (_, x: number, y: number) => {
    if (!mainWindow) return getCurrentWindowState()
    const clamped = clampPosition(petStateCache.sizePreset, x, y)
    mainWindow.setPosition(clamped.x, clamped.y)
    petStateCache = { ...petStateCache, ...clamped }
    schedulePersistCurrentWindowState()
    return getCurrentWindowState()
  })

  ipcMain.handle('pet:set-size-preset', async (_, sizePreset: PetSizePreset) => {
    if (!mainWindow) {
      return savePetState({ sizePreset })
    }

    const safePreset: PetSizePreset =
      sizePreset === 'small' || sizePreset === 'medium' || sizePreset === 'large'
        ? sizePreset
        : 'medium'
    const [currentX, currentY] = mainWindow.getPosition()
    const nextSize = WINDOW_SIZE[safePreset]

    mainWindow.setBounds({
      x: currentX,
      y: currentY,
      width: nextSize.width,
      height: nextSize.height
    })

    return savePetState({ sizePreset: safePreset, x: currentX, y: currentY })
  })

  ipcMain.handle('pet:update-state', async (_, patch: Partial<PetState>) => {
    const nextState = await savePetState(patch)
    if (mainWindow && typeof patch.alwaysOnTop === 'boolean') {
      mainWindow.setAlwaysOnTop(patch.alwaysOnTop)
    }
    return { ...getCurrentWindowState(), ...nextState }
  })

  ipcMain.handle('pet:set-mouse-ignore', (_, ignore: boolean) => {
    if (!mainWindow) return
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.handle('pet:hide', () => {
    hidePetWindow()
  })

  ipcMain.handle('pet:quit', () => {
    if (movePersistTimer) {
      clearTimeout(movePersistTimer)
      movePersistTimer = null
    }
    tray?.destroy()
    tray = null
    mainWindow?.destroy()
    mainWindow = null
    app.exit(0)
  })

  await createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
      createTray()
    } else {
      showPetWindow()
      refreshTrayMenu()
    }
  })
})

app.on('second-instance', () => {
  showPetWindow()
  refreshTrayMenu()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
