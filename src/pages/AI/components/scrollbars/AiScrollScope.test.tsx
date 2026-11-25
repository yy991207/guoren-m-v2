import { StrictMode } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AiScrollScope } from './AiScrollScope'

function size(el: HTMLElement) {
  Object.defineProperties(el, {
    clientWidth: { value: 200 }, offsetWidth: { value: 206 }, scrollWidth: { value: 800 },
    clientHeight: { value: 100 }, offsetHeight: { value: 106 }, scrollHeight: { value: 200 },
  })
}
function setup(enabled = true) {
  const view = render(<StrictMode><AiScrollScope className="panel" enabled={enabled}>
    <section><div className="inner"><span>内容</span></div></section>
    <dialog open><div className="sheet" /></dialog>
    <div className="ai-library-hub-preview-body"><pre>文件正文</pre></div>
    <input type="range" aria-label="思考强度" />
  </AiScrollScope></StrictMode>)
  const inner = view.container.querySelector<HTMLElement>('.inner')!
  const outer = view.container.querySelector('section')!
  size(inner); size(outer)
  const layer = () => view.container.querySelector<HTMLElement>('.ai-scroll-indicators')
  return { ...view, inner, outer, layer }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.useRealTimers() })

it('初始、悬停、点击、程序恢复及无位移的滚轮都不显示', () => {
  const { inner, layer } = setup()
  fireEvent.mouseOver(inner); fireEvent.pointerDown(inner); fireEvent.click(inner)
  inner.scrollTop = 20; fireEvent.scroll(inner)
  expect(layer()).toBeNull()
  fireEvent.wheel(inner, { deltaY: 40 }); fireEvent.scroll(inner)
  expect(layer()).toBeNull()
})

it('只在实际滚动的轴绘制等比例圆头滑块，继续滚动延时，停止后淡出并清理', () => {
  const { inner, layer, unmount } = setup()
  // 被动滚轮事件可能在浏览器更新 scrollTop 后才送达。
  inner.scrollTop = 40; fireEvent.wheel(inner.firstElementChild!); fireEvent.scroll(inner)
  const [x, y] = Array.from(layer()!.children) as HTMLElement[]
  expect(x.hidden).toBe(true); expect(y.hidden).toBe(false)
  expect(y.style.width).toBe('6px'); expect(y.style.height).toBe('50px')
  expect(layer()).toHaveAttribute('aria-hidden', 'true')
  vi.advanceTimersByTime(300)
  fireEvent.touchMove(inner); inner.scrollLeft = 60; fireEvent.scroll(inner)
  expect(x.hidden).toBe(false); expect(y.hidden).toBe(true)
  expect(x.style.width).toBe('50px'); expect(x.style.height).toBe('6px')
  vi.advanceTimersByTime(350); expect(layer()).not.toHaveAttribute('data-fading')
  vi.advanceTimersByTime(60); expect(layer()).toHaveAttribute('data-fading')
  vi.advanceTimersByTime(150); expect(layer()).toBeNull()
  fireEvent.keyDown(inner, { key: 'PageDown' }); inner.scrollTop += 5; fireEvent.scroll(inner)
  expect(layer()).not.toBeNull()
  unmount(); expect(vi.getTimerCount()).toBe(0)
})

it('嵌套列表只提示实际移动的区域，滚动结束后不响应程序滚动；弹窗内提示在同一层', () => {
  const { container, inner, outer, layer } = setup()
  fireEvent.wheel(inner); outer.scrollTop = 10; fireEvent.scroll(outer)
  expect(layer()).not.toBeNull()
  fireEvent(outer, new Event('scrollend')); vi.advanceTimersByTime(560)
  outer.scrollTop = 20; fireEvent.scroll(outer); expect(layer()).toBeNull()
  const sheet = container.querySelector<HTMLElement>('.sheet')!; size(sheet)
  fireEvent.keyDown(sheet, { key: 'ArrowDown' }); sheet.scrollTop = 22; fireEvent.scroll(sheet)
  expect(layer()?.parentElement).toBe(sheet.closest('dialog'))
  fireEvent.pointerDown(outer); expect(layer()).toBeNull()
})

it('文件正文、范围输入和非工作区不接管', () => {
  const { container, outer, layer, unmount } = setup()
  const pre = container.querySelector('pre')!; size(pre)
  fireEvent.wheel(pre); pre.scrollLeft = 20; fireEvent.scroll(pre)
  expect(layer()).toBeNull()
  fireEvent.keyDown(container.querySelector('input')!, { key: 'ArrowRight' })
  outer.scrollLeft = 30; fireEvent.scroll(outer); expect(layer()).toBeNull()
  unmount()
  const disabled = setup(false)
  fireEvent.wheel(disabled.inner); disabled.inner.scrollTop = 18; fireEvent.scroll(disabled.inner)
  expect(disabled.layer()).toBeNull(); expect(disabled.container.firstChild).not.toHaveAttribute('data-ai-scroll-scope')
})
