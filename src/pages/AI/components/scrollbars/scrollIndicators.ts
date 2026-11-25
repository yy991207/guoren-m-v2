const thickness = 6
const idleMs = 400
const fadeMs = 150
const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '])
const excluded = '.ai-library-hub-preview-body, input, textarea, select, [contenteditable="true"]'

type Position = { x: number; y: number }

function thumb(viewport: number, content: number, offset: number) {
  const size = Math.min(viewport, Math.max(18, viewport * viewport / content))
  const progress = Math.max(0, Math.min(1, offset / (content - viewport)))
  return { size, start: progress * (viewport - size) }
}

function paint(bar: HTMLElement, x: number, y: number, width: number, height: number) {
  bar.style.transform = `translate(${x}px, ${y}px)`
  bar.style.width = `${width}px`
  bar.style.height = `${height}px`
}

// 指示层不随正文滚动；只画在滚动区域实际露出的部分，不能盖住父容器外的标题或底栏。
function clipToScrollport(layer: HTMLElement, el: HTMLElement, host: Element, rect: DOMRect, origin: DOMRect) {
  let { left, right, top, bottom } = rect
  for (let p = el; p !== host && p.parentElement; ) {
    p = p.parentElement
    const style = getComputedStyle(p)
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
    const bounds = p.getBoundingClientRect()
    if (style.overflowX !== 'visible') { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right) }
    if (style.overflowY !== 'visible') { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom) }
  }
  layer.style.clipPath = `inset(${top - origin.top}px ${origin.right - right}px ${origin.bottom - bottom}px ${left - origin.left}px)`
}

export function attachScrollIndicators(root: HTMLElement) {
  const layer = document.createElement('div')
  layer.className = 'ai-scroll-indicators'
  layer.setAttribute('aria-hidden', 'true')
  const horizontal = document.createElement('span'), vertical = document.createElement('span')
  layer.append(horizontal, vertical)
  const positions = new WeakMap<HTMLElement, Position>()
  const candidates = new Set<HTMLElement>()
  let armedUntil = 0
  let timer: number | undefined

  function reset() {
    candidates.clear()
    window.clearTimeout(timer)
    layer.remove()
  }

  // 只授权本次手势路径：嵌套区域可自然把滚动传给父级，不接管原生事件。
  function arm(event: Event) {
    const target = event.target
    if (!(target instanceof Element) || target.closest('.ai-library-hub-preview-body')) { reset(); return }
    candidates.clear()
    for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
      if (el instanceof HTMLElement && !el.matches(excluded)) candidates.add(el)
    }
    armedUntil = performance.now() + idleMs
  }

  function onPointerDown(event: PointerEvent) {
    reset()
    const el = event.target
    if (!(el instanceof HTMLElement) || event.pointerType === 'touch') return
    const rect = el.getBoundingClientRect()
    // 鼠标按住原生滚动条也算滚动意图；普通点击、展开面板和悬停不算。
    if ((el.scrollHeight > el.clientHeight && event.clientX >= rect.left + el.clientLeft + el.clientWidth) ||
        (el.scrollWidth > el.clientWidth && event.clientY >= rect.top + el.clientTop + el.clientHeight)) arm(event)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (scrollKeys.has(event.key) && event.target instanceof Element && !event.target.closest(excluded)) arm(event)
    else reset()
  }

  function onScroll(event: Event) {
    const el = event.target
    if (!(el instanceof HTMLElement) || el.closest(excluded)) return
    // 浏览器可能先移动内容，再送达被动 wheel 事件，必须与上一次 scroll 的位置比较。
    const last = positions.get(el) ?? { x: 0, y: 0 }
    const x = el.scrollLeft, y = el.scrollTop
    positions.set(el, { x, y })
    if (!candidates.has(el) || performance.now() > armedUntil) return
    const w = el.clientWidth, h = el.clientHeight
    const movedX = x !== last.x && w > 0 && el.scrollWidth > w
    const movedY = y !== last.y && h > 0 && el.scrollHeight > h
    if (!movedX && !movedY) return
    armedUntil = performance.now() + idleMs
    // 原生 dialog 在浏览器顶层，提示层须放在同一弹窗内才能看见。
    const host = el.closest('dialog[open]') ?? root
    if (layer.parentElement !== host) host.appendChild(layer)
    delete layer.dataset.fading
    const rect = el.getBoundingClientRect(), origin = layer.getBoundingClientRect()
    clipToScrollport(layer, el, host, rect, origin)
    const left = rect.left - origin.left, top = rect.top - origin.top
    const rtl = getComputedStyle(el).direction === 'rtl'
    horizontal.hidden = !movedX
    vertical.hidden = !movedY
    if (movedX) {
      const { size, start } = thumb(w, el.scrollWidth, Math.abs(x))
      paint(horizontal, left + el.clientLeft + (rtl ? w - size - start : start), top + el.offsetHeight - thickness, size, thickness)
    }
    if (movedY) {
      const { size, start } = thumb(h, el.scrollHeight, y)
      paint(vertical, left + (rtl ? 0 : el.offsetWidth - thickness), top + el.clientTop + start, thickness, size)
    }
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      candidates.clear()
      layer.dataset.fading = ''
      timer = window.setTimeout(() => layer.remove(), fadeMs)
    }, idleMs)
  }

  const options = { capture: true, passive: true }
  root.addEventListener('wheel', arm, options)
  root.addEventListener('touchmove', arm, options)
  root.addEventListener('keydown', onKeyDown, options)
  root.addEventListener('pointerdown', onPointerDown, options)
  root.addEventListener('scroll', onScroll, options)
  // 滚动结束后取消手势授权，流式消息跟随或切栏恢复位置不主动亮条。
  const disarm = (event: Event) => { if (event.target instanceof HTMLElement) candidates.delete(event.target) }
  root.addEventListener('scrollend', disarm, options)
  return () => {
    root.removeEventListener('wheel', arm, true)
    root.removeEventListener('touchmove', arm, true)
    root.removeEventListener('keydown', onKeyDown, true)
    root.removeEventListener('pointerdown', onPointerDown, true)
    root.removeEventListener('scroll', onScroll, true)
    root.removeEventListener('scrollend', disarm, true)
    reset()
  }
}
