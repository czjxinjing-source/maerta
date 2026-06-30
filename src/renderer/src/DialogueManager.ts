import type { PetStateName } from './types'

const LINES: Record<PetStateName | 'launcher' | 'petBuddy', string[]> = {
  idle: ['今天也要一起加油哦。', '我在呢，有任务交给我吗？', '哼哼，本小姐随时待命。'],
  click: ['嘿！你点到我啦～', '不要一直戳我啦，会痒的！', '小家伙也想和你玩～'],
  doubleClick: ['要打开哪个应用呀？', '今天想先做什么？', '快捷入口已打开～'],
  drag: ['哇哇哇，要带我去哪？', '轻一点啦！', '我飞起来啦——'],
  drop: ['这里风景不错，就待这吧！', '终于落地啦。', '下次轻一点哦。'],
  happy: ['嘿嘿，状态很好！', '今天也会顺顺利利。', '看，小家伙也开心起来了。'],
  angry: ['喂喂喂！别一直戳啦！', '再点我就要生气了哦！', '哼，不理你三秒钟。'],
  sleep: ['Zzz...', '再让我睡五分钟嘛……', '小声一点，我要睡啦。'],
  wake: ['嗯……我睡着了吗？', '啊！任务来了吗？', '我醒啦。'],
  surprised: ['哇！吓我一跳。', '发生什么事了？', '突然靠这么近！'],
  sad: ['放我下来嘛……', '有点委屈。', '你是不是太闲啦？'],
  run: ['跑起来啦！', '小家伙快跟上。', '换个地方透透气。'],
  jump: ['跳一下给你看。', '嘿咻！', '今天弹力不错。'],
  greet: ['你好呀～', '今天也见到你啦。', '需要玛尔塔帮忙吗？'],
  randomMove: ['我自己活动一下。', '稍微动一动。', '别担心，我不会跑远。'],
  launcher: ['去看看消息吧～', '让我们找 ChatGPT 帮忙吧！', '开始让 Codex 干活！'],
  petBuddy: ['它好像也想和你玩。', '别看它小，它可是很厉害的伙伴！', '它刚刚是不是偷偷瞪了你一眼？']
}

export class DialogueManager {
  pick(type: PetStateName | 'launcher' | 'petBuddy'): string {
    const lines = LINES[type]
    return lines[Math.floor(Math.random() * lines.length)]
  }
}
