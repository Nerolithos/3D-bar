const DOOR_GLYPHS = Object.freeze({
  'rune-ring': '◉',
  'rune-fork': '⋔',
  'rune-cross': '⨯',
  'rune-wave': '≋',
  'rune-sun': '☼',
  'rune-diamond': '◇',
  'rune-eye': '◐',
  'rune-ladder': '╫',
  'rune-spiral': '↺',
  'rune-crown': '♜',
})

export function createDoorKeypadMarkup(symbols) {
  const slots = Array.from({ length: 8 }, () => '<span data-door-slot aria-hidden="true">·</span>').join('')
  const keys = symbols.map(({ id }) => (
    `<button type="button" class="bar-scene__symbol-key" data-symbol="${id}" aria-label="输入抽象符号">${DOOR_GLYPHS[id]}</button>`
  )).join('')
  return `<div class="bar-scene__door-slots" aria-label="已输入符号">${slots}</div>` +
    `<div class="bar-scene__door-keys">${keys}</div>`
}

export function createDoorKeypadController({ root, symbols, onSymbol, documentRef = document }) {
  const content = root.querySelector('.bar-scene__door-content')
  const status = root.querySelector('.bar-scene__door-status')
  content.innerHTML = createDoorKeypadMarkup(symbols)
  const slots = [...root.querySelectorAll('[data-door-slot]')]
  let currentState = null
  let errorTimer = null

  function render(state) {
    currentState = state
    slots.forEach((slot, index) => {
      slot.textContent = DOOR_GLYPHS[state.door.symbols[index]] ?? '·'
    })
    root.dataset.feedback = state.door.feedback ?? ''
    if (state.door.feedback === 'error') {
      root.classList.remove('is-error')
      void root.offsetWidth
      root.classList.add('is-error')
      clearTimeout(errorTimer)
      errorTimer = setTimeout(() => root.classList.remove('is-error'), 380)
    }
    if (state.door.roomStatus === 'error') status.textContent = '门后空间载入失败'
    else if (state.door.keypadSolved && state.door.roomStatus === 'ready') status.textContent = '门锁已解除'
    else if (state.door.keypadSolved) status.textContent = '认证通过 · 门后空间载入中'
    else if (state.door.feedback === 'error') status.textContent = '符号错误 · 输入已清除'
    else if (state.door.roomStatus === 'loading') status.textContent = '门后空间载入中'
    else status.textContent = '输入符号序列'
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-symbol]')
    if (!button || !currentState) return
    render(onSymbol(currentState, button.dataset.symbol))
  })

  return {
    open(state) {
      render(state)
      root.hidden = false
      if (documentRef.pointerLockElement) documentRef.exitPointerLock()
    },
    close() {
      clearTimeout(errorTimer)
      errorTimer = null
      root.classList.remove('is-error')
      root.hidden = true
    },
    render,
  }
}