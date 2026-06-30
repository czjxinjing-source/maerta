import type { AnimationMotion, AnimationStep, PetStateName } from './types'
import type { SpriteKey } from './SpriteManager'

type StateDefinition = {
  priority: number
  minDurationMs: number
  onEnter: AnimationStep[]
  onUpdate: AnimationStep
  onExit: AnimationStep[]
}

function step(
  key: string,
  frame: SpriteKey,
  motion: AnimationMotion,
  durationMs: number,
  dialogueType?: PetStateName,
  particles?: string[]
): AnimationStep {
  return {
    key,
    frame,
    motion,
    durationMs,
    minDurationMs: durationMs,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    dialogueType,
    particles
  }
}

const STATES: Record<PetStateName, StateDefinition> = {
  idle: {
    priority: 1,
    minDurationMs: 700,
    onEnter: [step('settle', 'idle', 'softBounce', 420)],
    onUpdate: step('idleBreathing', 'idle', 'idleBreathing', 4200),
    onExit: [step('idleExit', 'idle', 'none', 180)]
  },
  click: {
    priority: 10,
    minDurationMs: 760,
    onEnter: [step('reactAnticipation', 'idle', 'softBounce', 180), step('clickPop', 'click', 'surprisePop', 520, 'click', ['!', '✦'])],
    onUpdate: step('clickLoop', 'click', 'softBounce', 800),
    onExit: [step('clickRecover', 'idle', 'softBounce', 260)]
  },
  doubleClick: {
    priority: 12,
    minDurationMs: 800,
    onEnter: [step('menuHappy', 'happy', 'happyBounce', 700, 'doubleClick', ['✦'])],
    onUpdate: step('menuLoop', 'happy', 'idleBreathing', 1200),
    onExit: [step('menuClose', 'idle', 'softBounce', 260)]
  },
  drag: {
    priority: 90,
    minDurationMs: 400,
    onEnter: [step('picked', 'picked', 'pickedSway', 420, 'drag')],
    onUpdate: step('dragSway', 'drag', 'dragSway', 1200),
    onExit: [step('dropRebound', 'drop', 'dropRebound', 850, 'drop')]
  },
  drop: {
    priority: 70,
    minDurationMs: 850,
    onEnter: [step('dropRebound', 'drop', 'dropRebound', 850, 'drop')],
    onUpdate: step('dropSettle', 'idle', 'softBounce', 500),
    onExit: [step('dropExit', 'idle', 'none', 160)]
  },
  happy: {
    priority: 15,
    minDurationMs: 900,
    onEnter: [step('happyHop', 'happy', 'happyBounce', 820, 'happy', ['❤', '✦'])],
    onUpdate: step('happyLoop', 'happy', 'idleBreathing', 1000),
    onExit: [step('happyRecover', 'idle', 'softBounce', 300)]
  },
  angry: {
    priority: 55,
    minDurationMs: 3600,
    onEnter: [step('angryBurst', 'angry', 'angryShake', 1100, 'angry', ['!', '!', '✦'])],
    onUpdate: step('angryLoop', 'angry', 'angryShake', 1400),
    onExit: [step('angryRecover', 'angryRecover', 'softBounce', 900)]
  },
  sleep: {
    priority: 25,
    minDurationMs: 4200,
    onEnter: [
      step('yawn', 'sleepy', 'yawn', 850, 'sleep'),
      step('sleepy', 'wake', 'softBounce', 720),
      step('lieDown', 'sleep', 'dropRebound', 950, 'sleep')
    ],
    onUpdate: step('sleepBreathing', 'sleep', 'sleepBreathing', 4200),
    onExit: [step('wakeStretch', 'wake', 'wakeStretch', 1200, 'wake')]
  },
  wake: {
    priority: 65,
    minDurationMs: 1200,
    onEnter: [step('wakeStretch', 'wake', 'wakeStretch', 1200, 'wake')],
    onUpdate: step('wakeLoop', 'wake', 'softBounce', 800),
    onExit: [step('wakeRecover', 'idle', 'softBounce', 300)]
  },
  surprised: {
    priority: 35,
    minDurationMs: 900,
    onEnter: [step('surprisedPop', 'surprised', 'surprisePop', 880, 'surprised', ['!'])],
    onUpdate: step('surprisedLoop', 'surprised', 'softBounce', 900),
    onExit: [step('surprisedRecover', 'idle', 'softBounce', 300)]
  },
  sad: {
    priority: 30,
    minDurationMs: 1800,
    onEnter: [step('sadDroop', 'sad', 'sadTremble', 1300, 'sad')],
    onUpdate: step('sadLoop', 'sad', 'sadTremble', 1600),
    onExit: [step('sadRecover', 'idle', 'softBounce', 500)]
  },
  run: {
    priority: 20,
    minDurationMs: 1000,
    onEnter: [step('runStart', 'run', 'runBob', 1200, 'run')],
    onUpdate: step('runLoop', 'run', 'runBob', 1200),
    onExit: [step('runStop', 'idle', 'dropRebound', 420)]
  },
  jump: {
    priority: 18,
    minDurationMs: 900,
    onEnter: [step('jumpArc', 'jump', 'jumpArc', 900, 'jump', ['✦'])],
    onUpdate: step('jumpLoop', 'jump', 'softBounce', 700),
    onExit: [step('jumpLand', 'drop', 'dropRebound', 600)]
  },
  greet: {
    priority: 14,
    minDurationMs: 900,
    onEnter: [step('greetWave', 'greet', 'greetWave', 1000, 'greet', ['✦'])],
    onUpdate: step('greetLoop', 'greet', 'idleBreathing', 900),
    onExit: [step('greetRecover', 'idle', 'softBounce', 300)]
  },
  randomMove: {
    priority: 8,
    minDurationMs: 900,
    onEnter: [step('randomMove', 'run', 'runBob', 1100, 'randomMove')],
    onUpdate: step('randomLoop', 'idle', 'idleBreathing', 900),
    onExit: [step('randomRecover', 'idle', 'softBounce', 260)]
  }
}

export class PetStateManager {
  private current: PetStateName = 'idle'
  private enteredAt = performance.now()

  getCurrent(): PetStateName {
    return this.current
  }

  canInterrupt(target: PetStateName): boolean {
    const currentDef = STATES[this.current]
    const targetDef = STATES[target]
    const elapsed = performance.now() - this.enteredAt
    if (target === this.current) return false
    if (targetDef.priority >= 80) return true
    if (elapsed < currentDef.minDurationMs && targetDef.priority <= currentDef.priority) return false
    return targetDef.priority >= currentDef.priority || elapsed >= currentDef.minDurationMs
  }

  transitionTo(target: PetStateName): AnimationStep[] {
    if (!this.canInterrupt(target)) return []
    const steps = [...STATES[this.current].onExit, ...STATES[target].onEnter]
    this.current = target
    this.enteredAt = performance.now()
    return steps
  }

  loopStep(): AnimationStep {
    return STATES[this.current].onUpdate
  }
}
