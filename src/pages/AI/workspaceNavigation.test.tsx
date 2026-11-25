import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import AIPage from './index'
import { authorizedFetch } from '../../utils/request'

vi.mock('../../utils/request', async (load) => ({
  ...await load<typeof import('../../utils/request')>(),
  authorizedFetch: vi.fn(),
  buildAiApiUrl: (path: string) => path,
}))

it('技能社区切栏保留两组列表、搜索词和换组位置，不闪加载提示或重发请求', async () => {
  const rows = (prefix: string) => Array.from({ length: 12 }, (_, i) => ({ skill_name: `${prefix}-${i}`, chinese_name: `示例${prefix}${i}` }))
  const requests: string[] = []
  vi.mocked(authorizedFetch).mockImplementation(async url => {
    const path = String(url)
    if (path.startsWith('/api/v1/skills')) {
      requests.push(path)
      const prefix = path.endsWith('/search') ? '搜索' : path.endsWith('/browse') ? '社区' : '官方'
      return Response.json({ data: { skills: rows(prefix) } })
    }
    return Response.json({ success: true, data: {} })
  })
  localStorage.setItem('userInfo', JSON.stringify({ id: 'skills-nav-test' }))
  try {
    render(<MemoryRouter initialEntries={['/ai']}><AIPage onClose={vi.fn()} /></MemoryRouter>)
    const nav = within(screen.getByRole('navigation', { name: 'AI 工作区' }))
    const switchTo = (name: string) => fireEvent.click(nav.getByRole('button', { name }))
    switchTo('技能')
    await screen.findByText('示例官方0')
    await screen.findByText('示例社区0')
    fireEvent.change(screen.getByPlaceholderText('搜索技能名称、描述或标签'), { target: { value: '示例' } })
    await screen.findByText('示例搜索0')
    for (const changeGroup of screen.getAllByRole('button', { name: '换一换' })) fireEvent.click(changeGroup)
    switchTo('任务')
    switchTo('技能')
    expect(screen.getByPlaceholderText('搜索技能名称、描述或标签')).toHaveValue('示例')
    expect(screen.getByText('示例官方10')).toBeVisible()
    expect(screen.getByText('示例搜索10')).toBeVisible()
    expect(screen.queryByText(/技能加载中/)).not.toBeInTheDocument()
    expect(requests).toEqual(['/api/v1/skills', '/api/v1/skills/clawhub/browse', '/api/v1/skills/clawhub/search'])
  } finally {
    localStorage.removeItem('userInfo')
  }
})

function CurrentRoute() {
  const { search } = useLocation()
  return <output aria-label="当前会话地址">{search}</output>
}

it('从任务直接进入三个栏目再返回，保留原消息、草稿和会话地址，不重新加载会话', async () => {
  const session = { session_id: 'kept', session_name: '原会话', messages: [
    { message_id: 'msg', role: 'user', content: '原消息', created_at: '2026-01-01' },
  ] }
  vi.mocked(authorizedFetch).mockImplementation(async url => {
    const path = String(url)
    if (path.endsWith('/chat/sessions/kept')) return Response.json(session)
    if (path.endsWith('/chat/sessions')) return Response.json({ sessions: [session] })
    return Response.json({ success: true, data: {} })
  })
  localStorage.setItem('userInfo', JSON.stringify({ id: 'nav-test' }))
  // jsdom 没有滚动布局；真实滚动位置在移动尺寸浏览器中验证。
  const scrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
  try {
    render(<MemoryRouter initialEntries={['/ai?sessionId=kept']}><AIPage onClose={vi.fn()} /><CurrentRoute /></MemoryRouter>)
    const nav = within(screen.getByRole('navigation', { name: 'AI 工作区' }))
    const switchTo = (name: string) => fireEvent.click(nav.getByRole('button', { name }))
    const message = await screen.findByText('原消息')
    const draft = screen.getByRole('textbox', { name: '提问输入框' })
    fireEvent.change(draft, { target: { value: '没有发送的草稿' } })

    switchTo('智能体')
    expect(screen.getByRole('heading', { name: '智能体' })).toBeVisible()
    expect(screen.getByPlaceholderText('搜索智能体')).toBeVisible()
    expect(draft).not.toBeVisible()
    switchTo('库')
    expect(await screen.findByText('当前没有可展示的库文件。')).toBeVisible()
    switchTo('技能')
    expect(screen.getByText('技能社区')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '返回任务' }))
    expect(nav.getByRole('button', { current: 'page' })).toHaveTextContent('任务')
    expect(screen.getByRole('textbox', { name: '提问输入框' })).toBe(draft)
    expect(draft).toHaveValue('没有发送的草稿')
    expect(message).toBeVisible()
    expect(screen.getByLabelText('当前会话地址')).toHaveTextContent('?sessionId=kept')
    expect(vi.mocked(authorizedFetch).mock.calls.filter(([url]) => String(url).endsWith('/chat/sessions/kept'))).toHaveLength(1)
  } finally {
    localStorage.removeItem('userInfo')
    if (scrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollTo)
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
  }
})
