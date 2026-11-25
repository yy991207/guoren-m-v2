import type { ComponentProps } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChatSession } from '../../../services/chat/types'
import { AiTaskSidebarContent } from './AiTaskSidebarContent'

type SidebarProps = ComponentProps<typeof AiTaskSidebarContent>

function createSession(id: string, name: string): ChatSession {
  return {
    session_id: id,
    session_name: name,
    user_id: 'test-user',
    created_at: '2026-11-25T08:00:00Z',
    updated_at: '2026-11-25T08:00:00Z',
  }
}

function createProps(overrides: Partial<SidebarProps> = {}): SidebarProps {
  return {
    groups: {
      today: [createSession('today-session', '今天的任务')],
      within7Days: [createSession('recent-session', '本周的任务')],
      beyond7Days: [createSession('older-session', '较早的任务')],
    },
    activeSessionId: null,
    removingSessionIds: new Set<string>(),
    isLoading: false,
    tasksExpanded: true,
    onTasksExpandedChange: vi.fn(),
    onNewTask: vi.fn(),
    onOpenSession: vi.fn(),
    ...overrides,
  }
}

describe('AI 任务边栏内容', () => {
  it('只展示新建、任务开关和真实历史，并沿用三个时间分组', () => {
    render(<AiTaskSidebarContent {...createProps()} />)

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '新建任务', '任务', '今天的任务', '本周的任务', '较早的任务',
    ])
    expect(screen.getByText('今天')).toBeVisible()
    expect(screen.getByText('7天内')).toBeVisible()
    expect(screen.getByText('7天外')).toBeVisible()
    expect(screen.queryByText('云电脑')).not.toBeInTheDocument()
    expect(screen.queryByText('排序')).not.toBeInTheDocument()
    expect(screen.queryByText('对话历史')).not.toBeInTheDocument()
  })

  it('点击新建只调用原新建回调', () => {
    const props = createProps()
    render(<AiTaskSidebarContent {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '新建任务' }))

    expect(props.onNewTask).toHaveBeenCalledTimes(1)
    expect(props.onTasksExpandedChange).not.toHaveBeenCalled()
    expect(props.onOpenSession).not.toHaveBeenCalled()
  })

  it.each([
    ['今天的任务', 'today-session'],
    ['本周的任务', 'recent-session'],
    ['较早的任务', 'older-session'],
  ])('点击%s只向父组件传递对应会话编号', (name, sessionId) => {
    const props = createProps()
    render(<AiTaskSidebarContent {...props} />)

    fireEvent.click(screen.getByRole('button', { name }))

    expect(props.onOpenSession).toHaveBeenCalledTimes(1)
    expect(props.onOpenSession).toHaveBeenCalledWith(sessionId)
    expect(props.onNewTask).not.toHaveBeenCalled()
    expect(props.onTasksExpandedChange).not.toHaveBeenCalled()
  })

  it('任务开关按父组件传入的展开状态回调，并关联到历史区域', () => {
    const props = createProps()
    const { rerender } = render(<AiTaskSidebarContent {...props} />)
    const toggle = screen.getByRole('button', { name: '任务' })
    const history = screen.getByRole('region', { name: '任务' })

    expect(toggle).toHaveAttribute('aria-controls', history.id)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(props.onTasksExpandedChange).toHaveBeenNthCalledWith(1, false)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    rerender(<AiTaskSidebarContent {...props} tasksExpanded={false} />)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(props.onTasksExpandedChange).toHaveBeenNthCalledWith(2, true)
    expect(props.onTasksExpandedChange).toHaveBeenCalledTimes(2)
    expect(props.onNewTask).not.toHaveBeenCalled()
    expect(props.onOpenSession).not.toHaveBeenCalled()
  })

  it('折叠语义隐藏历史，不销毁原列表节点，重新展开保持滚动状态', () => {
    const props = createProps()
    const { rerender } = render(<AiTaskSidebarContent {...props} />)
    const history = screen.getByRole('region', { name: '任务' })
    const sessionButton = screen.getByRole('button', { name: '今天的任务' })
    history.scrollTop = 48

    rerender(<AiTaskSidebarContent {...props} tasksExpanded={false} />)

    expect(history).toHaveAttribute('hidden')
    expect(history).not.toBeVisible()
    expect(screen.queryByRole('button', { name: '今天的任务' })).not.toBeInTheDocument()
    expect(sessionButton).toBeInTheDocument()
    expect(sessionButton).not.toBeVisible()
    expect(screen.getAllByRole('button')).toHaveLength(2)
    const newTask = screen.getByRole('button', { name: '新建任务' })
    expect(newTask).toBeVisible()
    expect(newTask).toBeEnabled()
    fireEvent.click(newTask)
    expect(props.onNewTask).toHaveBeenCalledTimes(1)

    rerender(<AiTaskSidebarContent {...props} tasksExpanded />)

    expect(screen.getByRole('region', { name: '任务' })).toBe(history)
    expect(screen.getByRole('button', { name: '今天的任务' })).toBe(sessionButton)
    expect(sessionButton).toBeVisible()
    expect(history.scrollTop).toBe(48)
  })

  it('当前会话沿用选中样式，删除中的会话禁用但不影响新建或其他历史', () => {
    const props = createProps({
      activeSessionId: 'today-session',
      removingSessionIds: new Set(['recent-session']),
    })
    render(<AiTaskSidebarContent {...props} />)

    expect(screen.getByRole('button', { name: '今天的任务' })).toHaveClass('is-active')
    const removingButton = screen.getByRole('button', { name: '本周的任务' })
    expect(removingButton).not.toHaveClass('is-active')
    expect(removingButton).toBeDisabled()
    fireEvent.click(removingButton)
    expect(props.onOpenSession).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '新建任务' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '较早的任务' })).toBeEnabled()
  })

  it('加载中沿用刷新文案，不展示旧历史，仍能新建任务', () => {
    const props = createProps({ isLoading: true })
    render(<AiTaskSidebarContent {...props} />)

    expect(screen.getByRole('region', { name: '任务' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('正在刷新会话…')
    expect(screen.queryByRole('button', { name: '今天的任务' })).not.toBeInTheDocument()
    expect(screen.queryByText('还没有历史会话')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '新建任务' }))
    expect(props.onNewTask).toHaveBeenCalledTimes(1)
  })

  it('空历史沿用提示，空时间组不留下标题', () => {
    render(<AiTaskSidebarContent {...createProps({ groups: { today: [], within7Days: [], beyond7Days: [] } })} />)

    expect(screen.getByRole('status')).toHaveTextContent('还没有历史会话')
    expect(screen.getByRole('region', { name: '任务' })).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByText('今天')).not.toBeInTheDocument()
    expect(screen.queryByText('7天内')).not.toBeInTheDocument()
    expect(screen.queryByText('7天外')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新建任务' })).toBeEnabled()
  })

  it('只有较早历史时仍正常显示，不添加其他时间组或截断会话数据', () => {
    const title = '这是一条用于检查长标题完整名称的历史任务'.repeat(8)
    const props = createProps({
      groups: { today: [], within7Days: [], beyond7Days: [createSession('long-title-session', title)] },
    })
    render(<AiTaskSidebarContent {...props} />)

    expect(screen.queryByText('今天')).not.toBeInTheDocument()
    expect(screen.queryByText('7天内')).not.toBeInTheDocument()
    expect(screen.getByText('7天外')).toBeVisible()
    expect(screen.getByRole('button', { name: title })).toHaveTextContent(title)
    fireEvent.click(screen.getByRole('button', { name: title }))
    expect(props.onOpenSession).toHaveBeenCalledTimes(1)
    expect(props.onOpenSession).toHaveBeenCalledWith('long-title-session')
  })

  it('操作使用可聚焦的原生按钮，多实例的折叠关联互不冲突', () => {
    const { container } = render(<>
      <AiTaskSidebarContent {...createProps()} />
      <AiTaskSidebarContent {...createProps()} />
    </>)
    const sidebars = Array.from(container.querySelectorAll<HTMLElement>('.ai-task-sidebar-content'))
    const regionIds = new Set<string>()

    for (const sidebar of sidebars) {
      const content = within(sidebar)
      const toggle = content.getByRole('button', { name: '任务' })
      const history = content.getByRole('region', { name: '任务' })
      expect(toggle).toHaveAttribute('aria-controls', history.id)
      regionIds.add(history.id)
      for (const button of content.getAllByRole('button')) {
        expect(button.tagName).toBe('BUTTON')
        expect(button).toHaveAttribute('type', 'button')
        button.focus()
        expect(button).toHaveFocus()
      }
    }

    expect(regionIds.size).toBe(2)
  })
})
