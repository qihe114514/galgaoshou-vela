import folme from '@system.folme'

export default function createPageMotion(initialState, onFallback) {
  let token = 0
  let timers = []

  const cancel = () => {
    token += 1
    for (const timer of timers) clearTimeout(timer)
    timers = []
  }

  const fallback = () => {
    if (typeof onFallback === 'function') onFallback()
  }

  const setInitial = () => {
    try {
      if (!folme || typeof folme.setTo !== 'function') throw new Error('folme unavailable')
      for (const id of Object.keys(initialState)) {
        folme.setTo({ id, toState: { translateY: initialState[id] } })
      }
      return true
    } catch (error) {
      fallback()
      return false
    }
  }

  const run = (ids, duration, currentToken) => {
    if (currentToken !== token) return
    try {
      const frames = ids.map((id) => ({
        id,
        toState: { translateY: { value: '0px' } },
        config: { duration }
      }))
      if (!folme) throw new Error('folme unavailable')
      if (typeof folme.startGroup === 'function') folme.startGroup(frames)
      else if (typeof folme.to === 'function') frames.forEach((frame) => folme.to(frame))
      else throw new Error('folme unavailable')
    } catch (error) {
      fallback()
      cancel()
    }
  }

  const play = (layers, startDelay = 0, duration = 0.25) => {
    cancel()
    const currentToken = token
    const boot = setTimeout(() => {
      if (currentToken !== token || !setInitial()) return
      for (const layer of layers) {
        const timer = setTimeout(() => run(layer.ids, duration, currentToken), startDelay + (layer.delay || 0))
        timers.push(timer)
      }
    }, 0)
    timers.push(boot)
  }

  return { play, cancel }
}
