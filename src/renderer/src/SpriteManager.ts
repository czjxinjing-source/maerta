export const SPRITES = {
  idle: './assets/states/idle.png',
  click: './assets/states/click.png',
  doubleClick: './assets/states/happy.png',
  drag: './assets/states/drag.png',
  drop: './assets/states/drop.png',
  happy: './assets/states/happy.png',
  angry: './assets/states/angry.png',
  angryRecover: './assets/states/angry_recover.png',
  sleep: './assets/states/sleep.png',
  sleepBreathing: './assets/states/sleep_breathing.png',
  sleepy: './assets/states/sleepy.png',
  wake: './assets/states/wake.png',
  surprised: './assets/states/surprised.png',
  sad: './assets/states/sad.png',
  run: './assets/states/run.png',
  jump: './assets/states/jump.png',
  greet: './assets/states/greet.png',
  picked: './assets/states/picked.png'
} as const

export type SpriteKey = keyof typeof SPRITES

export function spriteUrl(key: SpriteKey): string {
  return SPRITES[key]
}

export const SPRITE_URLS = Object.values(SPRITES)
