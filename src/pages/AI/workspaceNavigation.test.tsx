import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AIPage from './index'
import { authorizedFetch } from '../../utils/request'

vi.mock('../../utils/request', async (load) => ({
  ...await load<typeof import('../../utils/request')>(),
  authorizedFetch: vi.fn(),
  buildAiApiUrl: (path: string) => path,
}))

const dialogMethods = ['showModal', 'close'] as const
const nativeDialog = dialogMethods.map(key => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key))
const nativeScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')
beforeEach(() => {
  vi.mocked(authorizedFetch).mockReset()
  // jsdom 不实现原生模态框和滚动；几何与触摸在浏览器里验证。
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
})
afterEach(() => {
  cleanup()
  localStorage.removeItem('userInfo')
  dialogMethods.forEach((key, index) => {
    const native = nativeDialog[index]
    if (native) Object.defineProperty(HTMLDialogElement.prototype, key, native)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
  })
  if (nativeScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', nativeScrollTo)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
})

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
    const added = within(await screen.findByRole('article', { name: '示例添加0' }))
    fireEvent.click(added.getByRole('button', { name: '移除技能' }))
    const removeDialog = screen.getByRole('dialog', { name: '移除技能「示例添加0」？' })
    expect(removeDialog).toHaveAccessibleDescription('移除后，该技能不再显示在「我添加的」中。')
    expect(within(removeDialog).getByRole('button', { name: '确认移除' })).toBeVisible()
    fireEvent.click(within(removeDialog).getByRole('button', { name: '取消移除' }))
    fireEvent.click(screen.getByRole('tab', { name: '我创建的' }))
    const card = within(await screen.findByRole('article', { name: '示例创建0' }))
    fireEvent.click(card.getByRole('button', { name: '删除技能' }))
    const deleteDialog = screen.getByRole('dialog', { name: '删除技能「示例创建0」？' })
    expect(deleteDialog).toHaveAccessibleDescription('删除后无法恢复。')
    expect(screen.queryByRole('button', { name: '返回技能社区' })).not.toBeInTheDocument()
    fireEvent.click(within(deleteDialog).getByRole('button', { name: '取消删除' }))
    expect(vi.mocked(authorizedFetch).mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(0)
    fireEvent.click(card.getByRole('button', { name: '查看技能详情 示例创建0' }))
    fireEvent.click(screen.getByRole('button', { name: '返回技能社区' }))
    expect(screen.getByRole('tab', { name: '我创建的' })).toHaveAttribute('aria-selected', 'true')
    expect(requests.slice(3)).toEqual(['/api/v1/users/skills-nav-test/skills', '/api/v1/skills/custom'])
  } finally {
    localStorage.removeItem('userInfo')
  }
})

it('技能卡片优先显示接口头像，缺少地址或图片加载失败才显示首字', async () => {
  localStorage.setItem('userInfo', JSON.stringify({ id: 'skill-avatar-test' }))
  const imageUrl = 'https://assets.test/skill.png'
  const skills = [
    { name: 'with-icon', chinese_name: '课程助手', icon_url: imageUrl },
    { name: 'no-icon', chinese_name: '教案助手', icon_url: '' },
    { name: 'broken-icon', chinese_name: '练习助手', icon_url: 'https://assets.test/missing.png' },
  ]
  vi.mocked(authorizedFetch).mockImplementation(async url => Response.json({
    data: String(url) === '/api/v1/skills' ? { skills } : {},
  }))
  render(<MemoryRouter initialEntries={['/ai']}><AIPage onClose={vi.fn()} /></MemoryRouter>)
  fireEvent.click(within(screen.getByRole('navigation', { name: 'AI 工作区' })).getByRole('button', { name: '技能' }))

  const imageAvatar = await screen.findByRole('img', { name: '课程助手头像' })
  expect(imageAvatar.querySelector('img')).toHaveAttribute('src', imageUrl)
  expect(imageAvatar).not.toHaveTextContent('课')

  const missingAvatar = screen.getByRole('img', { name: '教案助手头像' })
  expect(missingAvatar.querySelector('img')).toBeNull()
  expect(missingAvatar).toHaveTextContent('教')

  const brokenAvatar = screen.getByRole('img', { name: '练习助手头像' })
  const brokenImage = brokenAvatar.querySelector('img')!
  expect(brokenImage).toHaveAttribute('src', skills[2].icon_url)
  fireEvent.error(brokenImage)
  expect(brokenImage).not.toBeInTheDocument()
  expect(brokenAvatar).toHaveTextContent('练')
})

it('技能卡片快捷添加与详情使用同一状态，已添加后可直接回任务', async () => {
  localStorage.setItem('userInfo', JSON.stringify({ id: 'quick-skill-test' }))
  const skill = { id: 'official-1', skill_name: 'lesson-helper', chinese_name: '备课助手', template: '整理课程', is_selected: false }
  const claw = { id: 'claw-1', skill_name: 'claw-helper', chinese_name: '社区助手', is_selected: false }
  let finishAdd!: (response: Response) => void
  const deferredAdd = new Promise<Response>(resolve => { finishAdd = resolve })
  const requests: Array<{ path: string; body?: BodyInit | null }> = []
  vi.mocked(authorizedFetch).mockImplementation(async (url, options) => {
    const path = String(url)
    if (options?.method === 'POST' && path.includes('/skills')) {
      requests.push({ path, body: options.body })
      if (path.endsWith('/install')) return new Response(null, { status: 500 })
      return deferredAdd
    }
    if (path === '/api/v1/skills') return Response.json({ data: { skills: [skill] } })
    if (path.endsWith('/clawhub/browse')) return Response.json({ data: { skills: [{ ...skill, id: 'duplicate' }, claw] } })
    return Response.json({ success: true, data: {} })
  })
  render(<MemoryRouter initialEntries={['/ai']}><AIPage onClose={vi.fn()} /></MemoryRouter>)
  fireEvent.click(within(screen.getByRole('navigation', { name: 'AI 工作区' })).getByRole('button', { name: '技能' }))
  const add = await screen.findByRole('button', { name: '添加技能 备课助手' })
  act(() => { add.click(); add.click() })
  expect(screen.getByRole('button', { name: '正在添加技能 备课助手' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: '返回技能社区' })).not.toBeInTheDocument()
  expect(requests).toEqual([{ path: '/api/v1/users/quick-skill-test/skills', body: JSON.stringify({ skill_name: 'lesson-helper' }) }])

  fireEvent.click(screen.getByRole('tab', { name: 'ClawHub' }))
  expect(await screen.findByRole('button', { name: '正在添加技能 备课助手' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '添加技能 社区助手' }))
  expect(await screen.findByText('添加技能失败')).toBeVisible()
  expect(screen.getByRole('button', { name: '添加技能 社区助手' })).toBeEnabled()
  expect(requests.map(({ path }) => path)).toEqual(['/api/v1/users/quick-skill-test/skills', '/api/v1/skills/clawhub/claw-helper/install'])

  await act(async () => { finishAdd(Response.json({ success: true })) })
  const useSkill = screen.getByRole('button', { name: '使用技能 备课助手' })
  fireEvent.click(useSkill)
  expect(screen.getByRole('textbox', { name: '提问输入框' })).toHaveValue('基于 /lesson-helper 整理课程')
  expect(screen.queryByRole('tablist', { name: '技能分类' })).not.toBeInTheDocument()
})

it.each([
  { tab: '官方精选', listPath: '/api/v1/skills', source: '官方推荐', type: 'system', detailIcon: 'https://assets.test/detail.png', listIcon: 'https://assets.test/list.png' },
  { tab: 'ClawHub', listPath: '/api/v1/skills/clawhub/browse', source: 'ClawHub', type: 'clawhub', detailIcon: 'https://assets.test/missing.png', listIcon: 'https://assets.test/list.png' },
  { tab: '我添加的', listPath: '/api/v1/users/skill-detail-test/skills', source: '我添加的', type: 'system', listIcon: 'https://assets.test/list.png' },
  { tab: '我创建的', listPath: '/api/v1/skills/custom', source: '我创建的', type: 'custom' },
])('$tab 的技能详情只显示两枚基本信息标签，优先使用详情头像', async ({ tab, listPath, source, type, detailIcon, listIcon }) => {
  localStorage.setItem('userInfo', JSON.stringify({ id: 'skill-detail-test' }))
  const title = '备课助手'
  const skill = { skill_name: 'lesson-helper', chinese_name: title, description: '整理课程', tags: ['备课'], icon_url: listIcon }
  vi.mocked(authorizedFetch).mockImplementation(async url => {
    const path = String(url)
    if (path === listPath) return Response.json({ data: { skills: [skill] } })
    if (path === '/api/v1/skills/lesson-helper') {
      return Response.json({ data: { ...skill, icon_url: detailIcon, skill_type: 'system', placeholders: ['主题'], template: '整理/主题' } })
    }
    if (path === '/api/v1/skills/clawhub/lesson-helper') {
      return Response.json({ data: {
        skill: { slug: skill.skill_name, displayName: title, stats: { downloads: 20, stars: 10 } },
        iconUrl: detailIcon,
        owner: { displayName: '发布者' }, latestVersion: { version: '1.2.3' },
      } })
    }
    return Response.json({ success: true, data: {} })
  })
  render(<MemoryRouter initialEntries={['/ai']}><AIPage onClose={vi.fn()} /></MemoryRouter>)
  fireEvent.click(within(screen.getByRole('navigation', { name: 'AI 工作区' })).getByRole('button', { name: '技能' }))
  fireEvent.click(screen.getByRole('tab', { name: tab }))
  fireEvent.click(await screen.findByRole('button', { name: `查看技能详情 ${title}` }))

  const tags = within(await screen.findByRole('list', { name: '技能基本信息' })).getAllByRole('listitem')
  expect(tags.map(tag => tag.textContent)).toEqual([`来源：${source}`, `技能类型：${type}`])
  const avatar = screen.getByRole('img', { name: `${title}头像` })
  const expectedIcon = detailIcon || listIcon
  if (expectedIcon) expect(avatar.querySelector('img')).toHaveAttribute('src', expectedIcon)
  if (type === 'clawhub') fireEvent.error(avatar.querySelector('img')!)
  if (!expectedIcon || type === 'clawhub') {
    expect(avatar.querySelector('img')).toBeNull()
    expect(avatar).toHaveTextContent('备')
  }
  expect(screen.queryByText(/^(配置项|模板变量|标签数|开发者|添加次数|收藏次数)$/)).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '使用场景' })).toBeVisible()
  if (type === 'system') expect(screen.getByText('整理【主题】')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '版本记录' }))
  expect(screen.getByRole('heading', { name: '版本记录' })).toBeVisible()
  if (type === 'clawhub') expect(screen.getByText('1.2.3')).toBeVisible()
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

it('单条对话删除使用同一确认框，等待时不可取消，失败保留对话和提示', async () => {
  localStorage.setItem('userInfo', JSON.stringify({ id: 'single-delete-test' }))
  const session = { session_id: 'to-delete', session_name: '测试会话', created_at: '2026-01-01', messages: [
    { message_id: 'm', role: 'user', content: '原消息' },
  ] }
  let failDelete!: (response: Response) => void
  const pendingDelete = new Promise<Response>(resolve => { failDelete = resolve })
  const remove = vi.fn(() => pendingDelete)
  vi.mocked(authorizedFetch).mockImplementation(async (url, options) => {
    const path = String(url)
    if (path.endsWith('/chat/sessions/to-delete')) return options?.method === 'DELETE' ? remove() : Response.json(session)
    if (path.endsWith('/chat/sessions')) return Response.json({ sessions: [session] })
    return Response.json({ success: true, data: {} })
  })
  render(<MemoryRouter initialEntries={['/ai?sessionId=to-delete']}><AIPage onClose={vi.fn()} /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '打开会话更多操作' }))
  fireEvent.click(screen.getByRole('button', { name: '删除会话记录' }))
  const dialog = screen.getByRole('dialog', { name: '删除对话「测试会话」？' })
  expect(dialog).toHaveAccessibleDescription('删除后无法恢复。')
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }))
  expect(dialog).toHaveAccessibleName('正在删除对话')
  expect(within(dialog).getByRole('status')).toHaveTextContent('删除中…')
  expect(fireEvent(dialog, new Event('cancel', { cancelable: true }))).toBe(false)
  expect(remove).toHaveBeenCalledTimes(1)
  await act(async () => { failDelete(new Response(null, { status: 500 })) })
  expect(screen.getByText('删除会话失败')).toBeVisible()
  expect(dialog).toHaveAccessibleName('删除对话「测试会话」？')
  fireEvent.click(within(dialog).getByRole('button', { name: '取消删除' }))
  expect(screen.getByText('原消息')).toBeVisible()
})

function CurrentRoute() {
  const { search } = useLocation()
  return <output aria-label="当前会话地址">{search}</output>
}

it('对话内用底部弹窗搜索和选用技能，关闭不动草稿，选中不自动发送', async () => {
  localStorage.setItem('userInfo', JSON.stringify({ id: 'chat-skill-picker-test' }))
  const session = { session_id: 'kept', session_name: '原会话', messages: [
    { message_id: 'msg', role: 'user', content: '原消息', created_at: '2026-01-01' },
  ] }
  const addedPath = '/api/v1/users/chat-skill-picker-test/skills'
  const createdPath = '/api/v1/skills/custom'
  const signals: AbortSignal[] = []
  let resolveOldList!: (response: Response) => void
  const oldList = new Promise<Response>(resolve => { resolveOldList = resolve })
  vi.mocked(authorizedFetch).mockImplementation(async (url, options) => {
    const path = String(url)
    if (path.endsWith('/chat/sessions/kept')) return Response.json(session)
    if (path.endsWith('/chat/sessions')) return Response.json({ sessions: [session] })
    if (path === addedPath) {
      if (options?.signal) signals.push(options.signal)
      if (signals.length === 1) return oldList
      return Response.json({ data: { skills: [{ name: 'lesson-helper', chinese_name: '教案助手', template: '整理课程' }] } })
    }
    if (path === createdPath) return Response.json({ data: { skills: [{ name: 'exercise-helper', chinese_name: '习题助手' }] } })
    return Response.json({ success: true, data: {} })
  })

  render(<MemoryRouter initialEntries={['/ai?sessionId=kept']}><AIPage onClose={vi.fn()} /><CurrentRoute /></MemoryRouter>)
  const message = await screen.findByText('原消息')
  const draft = screen.getByRole('textbox', { name: '提问输入框' })
  const plus = screen.getByRole('button', { name: '打开更多操作' })
  const openSkills = () => {
    fireEvent.click(plus)
    const more = within(screen.getByRole('dialog', { name: '更多操作' }))
    fireEvent.click(more.getByRole('button', { name: '技能' }))
    return screen.getByRole('dialog', { name: '选择技能' })
  }

  fireEvent.change(draft, { target: { value: '原有草稿' } })
  const firstSheet = openSkills()
  expect(firstSheet).toHaveAttribute('open')
  expect(firstSheet.firstElementChild).toHaveClass('ai-bottom-sheet__panel')
  expect(within(firstSheet).getByText('技能加载中…')).toBeVisible()
  expect(message).toBeVisible()
  fireEvent.click(within(firstSheet).getByRole('button', { name: '关闭技能选择' }))
  expect(firstSheet).not.toBeInTheDocument()
  expect(signals[0].aborted).toBe(true)
  expect(draft).toHaveValue('原有草稿')

  const sheet = openSkills()
  const search = within(sheet).getByRole('searchbox', { name: '搜索可用技能' })
  await within(sheet).findByText('教案助手')
  expect(within(sheet).getByText('习题助手')).toBeVisible()
  await act(async () => { resolveOldList(Response.json({ data: { skills: [{ name: 'old-skill', chinese_name: '旧数据' }] } })) })
  expect(within(sheet).queryByText('旧数据')).not.toBeInTheDocument()
  fireEvent.change(search, { target: { value: '教案' } })
  expect(within(sheet).queryByText('习题助手')).not.toBeInTheDocument()
  expect(signals).toHaveLength(2)
  fireEvent.click(within(sheet).getByRole('button', { name: /教案助手/ }))
  expect(sheet).not.toBeInTheDocument()
  expect(draft).toHaveValue('基于 /lesson-helper 整理课程')
  expect(message).toBeVisible()
  expect(screen.getByLabelText('当前会话地址')).toHaveTextContent('?sessionId=kept')
  expect(vi.mocked(authorizedFetch).mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
})

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
  }
})
