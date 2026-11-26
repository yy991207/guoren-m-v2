import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { authorizedFetch } from '../../utils/request'
import AIPage from './index'

vi.mock('../../utils/request', async (load) => ({
  ...await load<typeof import('../../utils/request')>(),
  authorizedFetch: vi.fn(),
  buildAiApiUrl: (path: string) => path,
}))

const agent = { agent_name: '学习助手22', avatar_url: '/agent-avatar.png' }
const row = (id: string, name: string) => ({
  session_id: id, session_name: name, user_id: 'heading-fixture',
  created_at: '2026-11-01', updated_at: '2026-11-02', messages: [],
})
const normal = { ...row('ordinary', '普通任务标题'), agent_id: 'general', agent_info: { agent_name: '通用智能体', avatar_url: null } }
const unbound = { ...row('unbound', '未绑定智能体的会话'), agent_id: null }
const history = { ...row('existing', '准备学习计划'), agent_id: 'study-agent', agent_info: agent }
const deepLink = { ...history, session_id: 'not-listed', session_name: '不在列表的会话' }
const unnamed = { ...history, session_id: 'unnamed', session_name: null }
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')

function setup(path: string) {
  const view = render(<MemoryRouter initialEntries={[path]}><AIPage onClose={vi.fn()} /></MemoryRouter>)
  return within(view.container.querySelector('.ai-page-header') as HTMLElement)
}

beforeEach(() => {
  // jsdom 不做滚动布局，手机视口下的实际布局由浏览器检查。
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
  localStorage.setItem('userInfo', JSON.stringify({ id: 'heading-fixture' }))
  vi.mocked(authorizedFetch).mockReset().mockImplementation(async url => {
    const path = String(url)
    if (path.endsWith('/chat/sessions')) return Response.json({ sessions: [normal, history, unbound] })
    for (const item of [normal, history, deepLink, unnamed, unbound]) {
      if (path.endsWith(`/chat/sessions/${item.session_id}`)) return Response.json(item)
    }
    return Response.json({ success: true, data: {} })
  })
})

afterEach(() => {
  cleanup()
  localStorage.removeItem('userInfo')
  if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
})

it('通用和其他智能体会话都显示名字及头像，未绑定的会话只显示会话名', async () => {
  const header = setup('/ai?sessionId=ordinary')
  expect(await header.findByText(normal.session_name)).toBeVisible()
  expect(await header.findByText('通用智能体')).toBeVisible()
  expect(header.getByRole('img', { name: '通用智能体头像' })).toHaveTextContent('通')
  const openHistory = async (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: '打开对话历史' }))
    const drawer = screen.getByRole('dialog', { name: '任务历史' })
    fireEvent.click(await within(drawer).findByRole('button', { name }))
  }
  await openHistory(history.session_name)
  expect(await header.findByText(history.session_name)).toBeVisible()
  expect(header.getByText(agent.agent_name)).toBeVisible()
  expect(header.getByRole('img', { name: `${agent.agent_name}头像` }).querySelector('img')).toHaveAttribute('src', agent.avatar_url)

  await openHistory(normal.session_name)
  expect(await header.findByText(normal.session_name)).toBeVisible()
  expect(header.queryByText(agent.agent_name)).not.toBeInTheDocument()
  expect(header.getByText('通用智能体')).toBeVisible()

  await openHistory(unbound.session_name)
  expect(await header.findByText(unbound.session_name)).toBeVisible()
  expect(header.queryByText(agent.agent_name)).not.toBeInTheDocument()
  expect(header.queryByText('通用智能体')).not.toBeInTheDocument()
})

it('刷新直接进入未列出的会话时，复用会话详情恢复标题和头像', async () => {
  const header = setup('/ai?sessionId=not-listed')
  expect(await header.findByText(deepLink.session_name)).toBeVisible()
  expect(header.getByText(agent.agent_name)).toBeVisible()
  expect(header.getByRole('img', { name: `${agent.agent_name}头像` }).querySelector('img')).toHaveAttribute('src', agent.avatar_url)
  await waitFor(() => expect(vi.mocked(authorizedFetch).mock.calls.filter(([url]) => String(url).endsWith('/chat/sessions/not-listed'))).toHaveLength(1))
})

it('直接打开尚未生成会话名的智能体对话时，也保留单行头像和名称', async () => {
  const header = setup('/ai?sessionId=unnamed')
  expect(await header.findByText(agent.agent_name)).toBeVisible()
  expect(header.getByRole('img', { name: `${agent.agent_name}头像` }).querySelector('img')).toHaveAttribute('src', agent.avatar_url)
  expect(header.queryByText(history.session_name)).not.toBeInTheDocument()
})
