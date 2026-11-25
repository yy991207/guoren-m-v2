import { StrictMode, useRef, useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AiWorkspaceSidebar } from './AiWorkspaceSidebar'

function SidebarExample() {
  const [open, setOpen] = useState(false)
  const backgroundRef = useRef<HTMLDivElement>(null)
  return (
    <>
      <AiWorkspaceSidebar id="sidebar" open={open} backgroundRef={backgroundRef} onClose={() => setOpen(false)}>
        <button type="button">新建任务</button>
        <button type="button">任务</button>
        <div hidden><button type="button">隐藏的历史</button></div>
      </AiWorkspaceSidebar>
      <div ref={backgroundRef} data-testid="background">
        <button type="button" onClick={() => setOpen(true)}>打开对话历史</button>
        <input aria-label="草稿" defaultValue="保留内容" />
      </div>
    </>
  )
}

function openSidebar() {
  const trigger = screen.getByRole('button', { name: '打开对话历史' })
  act(() => trigger.focus())
  fireEvent.click(trigger)
  return { trigger, dialog: screen.getByRole('dialog', { name: '任务历史' }) }
}

describe('工作区平移侧栏', () => {
  it('打开时隔离背景、保留草稿节点，关闭后恢复入口焦点', () => {
    render(<StrictMode><SidebarExample /></StrictMode>)
    const draft = screen.getByRole('textbox', { name: '草稿' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const { trigger, dialog } = openSidebar()
    const background = screen.getByTestId('background')
    expect(background.inert).toBe(true)
    expect(within(dialog).getByRole('button', { name: '新建任务' })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: '草稿' })).toBe(draft)

    fireEvent.click(within(dialog).getByRole('button', { name: '收起任务侧栏' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(background.inert).toBeFalsy()
    expect(trigger).toHaveFocus()
    expect(draft).toHaveValue('保留内容')
  })

  it('键盘焦点只循环可见按钮，Escape 关闭', () => {
    render(<SidebarExample />)
    const { trigger, dialog } = openSidebar()
    const first = within(dialog).getByRole('button', { name: '新建任务' })
    const last = within(dialog).getByRole('button', { name: '收起任务侧栏' })
    expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(last).toHaveFocus()
    expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false)
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('卸载时清除背景隔离状态', () => {
    const { unmount } = render(<SidebarExample />)
    openSidebar()
    const background = screen.getByTestId('background')
    expect(background.inert).toBe(true)
    unmount()
    expect(background.inert).toBeFalsy()
  })
})
