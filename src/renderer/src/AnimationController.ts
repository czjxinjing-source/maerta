import type { AnimationStep } from './types'

export class AnimationController {
  private token = 0

  cancel(): void {
    this.token += 1
  }

  async play(
    steps: AnimationStep[],
    render: (step: AnimationStep) => void,
    afterEach?: (step: AnimationStep) => void
  ): Promise<boolean> {
    const token = ++this.token

    for (const step of steps) {
      if (token !== this.token) return false
      render(step)
      await new Promise((resolve) => window.setTimeout(resolve, step.minDurationMs ?? step.durationMs))
      afterEach?.(step)
    }

    return token === this.token
  }
}
