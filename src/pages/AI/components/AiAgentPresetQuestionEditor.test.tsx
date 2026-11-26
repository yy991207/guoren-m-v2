import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { AiAgentPresetQuestion } from '../utils/agentPresetQuestions'
import { AiAgentPresetQuestionEditor } from './AiAgentPresetQuestionEditor'

function Editor() {
  const [questions, setQuestions] = useState<AiAgentPresetQuestion[]>([])
  return <AiAgentPresetQuestionEditor questions={questions} onChange={setQuestions} />
}

it('添加分类和问题有独立上限，移除最后一个问题后可重新添加分类', () => {
  render(<Editor />)
  const addCategory = screen.getByRole('button', { name: '添加分类' })
  const saveCategory = (name: string) => {
    fireEvent.change(screen.getByRole('textbox', { name: '分类名称' }), { target: { value: name } })
    fireEvent.click(screen.getByRole('button', { name: '确定' }))
  }
  for (const category of ['备课', '课堂', '作业', '复习', '拓展']) {
    fireEvent.click(addCategory)
    saveCategory(category)
  }
  expect(addCategory).toBeDisabled()
  const group = within(screen.getByRole('region', { name: '备课' }))
  const addQuestion = group.getByRole('button', { name: '添加问题到 备课' })
  fireEvent.click(addQuestion)
  fireEvent.click(addQuestion)
  expect(addQuestion).toBeDisabled()
  expect(group.getAllByRole('article')).toHaveLength(3)

  fireEvent.click(group.getByRole('button', { name: '重命名分类 备课' }))
  saveCategory('课堂')
  expect(screen.getByRole('alert')).toHaveTextContent('该分类已存在')
  saveCategory('备课方案')
  expect(screen.queryByRole('region', { name: '备课' })).not.toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: '备课方案' })).getAllByRole('article')).toHaveLength(3)
  fireEvent.click(within(screen.getByRole('region', { name: '拓展' })).getByRole('button', { name: '删除问题1' }))
  expect(addCategory).toBeEnabled()
})

it('分类和问题名称最多 8 字，问题指令最多 100 字，不显示问题编号', () => {
  render(<Editor />)
  fireEvent.click(screen.getByRole('button', { name: '添加分类' }))
  const category = screen.getByRole('textbox', { name: '分类名称' })
  expect(category).toHaveAttribute('maxlength', '8')
  fireEvent.change(category, { target: { value: '测'.repeat(9) } })
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
  expect(screen.getByRole('alert')).toHaveTextContent('分类名称最多 8 字')
  fireEvent.change(category, { target: { value: '测'.repeat(8) } })
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
  const card = within(screen.getByRole('article'))
  expect(card.getByRole('textbox', { name: '名称' })).toHaveAttribute('maxlength', '8')
  expect(card.getByRole('textbox', { name: '指令' })).toHaveAttribute('maxlength', '100')
  expect(card.queryByText(/^问题\s*\d+$/)).not.toBeInTheDocument()
  expect(card.getByRole('button', { name: '删除问题1' })).toBeVisible()
})
