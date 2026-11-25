import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiWorkspaceNavigation } from './AiWorkspaceNavigation'

const tabs = [
  ['task', '任务'], ['agents', '智能体'], ['library', '库'], ['skills', '技能'],
] as const

describe('AI 工作区导航', () => {
  it('切换选中项时替换的是图形本身，未选中项恢复原线框', () => {
    const navigate = vi.fn()
    const { rerender } = render(<AiWorkspaceNavigation active="task" onNavigate={navigate} />)
    const svg = (name: string) => screen.getByRole('button', { name }).querySelector('svg')!.outerHTML
    const outlines = new Map<string, string>()
    for (const [key, label] of tabs) {
      rerender(<AiWorkspaceNavigation active={key === 'task' ? 'library' : 'task'} onNavigate={navigate} />)
      outlines.set(label, svg(label))
    }
    for (const [active] of tabs) {
      rerender(<AiWorkspaceNavigation active={active} onNavigate={navigate} />)
      for (const [key, label] of tabs) {
        expect(svg(label) === outlines.get(label)).toBe(key !== active)
      }
    }
  })

  it.each(tabs)('从 %s 直达其他栏目，仅标记当前页', (active, label) => {
    const navigate = vi.fn()
    render(<AiWorkspaceNavigation active={active} onNavigate={navigate} />)
    const nav = within(screen.getByRole('navigation', { name: 'AI 工作区' }))
    expect(nav.getAllByRole('button').map((button) => button.textContent)).toEqual(tabs.map(([, name]) => name))
    expect(nav.getAllByRole('button', { current: 'page' })).toEqual([nav.getByRole('button', { name: label })])
    for (const [key, name] of tabs) {
      const button = nav.getByRole('button', { name })
      button.focus()
      expect(button).toHaveFocus()
      fireEvent.click(button)
      expect(navigate.mock.calls).toEqual(key === active ? [] : [[key]])
      navigate.mockClear()
    }
  })
})
