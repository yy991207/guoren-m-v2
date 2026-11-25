import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AiConversationHeaderActions } from './AiConversationHeaderActions'

describe('对话顶部操作栏', () => {
  it('未提供新建回调时不显示新建按钮', () => {
    render(<AiConversationHeaderActions showSessionMoreAction onClose={vi.fn()} />)

    expect(screen.queryByRole('button', { name: '新建对话' })).not.toBeInTheDocument()
  })

  it('将新建按钮放在更多和关闭左侧，点击时调用一次回调', () => {
    const onNewChat = vi.fn()
    render(<AiConversationHeaderActions showSessionMoreAction onNewChat={onNewChat} onClose={vi.fn()} />)

    const newChatButton = screen.getByRole('button', { name: '新建对话' })
    expect(newChatButton).toHaveAttribute('title', '新建对话')
    expect(screen.getAllByRole('button')).toEqual([
      newChatButton,
      screen.getByRole('button', { name: '打开会话更多操作' }),
      screen.getByRole('button', { name: '关闭页面' }),
    ])

    fireEvent.click(newChatButton)

    expect(onNewChat).toHaveBeenCalledTimes(1)
  })

  it('更多菜单已展开时，点击新建会收起菜单并调用一次回调', () => {
    const onNewChat = vi.fn()
    render(<AiConversationHeaderActions showSessionMoreAction onNewChat={onNewChat} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '打开会话更多操作' }))
    expect(screen.getByRole('button', { name: '保存为指令' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '新建对话' }))

    expect(screen.queryByRole('button', { name: '保存为指令' })).not.toBeInTheDocument()
    expect(onNewChat).toHaveBeenCalledTimes(1)
  })
})
