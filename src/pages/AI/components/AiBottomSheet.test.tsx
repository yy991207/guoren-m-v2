import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AiBottomSheet } from './AiBottomSheet'

it('应用内面板与灰色短横条共用同一外壳，面板内操作不关闭', () => {
  const onClose = vi.fn()
  const onAction = vi.fn()
  render(
    <AiBottomSheet className="custom-sheet" label="更多操作" onClose={onClose}>
      <button type="button" onClick={onAction}>处理文件</button>
    </AiBottomSheet>,
  )

  const panel = screen.getByRole('dialog', { name: '更多操作' })
  expect(panel).toHaveClass('ai-bottom-sheet__panel', 'custom-sheet')
  expect(panel.firstElementChild).toHaveClass('ai-bottom-sheet__handle')
  fireEvent.click(screen.getByRole('button', { name: '处理文件' }))
  expect(onAction).toHaveBeenCalledOnce()
  expect(onClose).not.toHaveBeenCalled()
})

it('点击遮罩通知页面关闭，从面板内拖到遮罩则不关闭', () => {
  const onClose = vi.fn()
  render(<AiBottomSheet label="更多操作" onClose={onClose}>内容</AiBottomSheet>)
  const panel = screen.getByRole('dialog', { name: '更多操作' })
  const backdrop = panel.parentElement!

  fireEvent.pointerDown(panel)
  fireEvent.pointerUp(backdrop)
  fireEvent.click(backdrop, { detail: 1 })
  expect(onClose).not.toHaveBeenCalled()

  fireEvent.pointerDown(backdrop)
  fireEvent.click(backdrop, { detail: 1 })
  expect(onClose).toHaveBeenCalledOnce()
})
