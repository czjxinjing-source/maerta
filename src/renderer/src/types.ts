export type PetStateName =
  | 'idle'
  | 'click'
  | 'doubleClick'
  | 'drag'
  | 'drop'
  | 'happy'
  | 'angry'
  | 'sleep'
  | 'wake'
  | 'surprised'
  | 'sad'
  | 'run'
  | 'jump'
  | 'greet'
  | 'randomMove'

export type AnimationMotion =
  | 'idleBreathing'
  | 'softBounce'
  | 'happyBounce'
  | 'angryShake'
  | 'sleepBreathing'
  | 'surprisePop'
  | 'sadTremble'
  | 'dragSway'
  | 'dropRebound'
  | 'runBob'
  | 'jumpArc'
  | 'greetWave'
  | 'wakeStretch'
  | 'yawn'
  | 'pickedSway'
  | 'none'

export type ActionFrequency = 'calm' | 'normal' | 'lively'

export type PetState = {
  x?: number
  y?: number
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

export type PetAppEntry = {
  name: string
  type?: 'app' | 'url' | 'app_or_url'
  path?: string
  fallbackUrl?: string
}

export type ParticleItem = {
  id: string
  glyph: string
  x: number
  delay: number
  duration: number
  scale: number
}

export type AnimationStep = {
  key: string
  frame: string
  motion: AnimationMotion
  durationMs: number
  minDurationMs?: number
  easing?: string
  lock?: boolean
  dialogueType?: PetStateName
  particles?: string[]
}
