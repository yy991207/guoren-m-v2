import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fetchAgentTemplateDetail, fetchAgentTemplateTask, fetchAgentTemplates, generateAgentTemplate } from '../../../services/agentTemplates'
import { AiCreateAgentModal } from './AiCreateAgentModal'

vi.mock('../../../services/agentTemplates', () => ({
  fetchAgentTemplateDetail: vi.fn(), fetchAgentTemplateTask: vi.fn(), fetchAgentTemplates: vi.fn(), generateAgentTemplate: vi.fn(),
}))
const poll = vi.mocked(fetchAgentTemplateTask)

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.mocked(fetchAgentTemplates).mockResolvedValue([])
  vi.mocked(generateAgentTemplate).mockResolvedValue({ taskId: 't1', status: 'pending' })
})
afterEach(() => vi.useRealTimers())

async function submit() {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '备课助手' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '发送创建请求' })) })
}

it('生成中按原间隔轮询，显示完成提示但不打开配置页', async () => {
  const onUseTemplate = vi.fn()
  poll.mockResolvedValueOnce({ status: 'running', message: '智能体正在生成' })
    .mockResolvedValueOnce({ status: 'completed', message: '智能体生成成功' })
  render(<AiCreateAgentModal visible onClose={vi.fn()} onUseTemplate={onUseTemplate} />)
  await submit()
  expect(screen.getByText('智能体正在生成')).toBeVisible()
  expect(screen.getByRole('button', { name: '发送创建请求' })).toBeDisabled()
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(screen.getByText('智能体生成成功')).toBeVisible()
  expect(screen.getByRole('button', { name: '发送创建请求' })).toBeEnabled()
  await act(async () => vi.advanceTimersByTimeAsync(4000))
  expect(poll).toHaveBeenCalledTimes(2)
  expect(onUseTemplate).not.toHaveBeenCalled()
})

it('失败用服务端提示并停止查询', async () => {
  poll.mockResolvedValue({ status: 'failed', message: '智能体生成失败，请稍后再试' })
  render(<AiCreateAgentModal visible onClose={vi.fn()} />)
  await submit()
  expect(screen.getByRole('alert')).toHaveTextContent('智能体生成失败，请稍后再试')
  await act(async () => vi.advanceTimersByTimeAsync(4000))
  expect(poll).toHaveBeenCalledTimes(1)
})

it('关闭弹窗取消等待中的下一次查询', async () => {
  poll.mockResolvedValue({ status: 'running', message: '智能体正在生成' })
  const onClose = vi.fn()
  const view = render(<AiCreateAgentModal visible onClose={onClose} />)
  await submit()
  view.rerender(<AiCreateAgentModal visible={false} onClose={onClose} />)
  await act(async () => vi.advanceTimersByTimeAsync(4000))
  expect(poll).toHaveBeenCalledTimes(1)
})

it('现有固定模板仍用详情数据打开配置页', async () => {
  const template = { templateId: 'preset', templateName: '便签模板', description: '说明', avatarUrl: null, category: '', sortOrder: 0 }
  vi.mocked(fetchAgentTemplates).mockResolvedValueOnce([template])
  vi.mocked(fetchAgentTemplateDetail).mockResolvedValueOnce({ ...template, agentPrompt: '整理便签', presetQuestions: [] })
  const onUseTemplate = vi.fn()
  await act(async () => { render(<AiCreateAgentModal visible onClose={vi.fn()} onUseTemplate={onUseTemplate} />) })
  expect(screen.getByRole('heading', { name: '即刻创建你的助手' })).toBeVisible()
  const dialog = screen.getByRole('dialog', { name: '创建智能体' })
  expect(dialog.querySelector('.ai-create-agent-modal-hero-image')).toHaveAttribute('src', expect.stringContaining('/system/images/banner/'))
  expect(dialog).not.toHaveTextContent(/果仁|账密|密码/)
  expect(dialog).toHaveTextContent('先测试，再发布')
  expect(dialog).toHaveTextContent('发布前先试聊几轮，根据回复效果调整配置。')
  expect(dialog).toHaveTextContent('没有灵感？试试已经做好的智能体～')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '便签模板' })) })
  expect(onUseTemplate).toHaveBeenCalledWith({ agentName: '便签模板', description: '说明', instruction: '整理便签', presetQuestions: [] })
})
