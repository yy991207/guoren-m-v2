import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AiCustomAgentConversationPage } from './AiCustomAgentConversationPage'

const agentName = '特别长的学习计划与课程设计智能体名称'
const avatarUrl = '/avatars/agent.png'
const props = {
  agentName, avatarUrl, description: '', composer: null, questions: [],
  onBack: vi.fn(), onSuggestionClick: vi.fn(),
}

it('没有会话名时单行显示头像和智能体名，有会话名后将两者放到第二行', () => {
  const { container, rerender } = render(<AiCustomAgentConversationPage {...props} />)
  const header = container.querySelector('.ai-agent-config-header') as HTMLElement
  const content = within(header)
  expect(content.getByText(agentName)).toBeVisible()
  expect(content.getByRole('img', { name: `${agentName}头像` }).querySelector('img')).toHaveAttribute('src', avatarUrl)
  expect(header.querySelector('.ai-conversation-heading')).toHaveAttribute('data-layout', 'single')
  expect(content.getAllByText(agentName)).toHaveLength(1)

  rerender(<AiCustomAgentConversationPage {...props} sessionName="我的会话标题" />)
  const title = content.getByText('我的会话标题')
  const name = content.getByText(agentName)
  expect(title.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(name).toHaveAttribute('title', agentName)
  expect(header.querySelector('.ai-conversation-heading')).toHaveAttribute('data-layout', 'stacked')
  expect(content.getByRole('img', { name: `${agentName}头像` }).querySelector('img')).toHaveAttribute('src', avatarUrl)
  expect(content.getAllByText(agentName)).toHaveLength(1)
  expect(screen.getByRole('button', { name: '返回主页' })).toBeVisible()
})
