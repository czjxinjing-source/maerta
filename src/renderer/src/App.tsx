import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimationController } from './AnimationController'
import { DialogueManager } from './DialogueManager'
import { PetStateManager } from './PetStateManager'
import { SPRITE_URLS, spriteUrl } from './SpriteManager'
import type { AnimationMotion, AnimationStep, PetAppEntry, PetState, PetStateName, ParticleItem } from './types'

const CLICK_DELAY_MS = 240
const DRAG_THRESHOLD = 8
const ALPHA_THRESHOLD = 72
const DEFAULT_SCALE = 0.8
const BASE_STAGE = { width: 360, height: 360 }
const SPEECH_VISIBLE_MS = 5200
const SPEECH_MIN_REPLACE_MS = 2200

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function clampScale(value: number): number {
  return Math.min(1.5, Math.max(0.5, Number.isFinite(value) ? value : DEFAULT_SCALE))
}

function App(): React.JSX.Element {
  const stateManager = useMemo(() => new PetStateManager(), [])
  const dialogueManager = useMemo(() => new DialogueManager(), [])
  const animationController = useMemo(() => new AnimationController(), [])

  const [petState, setPetState] = useState<PetState | null>(null)
  const [apps, setApps] = useState<PetAppEntry[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [speech, setSpeech] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [frame, setFrame] = useState(spriteUrl('idle'))
  const [previousFrame, setPreviousFrame] = useState<string | null>(null)
  const [motion, setMotion] = useState<AnimationMotion>('idleBreathing')
  const [particles, setParticles] = useState<ParticleItem[]>([])
  const [wakeClicks, setWakeClicks] = useState(0)

  const clickTimerRef = useRef<number | null>(null)
  const clickCountRef = useRef(0)
  const clickResetTimerRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const sleepTimerRef = useRef<number | null>(null)
  const speechTimerRef = useRef<number | null>(null)
  const lastSpeechAtRef = useRef(0)
  const toastTimerRef = useRef<number | null>(null)
  const fadeTimerRef = useRef<number | null>(null)
  const loopTimerRef = useRef<number | null>(null)
  const dragContextRef = useRef<{
    startMouseX: number
    startMouseY: number
    startWindowX: number
    startWindowY: number
    lastX: number
    lastY: number
    lastTime: number
    dragging: boolean
    startedAt: number
  } | null>(null)
  const ignoreClickRef = useRef(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const alphaCanvasRef = useRef<{ canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null>(null)
  const alphaCanvasCacheRef = useRef<Map<string, { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }>>(new Map())
  const dragFrameRef = useRef<number | null>(null)
  const pendingDragPositionRef = useRef<{ x: number; y: number } | null>(null)
  const mouseIgnoreRef = useRef(false)
  const currentFrameRef = useRef(frame)
  const currentStateRef = useRef<PetStateName>('idle')

  const scale = clampScale(petState?.petScale ?? DEFAULT_SCALE)

  useEffect(() => {
    let mounted = true

    const bootstrap = async (): Promise<void> => {
      const [state, appsPayload] = await Promise.all([window.pet.getState(), window.pet.listApps()])
      if (!mounted) return
      setPetState({ ...state, configPath: appsPayload.configPath, petScale: clampScale(state.petScale) })
      setApps(appsPayload.apps)
      showSpeech('玛尔塔准备好啦。')
      preloadSprites()
    }

    void bootstrap()

    return () => {
      mounted = false
      animationController.cancel()
      void setMouseIgnore(false)
    }
  }, [animationController])

  useEffect(() => {
    currentFrameRef.current = frame
    const cachedCanvas = alphaCanvasCacheRef.current.get(frame)
    if (cachedCanvas) {
      alphaCanvasRef.current = cachedCanvas
      return
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = frame
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      alphaCanvasCacheRef.current.set(frame, { canvas, context })
      alphaCanvasRef.current = { canvas, context }
    }
  }, [frame])

  useEffect(() => {
    resetSleepTimer()
    scheduleIdleAction()
    return () => {
      clearTimers()
    }
  }, [petState?.randomActionEnabled, petState?.autoSleepEnabled, petState?.actionFrequency, panelOpen])

  useEffect(() => {
    if (panelOpen || contextOpen || petState?.settingsVisible) {
      void setMouseIgnore(false)
    }
  }, [panelOpen, contextOpen, petState?.settingsVisible])

  const clearTimers = (): void => {
    ;[clickTimerRef, clickResetTimerRef, idleTimerRef, sleepTimerRef, speechTimerRef, toastTimerRef, fadeTimerRef, loopTimerRef].forEach(
      (timerRef) => {
        if (timerRef.current) window.clearTimeout(timerRef.current)
      }
    )
    if (dragFrameRef.current) window.cancelAnimationFrame(dragFrameRef.current)
  }

  const preloadSprites = (): void => {
    SPRITE_URLS.forEach((url) => {
      if (alphaCanvasCacheRef.current.has(url)) return
      const image = new Image()
      image.decoding = 'async'
      image.src = url
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return
        context.drawImage(image, 0, 0)
        alphaCanvasCacheRef.current.set(url, { canvas, context })
      }
    })
  }

  const updatePetState = async (patch: Partial<PetState>): Promise<void> => {
    const nextState = await window.pet.updateState(patch)
    setPetState((current) => ({ ...(current ?? nextState), ...nextState, petScale: clampScale(nextState.petScale) }))
  }

  const showSpeech = (line: string): void => {
    if (!line || petState?.dialogueEnabled === false) return
    const now = performance.now()
    if (speech && now - lastSpeechAtRef.current < SPEECH_MIN_REPLACE_MS) return
    lastSpeechAtRef.current = now
    setSpeech(line)
    if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current)
    speechTimerRef.current = window.setTimeout(() => setSpeech(''), SPEECH_VISIBLE_MS)
  }

  const showToast = (line: string): void => {
    setToast(line)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600)
  }

  const spawnParticles = (glyphs: string[] = ['✦'], count = 3): void => {
    const created = Array.from({ length: count }, (_, index) => ({
      id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      glyph: glyphs[index % glyphs.length],
      x: 16 + Math.random() * 64,
      delay: Math.random() * 0.18,
      duration: 1.1 + Math.random() * 0.7,
      scale: 0.85 + Math.random() * 0.5
    }))
    setParticles((current) => [...current, ...created])
    window.setTimeout(() => {
      setParticles((current) => current.filter((item) => !created.some((createdItem) => createdItem.id === item.id)))
    }, 2200)
  }

  const renderStep = (step: AnimationStep): void => {
    const nextFrame = spriteUrl(step.frame as Parameters<typeof spriteUrl>[0])
    setPreviousFrame(currentFrameRef.current)
    setFrame(nextFrame)
    currentFrameRef.current = nextFrame
    setMotion(step.motion)
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = window.setTimeout(() => setPreviousFrame(null), 220)
    if (step.dialogueType) showSpeech(dialogueManager.pick(step.dialogueType))
    if (step.particles?.length) spawnParticles(step.particles, Math.max(2, step.particles.length + 1))
  }

  const scheduleLoop = (): void => {
    if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current)
    const loop = stateManager.loopStep()
    renderStep(loop)
    loopTimerRef.current = window.setTimeout(scheduleLoop, loop.durationMs)
  }

  const setPetMode = async (target: PetStateName): Promise<boolean> => {
    const steps = stateManager.transitionTo(target)
    if (steps.length === 0) return false
    currentStateRef.current = target
    const completed = await animationController.play(steps, renderStep)
    if (completed) scheduleLoop()
    return completed
  }

  const returnIdleAfter = (delayMs: number): void => {
    window.setTimeout(() => {
      if (!['drag', 'sleep'].includes(currentStateRef.current)) {
        void setPetMode('idle')
      }
    }, delayMs)
  }

  const resetSleepTimer = (): void => {
    if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current)
    if (!petState?.autoSleepEnabled) return
    sleepTimerRef.current = window.setTimeout(() => {
      if (!panelOpen && currentStateRef.current === 'idle') void setPetMode('sleep')
    }, 60000)
  }

  const scheduleIdleAction = (): void => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    if (!petState?.randomActionEnabled) return
    const base = petState?.actionFrequency === 'lively' ? 5000 : petState?.actionFrequency === 'calm' ? 11000 : 7500
    const delay = base + Math.round(Math.random() * 4500)
    idleTimerRef.current = window.setTimeout(() => {
      if (!panelOpen && currentStateRef.current === 'idle') {
        const target = pick<PetStateName>(['greet', 'happy', 'jump', 'run', 'randomMove'])
        void setPetMode(target).then(() => returnIdleAfter(1400))
      }
      scheduleIdleAction()
    }, delay)
  }

  const hitTestPet = (clientX: number, clientY: number): boolean => {
    const image = imageRef.current
    const cached = alphaCanvasRef.current
    if (!image || !cached) return false
    const { canvas, context } = cached
    const rect = image.getBoundingClientRect()
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false
    const sampleX = Math.min(canvas.width - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * canvas.width)))
    const sampleY = Math.min(canvas.height - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * canvas.height)))
    return context.getImageData(sampleX, sampleY, 1, 1).data[3] >= ALPHA_THRESHOLD
  }

  const isInteractiveElement = (target: EventTarget | null): boolean => {
    return target instanceof HTMLElement && Boolean(target.closest('.launcher-panel, .settings-panel, .context-panel'))
  }

  const setMouseIgnore = async (ignore: boolean): Promise<void> => {
    if (mouseIgnoreRef.current === ignore) return
    mouseIgnoreRef.current = ignore
    await window.pet.setMouseIgnore(ignore)
  }

  const resetUserActivity = (): void => {
    resetSleepTimer()
    if (currentStateRef.current === 'sleep') return
  }

  const handleSingleClick = (): void => {
    if (!petState?.singleClickEnabled || ignoreClickRef.current) {
      ignoreClickRef.current = false
      return
    }
    resetUserActivity()

    if (currentStateRef.current === 'sleep') {
      const nextWakeClicks = wakeClicks + 1
      setWakeClicks(nextWakeClicks)
      if (nextWakeClicks < 3) {
        void setPetMode('wake')
        return
      }
      setWakeClicks(0)
      void setPetMode('idle')
      return
    }

    clickCountRef.current += 1
    if (clickResetTimerRef.current) window.clearTimeout(clickResetTimerRef.current)
    clickResetTimerRef.current = window.setTimeout(() => {
      clickCountRef.current = 0
    }, 2600)

    const count = clickCountRef.current
    const target: PetStateName =
      count >= 6 ? 'angry' : count >= 3 ? pick(['surprised', 'sad']) : pick(['click', 'happy', 'greet', 'jump'])
    void setPetMode(target).then(() => returnIdleAfter(target === 'angry' ? 4200 : 1200))
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (!hitTestPet(event.clientX, event.clientY)) return
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current)
    clickTimerRef.current = window.setTimeout(handleSingleClick, CLICK_DELAY_MS)
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (!hitTestPet(event.clientX, event.clientY)) return
    if (!petState?.doubleClickMenuEnabled) return
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current)
    setPanelOpen((current) => !current)
    setContextOpen(false)
    void setPetMode('doubleClick')
    returnIdleAfter(1200)
  }

  const handleContextMenu = (event: React.MouseEvent): void => {
    if (!isInteractiveElement(event.target) && !hitTestPet(event.clientX, event.clientY)) return
    event.preventDefault()
    setContextOpen((current) => !current)
    setPanelOpen(false)
  }

  const handleLaunchApp = async (entry: PetAppEntry): Promise<void> => {
    const result = await window.pet.launchApp(entry)
    setPanelOpen(false)
    showSpeech(dialogueManager.pick('launcher'))
    showToast(result.ok ? `${entry.name} 已启动` : result.message)
  }

  const openSettings = (event: React.MouseEvent): void => {
    event.stopPropagation()
    setContextOpen(false)
    setPanelOpen(false)
    void updatePetState({ settingsVisible: true })
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0 || !petState || !hitTestPet(event.clientX, event.clientY)) return
    resetUserActivity()

    dragContextRef.current = {
      startMouseX: event.screenX,
      startMouseY: event.screenY,
      startWindowX: petState.x ?? 0,
      startWindowY: petState.y ?? 0,
      lastX: event.screenX,
      lastY: event.screenY,
      lastTime: performance.now(),
      dragging: false,
      startedAt: performance.now()
    }

    const handlePointerMove = async (moveEvent: PointerEvent): Promise<void> => {
      const context = dragContextRef.current
      if (!context) return

      const deltaX = moveEvent.screenX - context.startMouseX
      const deltaY = moveEvent.screenY - context.startMouseY
      if (!context.dragging && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD) {
        context.dragging = true
        setPanelOpen(false)
        setContextOpen(false)
        void setPetMode('drag')
      }
      if (!context.dragging) return

      pendingDragPositionRef.current = { x: context.startWindowX + deltaX, y: context.startWindowY + deltaY }
      if (!dragFrameRef.current) {
        dragFrameRef.current = window.requestAnimationFrame(() => {
          dragFrameRef.current = null
          const nextPosition = pendingDragPositionRef.current
          if (!nextPosition) return
          void window.pet.moveWindow(nextPosition.x, nextPosition.y).then((nextState) => {
            setPetState((current) => ({ ...(current ?? nextState), ...nextState, petScale: clampScale(nextState.petScale) }))
          })
        })
      }

      const now = performance.now()
      const speed = Math.hypot(moveEvent.screenX - context.lastX, moveEvent.screenY - context.lastY) / Math.max(16, now - context.lastTime)
      rootRef.current?.style.setProperty('--drag-tilt', `${Math.max(-10, Math.min(10, speed * Math.sign(moveEvent.screenX - context.lastX) * 4))}deg`)
      context.lastX = moveEvent.screenX
      context.lastY = moveEvent.screenY
      context.lastTime = now
    }

    const handlePointerUp = (): void => {
      const context = dragContextRef.current
      dragContextRef.current = null
      pendingDragPositionRef.current = null
      if (dragFrameRef.current) {
        window.cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      if (context?.dragging) {
        ignoreClickRef.current = true
        window.setTimeout(() => {
          ignoreClickRef.current = false
        }, 80)
        const draggedTooLong = performance.now() - context.startedAt > 6500
        void setPetMode(draggedTooLong ? 'sad' : 'drop').then(() => returnIdleAfter(draggedTooLong ? 2400 : 900))
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (isInteractiveElement(event.target) || panelOpen || contextOpen || petState?.settingsVisible) {
      void setMouseIgnore(false)
      return
    }
    void setMouseIgnore(!hitTestPet(event.clientX, event.clientY))
  }

  const quitPet = (event?: React.MouseEvent): void => {
    event?.stopPropagation()
    setContextOpen(false)
    setPanelOpen(false)
    void window.pet.quit()
  }

  if (!petState) {
    return <div className="booting">玛尔塔正在醒来...</div>
  }

  return (
    <div
      className="pet-root"
      ref={rootRef}
      style={
        {
          '--pet-scale': scale,
          '--stage-width': `${Math.round(BASE_STAGE.width * scale)}px`,
          '--stage-height': `${Math.round(BASE_STAGE.height * scale)}px`
        } as React.CSSProperties
      }
    >
      <div className="pet-scene" onPointerMove={handlePointerMove} onMouseDown={() => setContextOpen(false)}>
        <div className="pet-zone">
          <div className={`pet-stage motion-${motion}`}>
            <div className={`speech-bubble ${speech ? 'is-visible' : ''}`}>{speech}</div>

            <button
              className="pet-button"
              onClick={handleClick}
              onContextMenu={handleContextMenu}
              onDoubleClick={handleDoubleClick}
              onPointerDown={handlePointerDown}
              type="button"
              aria-label="玛尔塔桌宠"
            >
              {previousFrame && <img className="pet-image pet-image-previous" src={previousFrame} alt="" draggable={false} />}
              <img className="pet-image pet-image-current" ref={imageRef} src={frame} alt="玛尔塔" draggable={false} />
            </button>

            {particles.map((particle) => (
              <span
                className="particle"
                key={particle.id}
                style={{
                  left: `${particle.x}%`,
                  animationDelay: `${particle.delay}s`,
                  animationDuration: `${particle.duration}s`,
                  transform: `scale(${particle.scale})`
                }}
              >
                {particle.glyph}
              </span>
            ))}

            <aside
              className={`launcher-panel ${panelOpen ? 'is-open' : ''}`}
              aria-hidden={!panelOpen}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="panel-header">
                <h2>常用应用</h2>
                <button className="icon-button" onClick={() => setPanelOpen(false)} type="button" aria-label="关闭">
                  ×
                </button>
              </div>
              <div className="app-list">
                {apps.map((entry) => (
                  <button className="app-item" key={entry.name} onClick={() => void handleLaunchApp(entry)} type="button">
                    <span>{entry.name}</span>
                    <small>{entry.path || entry.fallbackUrl || '需要配置路径'}</small>
                  </button>
                ))}
              </div>
            </aside>

            <aside
              className={`context-panel ${contextOpen ? 'is-open' : ''}`}
              aria-hidden={!contextOpen}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button onClick={(event) => { event.stopPropagation(); setContextOpen(false); setPanelOpen(true) }} type="button">常用应用</button>
              <button onClick={openSettings} type="button">调整大小</button>
              <button onClick={(event) => { event.stopPropagation(); void updatePetState({ randomActionEnabled: !petState.randomActionEnabled }) }} type="button">
                {petState.randomActionEnabled ? '关闭随机移动' : '开启随机移动'}
              </button>
              <button onClick={(event) => { event.stopPropagation(); void updatePetState({ autoSleepEnabled: !petState.autoSleepEnabled }) }} type="button">
                {petState.autoSleepEnabled ? '关闭自动睡觉' : '开启自动睡觉'}
              </button>
              <button onClick={(event) => { event.stopPropagation(); void updatePetState({ dialogueEnabled: !petState.dialogueEnabled }) }} type="button">
                {petState.dialogueEnabled ? '关闭对话气泡' : '开启对话气泡'}
              </button>
              <button onClick={(event) => { event.stopPropagation(); void updatePetState({ alwaysOnTop: !petState.alwaysOnTop }) }} type="button">
                {petState.alwaysOnTop ? '取消置顶' : '置顶'}
              </button>
              <button onClick={(event) => { event.stopPropagation(); void window.pet.hide() }} type="button">隐藏桌宠</button>
              <button onClick={quitPet} type="button">退出桌宠</button>
            </aside>

            <aside
              className={`settings-panel ${petState.settingsVisible ? 'is-open' : ''}`}
              aria-hidden={!petState.settingsVisible}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="panel-header">
                <h2>设置</h2>
                <button className="icon-button" onClick={() => void updatePetState({ settingsVisible: false })} type="button" aria-label="关闭">
                  ×
                </button>
              </div>
              <label className="setting-row">
                <span>大小</span>
                <input
                  max="1.5"
                  min="0.5"
                  step="0.05"
                  type="range"
                  value={scale}
                  onChange={(event) => void updatePetState({ petScale: Number(event.currentTarget.value) })}
                />
                <strong>{scale.toFixed(2)}</strong>
              </label>
              <button className="switch-row" onClick={() => void updatePetState({ randomActionEnabled: !petState.randomActionEnabled })} type="button">
                随机移动：{petState.randomActionEnabled ? '开' : '关'}
              </button>
              <button className="switch-row" onClick={() => void updatePetState({ autoSleepEnabled: !petState.autoSleepEnabled })} type="button">
                自动睡觉：{petState.autoSleepEnabled ? '开' : '关'}
              </button>
              <button className="switch-row" onClick={() => void updatePetState({ dialogueEnabled: !petState.dialogueEnabled })} type="button">
                对话气泡：{petState.dialogueEnabled ? '开' : '关'}
              </button>
              <select
                className="frequency-select"
                value={petState.actionFrequency}
                onChange={(event) => void updatePetState({ actionFrequency: event.currentTarget.value as PetState['actionFrequency'] })}
              >
                <option value="calm">动作少一点</option>
                <option value="normal">正常</option>
                <option value="lively">活泼一点</option>
              </select>
              <p title={petState.configPath}>{petState.configPath}</p>
            </aside>
          </div>
        </div>

        <div className={`toast ${toast ? 'is-visible' : ''}`}>{toast}</div>
      </div>
    </div>
  )
}

export default App
