import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AiAgentConversationPreview } from './AiAgentConversationPreview'

it('基础信息的确定按钮提示发布后保存，确认只提交草稿数据并关闭弹窗', () => {
  const onProfileSave = vi.fn()
  render(<AiAgentConversationPreview
    agentName="原名" description="原简介" inputValue="" questions={[]}
    onInputChange={vi.fn()} onSuggestionClick={vi.fn()} onProfileSave={onProfileSave}
  />)
  fireEvent.click(screen.getByRole('button', { name: '编辑智能体基础信息' }))
  const dialog = within(screen.getByRole('dialog', { name: '编辑基本信息' }))
  const confirm = dialog.getByRole('button', { name: '确定' })
  expect(confirm).toHaveAccessibleDescription('此处只修改草稿，发布智能体后才会保存配置。')
  expect(dialog.queryByRole('button', { name: /保存/ })).not.toBeInTheDocument()
  fireEvent.change(dialog.getByPlaceholderText('请输入智能体名称'), { target: { value: ' 新名称 ' } })
  fireEvent.change(dialog.getByPlaceholderText('请输入一句话介绍'), { target: { value: ' 新简介 ' } })
  fireEvent.click(confirm)
  expect(onProfileSave).toHaveBeenCalledTimes(1)
  expect(onProfileSave).toHaveBeenCalledWith({ agentName: '新名称', description: '新简介' })
  expect(screen.queryByRole('dialog', { name: '编辑基本信息' })).not.toBeInTheDocument()
})
