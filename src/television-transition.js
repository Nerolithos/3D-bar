export const TELEVISION_CLOSE_DURATION_MS = 1500
export const TELEVISION_REVEAL_DURATION_MS = 560

const defaultWait = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

export function createTelevisionTransition({ host, wait = defaultWait }) {
  let running = false

  function resetClasses() {
    host.classList.remove('is-tv-transitioning', 'is-tv-transition-revealing')
  }

  return {
    get running() { return running },
    async run(switchScene) {
      if (running) return false
      running = true
      resetClasses()
      host.classList.add('is-tv-transitioning')
      try {
        await wait(TELEVISION_CLOSE_DURATION_MS)
        const switched = await switchScene()
        if (switched === false) return false
        host.classList.remove('is-tv-transitioning')
        host.classList.add('is-tv-transition-revealing')
        await wait(TELEVISION_REVEAL_DURATION_MS)
        return true
      } finally {
        resetClasses()
        running = false
      }
    },
  }
}
