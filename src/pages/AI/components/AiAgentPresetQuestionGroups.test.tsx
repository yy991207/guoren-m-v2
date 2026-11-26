import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AiAgentPresetQuestionGroups } from './AiAgentPresetQuestionGroups'

const questions = [
  { id: 'legacy', question: '怎么备课', instruction: '生成备课提纲' },
  { id: 'class', category: '课堂 练习', question: '怎么上课', instruction: '生成课堂练习' },
]

it('对话只显示选中分类，带空格的分类也可用键盘切换并正确关联问题列表', () => {
  const onSelect = vi.fn()
  const { rerender } = render(<AiAgentPresetQuestionGroups questions={questions} onSelect={onSelect} />)
  const first = screen.getByRole('tab', { name: '分类1', selected: true })
  expect(screen.getByRole('tabpanel', { name: '分类1' })).toBeVisible()
  expect(screen.queryByRole('button', { name: '怎么上课' })).not.toBeInTheDocument()

  fireEvent.keyDown(first, { key: 'ArrowRight' })
  const second = screen.getByRole('tab', { name: '课堂 练习', selected: true })
  const panel = screen.getByRole('tabpanel', { name: '课堂 练习' })
  expect(second).toHaveFocus()
  expect(second).toHaveAttribute('aria-controls', panel.id)
  expect(onSelect).not.toHaveBeenCalled()
  fireEvent.click(within(panel).getByRole('button', { name: '怎么上课' }))
  expect(onSelect).toHaveBeenCalledWith('生成课堂练习')

  rerender(<AiAgentPresetQuestionGroups questions={questions.slice(0, 1)} onSelect={onSelect} />)
  expect(screen.getByRole('tab', { name: '分类1', selected: true })).toBeVisible()
})

it('详情保持纵向展开所有分组，不出现分类标签或问题按钮', () => {
  render(<AiAgentPresetQuestionGroups questions={questions} />)
  expect(within(screen.getByRole('region', { name: '分类1' })).getByText('怎么备课')).toBeVisible()
  expect(within(screen.getByRole('region', { name: '课堂 练习' })).getByText('怎么上课')).toBeVisible()
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
