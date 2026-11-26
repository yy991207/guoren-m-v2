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

it('技能四类同页不分批，切栏保留搜索和缓存、管理详情返回原分类', async () => {
  const rows = (prefix: string) => Array.from({ length: 12 }, (_, i) => ({ skill_name: `${prefix}-${i}`, chinese_name: `示例${prefix}${i}` }))
  const requests: string[] = []
  vi.mocked(authorizedFetch).mockImplementation(async url => {
    const path = String(url)
    const prefix = ({
      '/api/v1/skills': '官方', '/api/v1/skills/clawhub/browse': '社区', '/api/v1/skills/clawhub/search': '搜索',
      '/api/v1/users/skills-nav-test/skills': '添加', '/api/v1/skills/custom': '创建',
    } as Record<string, string>)[path]
    if (prefix) {
      requests.push(path)
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
    const tabs = within(screen.getByRole('tablist', { name: '技能分类' }))
    const select = (name: string) => fireEvent.click(tabs.getByRole('tab', { name }))
    expect(tabs.getAllByRole('tab')).toHaveLength(4)
    expect(screen.queryByRole('region', { name: '收藏' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist', { name: '指令分类' })).not.toBeInTheDocument()
    await screen.findByText('示例官方11')
    expect(within(screen.getByRole('tabpanel', { name: '官方精选' })).getAllByRole('article')).toHaveLength(12)
    expect(screen.queryByRole('button', { name: '换一换' })).not.toBeInTheDocument()
    expect(screen.queryByText('示例社区0')).not.toBeInTheDocument()
    select('ClawHub')
    await screen.findByText('示例社区11')
    expect(within(screen.getByRole('tabpanel', { name: 'ClawHub' })).getAllByRole('article')).toHaveLength(12)
    expect(screen.queryByRole('button', { name: '换一换' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('搜索技能名称、描述或标签'), { target: { value: '示例' } })
    await screen.findByText('示例搜索11')
    switchTo('任务')
    switchTo('技能')
    expect(screen.getByRole('tab', { name: 'ClawHub' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByPlaceholderText('搜索技能名称、描述或标签')).toHaveValue('示例')
    expect(screen.getByText('示例搜索10')).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: '官方精选' }))
    expect(screen.getByText('示例官方10')).toBeVisible()
    expect(screen.queryByText(/技能加载中/)).not.toBeInTheDocument()
    expect(requests).toEqual(['/api/v1/skills', '/api/v1/skills/clawhub/browse', '/api/v1/skills/clawhub/search'])

    fireEvent.click(screen.getByRole('tab', { name: '我添加的' }))
    await screen.findByText('示例添加0')
    fireEvent.click(screen.getByRole('tab', { name: '我创建的' }))
    const card = within(await screen.findByRole('article', { name: '示例创建0' }))
    fireEvent.click(card.getByRole('button', { name: '删除技能' }))
    const cancel = await screen.findByRole('button', { name: '取消' })
    expect(screen.getByText('确认删除后将无法恢复，是否继续？')).toBeVisible()
    expect(screen.queryByRole('button', { name: '返回技能社区' })).not.toBeInTheDocument()
    fireEvent.click(cancel)
    fireEvent.click(card.getByRole('button', { name: '查看技能详情 示例创建0' }))
    fireEvent.click(screen.getByRole('button', { name: '返回技能社区' }))
    expect(screen.getByRole('tab', { name: '我创建的' })).toHaveAttribute('aria-selected', 'true')
    expect(requests.slice(3)).toEqual(['/api/v1/users/skills-nav-test/skills', '/api/v1/skills/custom'])
  } finally {
    localStorage.removeItem('userInfo')
  }
})

it('三类指令都显示做同款，每张卡片只保留一个应用操作', async () => {
  const command = (name: string) => ({ id: name, name, description: '提示说明', template: '原指令内容', attachments: [], icon: 'https://example.com/command-icon.png' })
  vi.mocked(authorizedFetch).mockImplementation(async url => String(url).endsWith('/commands')
    ? Response.json({ data: { best_practices: [{ ...command('实践示例'), image: '/example-cover.png' }], official_commands: [command('推荐示例')], my_commands: [command('我的示例')] } })
    : Response.json({ success: true, data: {} }))
  render(<MemoryRouter initialEntries={['/ai']}><AIPage onClose={vi.fn()} /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '全部最佳实践' }))
  expect(screen.getByRole('heading', { name: '指令' })).toBeVisible()
  expect(screen.queryByRole('tablist', { name: '技能分类' })).not.toBeInTheDocument()
  expect(await screen.findByRole('img', { name: '实践示例封面' })).toBeVisible()
  const practice = within(screen.getByRole('article', { name: '实践示例' }))
  expect(practice.getByRole('button', { name: '做同款：实践示例' })).toHaveTextContent('做同款')
  expect(practice.getAllByRole('button')).toHaveLength(1)
  expect(screen.queryByRole('img', { name: /头像/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: '推荐指令' }))
  const recommended = within(screen.getByRole('article', { name: '推荐示例' }))
  expect(recommended.getByRole('button', { name: '做同款：推荐示例' })).toHaveTextContent('做同款')
  expect(recommended.getAllByRole('button')).toHaveLength(1)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: '我的指令' }))
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText('搜索指令'), { target: { value: '没有结果' } })
  expect(screen.getByText('未找到匹配的指令')).toBeVisible()
  fireEvent.change(screen.getByPlaceholderText('搜索指令'), { target: { value: '我的' } })
  const own = within(screen.getByRole('article', { name: '我的示例' }))
  expect(own.getByRole('button', { name: '做同款：我的示例' })).toHaveTextContent('做同款')
  expect(own.getAllByRole('button')).toHaveLength(1)
  fireEvent.click(own.getByText('做同款'))
  expect(screen.queryByRole('heading', { name: '指令' })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: '提问输入框' })).toHaveValue('原指令内容')
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
    expect(screen.getByRole('button', { name: '创建智能体' }).textContent).toBe('')
    expect(draft).not.toBeVisible()
    switchTo('库')
    expect(await screen.findByText('当前没有可展示的库文件。')).toBeVisible()
    switchTo('技能')
    expect(screen.getByText('技能社区')).toBeVisible()
    expect(screen.getByRole('button', { name: '创建技能' }).textContent).toBe('')
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
