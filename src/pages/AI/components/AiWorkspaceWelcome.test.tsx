import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CommandPromptItem } from '../../../services/commands'
import { AiWorkspaceWelcome } from './AiWorkspaceWelcome'

function createPractice(title: string, index: number): CommandPromptItem {
  return {
    id: `practice-${index}`,
    icon: '图标',
    title,
    summary: '最佳实践简介',
    template: `使用「${title}」的提示词`,
    skillName: null,
    attachments: [],
  }
}

describe('AI 工作区欢迎区', () => {
  it('显示欢迎语和前四个推荐，点击推荐只应用对应的实践', () => {
    const items = ['整理会议纪要', '制定阅读计划', '检查文案', '拟写周报', '其他实践'].map(createPractice)
    const onApply = vi.fn()
    const onOpenAll = vi.fn()

    render(
      <AiWorkspaceWelcome items={items} onApply={onApply} onOpenAll={onOpenAll}>
        Hi <span>小果</span>，有什么可以帮你的？
      </AiWorkspaceWelcome>,
    )

    expect(screen.getByRole('heading', { name: 'Hi 小果，有什么可以帮你的？' })).toBeVisible()
    const recommendedButtons = within(screen.getByRole('list')).getAllByRole('button')
    expect(recommendedButtons).toHaveLength(4)
    for (const [index, button] of recommendedButtons.entries()) {
      expect(button).toHaveAccessibleName(items[index].title)
    }
    expect(screen.getAllByRole('button').at(-1)).toHaveAccessibleName('全部最佳实践')
    expect(screen.queryByRole('button', { name: '其他实践' })).not.toBeInTheDocument()

    fireEvent.click(recommendedButtons[1])
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0][0]).toBe(items[1])
    expect(onOpenAll).not.toHaveBeenCalled()
  })

  it('没有推荐时仍可打开全部最佳实践，不渲染示例条目', () => {
    const onApply = vi.fn()
    const onOpenAll = vi.fn()
    render(
      <AiWorkspaceWelcome items={[]} onApply={onApply} onOpenAll={onOpenAll}>
        你好，有什么可以帮你的？
      </AiWorkspaceWelcome>,
    )

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '全部最佳实践' }))
    expect(onOpenAll).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
  })
})
