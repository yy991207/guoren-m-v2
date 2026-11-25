import type { ComponentProps } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    open: true,
    onRemoveOne: vi.fn().mockResolvedValue(undefined),
    onRefresh: vi.fn().mockResolvedValue(true),
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
  it('展示新建、任务开关、多选和真实历史，并沿用三个时间分组', () => {
    render(<AiTaskSidebarContent {...createProps()} />)

    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') || button.textContent)).toEqual([
      '新建任务', '任务', '多选对话', '今天的任务', '本周的任务', '较早的任务',
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
    expect(screen.getAllByRole('button')).toHaveLength(3)
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

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const button = (name: string) => screen.getByRole('button', { name })
const checkbox = (name: string) => screen.getByRole('checkbox', { name })

describe('任务侧栏多选删除', () => {
  // jsdom 不实现原生模态框；这里只模拟开关，触摸和焦点隔离在浏览器中检查。
  const native = ['showModal', 'close'].map((key) => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key))
  beforeEach(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
      close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
    })
  })
  afterEach(() => {
    cleanup()
    ;['showModal', 'close'].forEach((key, i) => {
      if (native[i]) Object.defineProperty(HTMLDialogElement.prototype, key, native[i])
      else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
    })
  })

  it('勾选整行不打开会话，全选只选可用项，取消确认及退出模式不发删除请求', () => {
    const props = createProps({ removingSessionIds: new Set(['recent-session']) })
    render(<AiTaskSidebarContent {...props} />)
    fireEvent.click(button('多选对话'))
    expect(button('删除对话')).toBeDisabled()
    fireEvent.click(checkbox('今天的任务'))
    expect(checkbox('全选')).toHaveAttribute('aria-checked', 'mixed')
    expect(checkbox('本周的任务')).toBeDisabled()
    fireEvent.click(checkbox('全选'))
    expect(screen.getByText('已选 2 条')).toBeVisible()
    fireEvent.click(checkbox('全选'))
    expect(button('删除对话')).toBeDisabled()
    fireEvent.click(checkbox('较早的任务'))
    fireEvent.click(button('删除对话'))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('删除选中的 1 条对话？')
    fireEvent.click(button('取消删除'))
    expect(checkbox('较早的任务')).toBeChecked()
    fireEvent.click(button('取消'))
    expect(button('新建任务')).toBeVisible()
    expect(props.onRemoveOne).not.toHaveBeenCalled()
    expect(props.onOpenSession).not.toHaveBeenCalled()
  })

  it('全选超过 50 条不偷偷截取；手动勾选第 51 条被拒绝', () => {
    const today = Array.from({ length: 51 }, (_, i) => createSession(String(i), `第${i}条`))
    render(<AiTaskSidebarContent {...createProps({ groups: { today, within7Days: [], beyond7Days: [] } })} />)
    fireEvent.click(button('多选对话'))
    fireEvent.click(checkbox('全选'))
    expect(screen.getByText('已选 0 条')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('最多选择 50 条')
    const rows = screen.getAllByRole('checkbox').slice(1)
    for (const row of rows) fireEvent.click(row)
    expect(screen.getByText('已选 50 条')).toBeVisible()
    expect(rows[50]).not.toBeChecked()
    fireEvent.click(button('删除对话'))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('删除选中的 50 条对话？')
  })

  it('串行且防重复提交，每次成功才加进度，失败立即停止，只保留未成功项供手动继续', async () => {
    const first = deferred(), second = deferred()
    const removeOne = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValue(undefined)
    const props = createProps({ onRemoveOne: removeOne })
    render(<AiTaskSidebarContent {...props} />)
    fireEvent.click(button('多选对话'))
    fireEvent.click(checkbox('全选'))
    fireEvent.click(button('删除对话'))
    const confirm = button('确认删除')
    act(() => { confirm.click(); confirm.click() })
    expect(removeOne.mock.calls.map(([id]) => id)).toEqual(['today-session'])
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))).toBe(false)
    await act(async () => first.resolve())
    expect(removeOne.mock.calls.map(([id]) => id)).toEqual(['today-session', 'recent-session'])
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByText('已删除 1 / 3 条')).toBeVisible()
    expect(props.onRefresh).not.toHaveBeenCalled()
    await act(async () => second.reject(new Error('删除会话失败')))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已停止：已删除 1 / 3 条')
    expect(checkbox('今天的任务')).not.toBeChecked()
    expect(checkbox('本周的任务')).toBeChecked()
    expect(checkbox('较早的任务')).toBeChecked()
    expect(removeOne).toHaveBeenCalledTimes(2)
    expect(props.onRefresh).toHaveBeenCalledTimes(1)
    fireEvent.click(button('删除对话'))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('删除选中的 2 条对话？')
    fireEvent.click(button('确认删除'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(removeOne.mock.calls.map(([id]) => id)).toEqual(['today-session', 'recent-session', 'recent-session', 'older-session'])
    expect(props.onRefresh).toHaveBeenCalledTimes(2)
    expect(button('多选对话')).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('已删除 2 条对话。')).not.toBeInTheDocument()
  })

  it('删除已成功但刷新失败，不回退计数也不重新删除', async () => {
    const props = createProps({ onRefresh: vi.fn().mockResolvedValue(false) })
    render(<AiTaskSidebarContent {...props} />)
    fireEvent.click(button('多选对话'))
    fireEvent.click(checkbox('今天的任务'))
    fireEvent.click(button('删除对话'))
    fireEvent.click(button('确认删除'))
    expect(await screen.findByText('会话列表刷新失败。')).toBeVisible()
    expect(screen.queryByText(/已删除 1 条对话/)).not.toBeInTheDocument()
    expect(props.onRemoveOne).toHaveBeenCalledOnce()
    expect(props.onRefresh).toHaveBeenCalledOnce()
    expect(button('多选对话')).toBeVisible()
  })

  it('确认范围不随新列表扩大；侧栏关闭或卸载后不发送下一条', async () => {
    const first = deferred()
    const removeOne = vi.fn().mockReturnValue(first.promise)
    const props = createProps({ onRemoveOne: removeOne })
    const { rerender } = render(<AiTaskSidebarContent {...props} />)
    fireEvent.click(button('多选对话'))
    fireEvent.click(checkbox('全选'))
    fireEvent.click(button('删除对话'))
    rerender(<AiTaskSidebarContent {...props} groups={{ ...props.groups, today: [...props.groups.today, createSession('new', '新增')] }} />)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('删除选中的 3 条对话？')
    fireEvent.click(button('确认删除'))
    const signal = removeOne.mock.calls[0][1] as AbortSignal
    rerender(<AiTaskSidebarContent {...props} open={false} />)
    expect(signal.aborted).toBe(true)
    await act(async () => first.resolve())
    expect(removeOne).toHaveBeenCalledOnce()
    expect(props.onRefresh).not.toHaveBeenCalled()
    rerender(<AiTaskSidebarContent {...props} />)
    fireEvent.click(button('多选对话'))
    expect(screen.getByText('已选 0 条')).toBeVisible()
  })
})
