import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiDiscoverHub, AiWorkspaceNavigation } from './AiWorkspaceNavigation'

function renderDiscoverHub() {
  const callbacks = {
    onOpenDiscover: vi.fn(),
    onOpenLibrary: vi.fn(),
    onOpenSkills: vi.fn(),
  }
  render(<AiDiscoverHub {...callbacks} />)
  return callbacks
}

describe('AI 工作区导航', () => {
  it.each(['task', 'discover'] as const)('显示任务和发现，标出当前项（%s）并分别调用对应回调', (active) => {
    const onTask = vi.fn()
    const onDiscover = vi.fn()
    render(<AiWorkspaceNavigation active={active} onTask={onTask} onDiscover={onDiscover} />)

    const navigation = within(screen.getByRole('navigation', { name: 'AI 工作区' }))
    expect(navigation.getAllByRole('button')).toHaveLength(2)
    const task = navigation.getByRole('button', { name: '任务' })
    const discover = navigation.getByRole('button', { name: '发现' })
    expect(navigation.getAllByRole('button', { current: 'page' })).toEqual([active === 'task' ? task : discover])
    for (const button of [task, discover]) {
      button.focus()
      expect(button).toHaveFocus()
    }

    fireEvent.click(discover)
    expect(onDiscover).toHaveBeenCalledTimes(1)
    expect(onTask).not.toHaveBeenCalled()
    fireEvent.click(task)
    expect(onTask).toHaveBeenCalledTimes(1)
    expect(onDiscover).toHaveBeenCalledTimes(1)
  })
})

describe('AI 发现页', () => {
  it('显示发现标题和三个可聚焦的入口', () => {
    renderDiscoverHub()

    expect(screen.getByRole('heading', { name: '发现' })).toBeVisible()
    const entries = within(screen.getByRole('list')).getAllByRole('button')
    expect(entries.map((entry) => entry.textContent)).toEqual(['发现', '库', '技能'])
    for (const entry of entries) {
      entry.focus()
      expect(entry).toHaveFocus()
    }
  })

  it.each([
    ['发现', 'onOpenDiscover'],
    ['库', 'onOpenLibrary'],
    ['技能', 'onOpenSkills'],
  ] as const)('点击%s入口只调用对应的旧功能回调', (label, callback) => {
    const callbacks = renderDiscoverHub()
    const entries = within(screen.getByRole('list'))

    fireEvent.click(entries.getByRole('button', { name: label }))

    for (const [name, handler] of Object.entries(callbacks)) {
      expect(handler).toHaveBeenCalledTimes(name === callback ? 1 : 0)
    }
  })

  it('发现内容不自带底栏', () => {
    renderDiscoverHub()

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })
})
