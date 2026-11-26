import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
      return Response.json({ data: { skills: [{ name: 'lesson-helper', chinese_name: '教案助手', template: '整理课程', icon_url: '/lesson-avatar.png', source: 'clawhub' }] } })
    }
    if (path === createdPath) return Response.json({ data: { skills: [
      { name: 'exercise-helper', chinese_name: '习题助手' },
      ...Array.from({ length: 25 }, (_, i) => ({ name: `created-${i + 1}`, chinese_name: `自建技能 ${i + 1}` })),
    ] } })
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
  const tabs = within(within(sheet).getByRole('tablist', { name: '技能分类' }))
  const added = within(await within(sheet).findByRole('tabpanel', { name: '我添加的' }))
  expect(tabs.getByRole('tab', { name: '我添加的' })).toHaveAttribute('aria-selected', 'true')
  expect(within(sheet).queryByRole('tabpanel', { name: '我创建的' })).not.toBeInTheDocument()
  const lessonCard = await added.findByRole('article', { name: '教案助手' })
  expect(lessonCard).toHaveClass('ai-skill-card')
  const avatar = within(lessonCard).getByRole('img', { name: '教案助手头像' })
  expect(avatar.querySelector('img')).toHaveAttribute('src', '/lesson-avatar.png')
  fireEvent.error(avatar.querySelector('img')!)
  expect(avatar).toHaveTextContent('教')
  fireEvent.click(tabs.getByRole('tab', { name: '我创建的' }))
  const created = within(within(sheet).getByRole('tabpanel', { name: '我创建的' }))
  expect(created.getAllByRole('article')).toHaveLength(26)
  expect(created.getByRole('article', { name: '自建技能 25' })).toBeVisible()
  expect(created.getByRole('img', { name: '习题助手头像' })).toHaveTextContent('习')
  await act(async () => { resolveOldList(Response.json({ data: { skills: [{ name: 'old-skill', chinese_name: '旧数据' }] } })) })
  expect(within(sheet).queryByText('旧数据')).not.toBeInTheDocument()
  fireEvent.change(search, { target: { value: '教案' } })
  expect(created.getByText('暂无匹配技能')).toBeVisible()
  expect(within(sheet).queryByText('教案助手')).not.toBeInTheDocument()
  fireEvent.click(tabs.getByRole('tab', { name: '我添加的' }))
  expect(search).toHaveValue('教案')
  expect(signals).toHaveLength(2)
  fireEvent.click(within(sheet).getByRole('button', { name: /教案助手/ }))
  expect(sheet).not.toBeInTheDocument()
  expect(draft).toHaveValue('基于 /lesson-helper 整理课程')
  expect(message).toBeVisible()
  expect(screen.getByLabelText('当前会话地址')).toHaveTextContent('?sessionId=kept')
  expect(vi.mocked(authorizedFetch).mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
})

it('任务空输入切栏不聚焦，拍照与文件选择使用各自模式，资料库在底部添加附件', async () => {
  localStorage.setItem('userInfo', JSON.stringify({ id: 'camera-library-test' }))
  localStorage.setItem('SUPERSONIC_USERNAME', 'camera-library-test')
  const parsed = { id: 'node-1', refDriveId: 'resource-1', title: '备课资料.pdf', fileExt: 'pdf', aiParseState: 2 }
  vi.mocked(authorizedFetch).mockImplementation(async url => {
    const path = String(url)
    if (path === '/res/knowledgeSpace/optionList') return Response.json({ result: [{ id: 'org-1', spaceName: '组织空间' }] })
    if (path.startsWith('/res/node/tree?')) {
      const query = new URL(path, 'https://app.test').searchParams
      return Response.json({ result: query.get('scope') === '1' ? [parsed] : [{ ...parsed, id: 'node-2', refDriveId: 'resource-2', title: '组织资料.pdf' }] })
    }
    return Response.json({ success: true, data: {} })
  })
  const requests: Array<{ accept: string; capture: string | null; multiple: boolean }> = []
  const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
    if (this.type === 'file') requests.push({ accept: this.accept, capture: this.getAttribute('capture'), multiple: this.multiple })
  })
  try {
    render(<MemoryRouter initialEntries={['/ai']}><AIPage onClose={vi.fn()} /></MemoryRouter>)
    const nav = within(screen.getByRole('navigation', { name: 'AI 工作区' }))
    const textbox = screen.getByRole('textbox', { name: '提问输入框' })
    fireEvent.click(nav.getByRole('button', { name: '技能' }))
    fireEvent.click(nav.getByRole('button', { name: '任务' }))
    expect(textbox).toHaveAttribute('placeholder', '发消息或按住说话…')
    expect(textbox).not.toHaveFocus()
    expect(requests).toHaveLength(0)

    const plus = screen.getByRole('button', { name: '打开更多操作' })
    const openAction = (name: string) => {
      fireEvent.click(plus)
      fireEvent.click(within(screen.getByRole('dialog', { name: '更多操作' })).getByRole('button', { name }))
    }
    openAction('拍照')
    openAction('选取文件')
    expect(requests).toEqual([
      { accept: 'image/*', capture: 'environment', multiple: false },
      { accept: expect.stringContaining('.pdf'), capture: null, multiple: true },
    ])

    fireEvent.change(textbox, { target: { value: '原草稿' } })
    openAction('资料库')
    const dialog = screen.getByRole('dialog', { name: '选择资料库文件' })
    const picker = within(dialog)
    expect(dialog).toHaveAttribute('open')
    expect(dialog.firstElementChild).toHaveClass('ai-bottom-sheet__panel')
    expect(picker.getByRole('button', { name: '添加' })).toBeDisabled()
    await picker.findByText('备课资料.pdf')
    fireEvent.click(picker.getByRole('tab', { name: '组织' }))
    const file = await picker.findByRole('button', { name: /组织资料.pdf/ })
    fireEvent.click(file)
    expect(file).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(picker.getByRole('button', { name: '添加' }))
    expect(dialog).not.toBeInTheDocument()
    expect(textbox).toHaveValue('原草稿')
    expect(screen.getByText('组织资料.pdf')).toBeVisible()

    openAction('资料库')
    const reopened = within(screen.getByRole('dialog', { name: '选择资料库文件' }))
    expect(await reopened.findByRole('button', { name: /组织资料.pdf/ })).toBeDisabled()
    fireEvent.click(reopened.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: '选择资料库文件' })).not.toBeInTheDocument()
    expect(textbox).toHaveValue('原草稿')
    expect(vi.mocked(authorizedFetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false)
  } finally {
    click.mockRestore()
    localStorage.removeItem('SUPERSONIC_USERNAME')
  }
})

it('智能体编辑与添加弹窗复用技能卡片，保留服务端头像、草稿绑定和推荐安装', async () => {
  localStorage.setItem('userInfo', JSON.stringify({ id: 'agent-skill-card-test' }))
  const agentPath = '/api/v1/custom-agents/study-agent'
  const session = { session_id: 'study', session_name: '学习任务', agent_id: 'study-agent', messages: [] }
  const agent = {
    agent_id: 'study-agent', creator_user_id: 'agent-skill-card-test', agent_name: '学习助手', description: '辅助整理资料', agent_prompt: '辅导学习',
    enabled_skills: [{ skill_name: 'notes', chinese_name: '笔记助手', icon_url: '/notes.png' }], knowledge_spaces: [], preset_questions: [],
  }
  const write = vi.fn<(path: string, body?: BodyInit | null) => void>()
  const recommendedRequests: string[] = []
  vi.mocked(authorizedFetch).mockImplementation(async (url, options) => {
    const path = String(url)
    if (path.endsWith('/chat/sessions/study')) return Response.json(session)
    if (path.endsWith('/chat/sessions')) return Response.json({ sessions: [session] })
    if (path === agentPath && options?.method === 'GET') return Response.json({ data: { agent } })
    if (path === '/api/v1/users/agent-skill-card-test/skills') return Response.json({ data: {
      skills: [{ skill_name: 'lesson', chinese_name: '教案助手', icon_url: '/lesson.png' }],
    } })
    if (path === '/api/v1/custom-agents/skills/recommend') {
      recommendedRequests.push(JSON.parse(String(options?.body)).agent_prompt)
      return Response.json({ data: {
        skills: [{ skill_name: 'search', chinese_name: '搜索助手', source: 'clawhub', icon_url: '/search.png' }],
      } })
    }
    if (options?.method === 'PUT' || options?.method === 'POST') write(path, options.body)
    return Response.json({ success: true, data: {} })
  })
  render(<MemoryRouter initialEntries={['/ai?sessionId=study']}><AIPage onClose={vi.fn()} /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: '打开自定义智能体更多操作' }))
  fireEvent.click(screen.getByRole('button', { name: '智能体详情' }))
  fireEvent.click(await within(screen.getByRole('dialog', { name: '智能体详情' })).findByRole('button', { name: '编辑' }))
  const checkAvatar = (card: HTMLElement, name: string, url: string) => {
    expect(card).toHaveClass('ai-skill-card')
    expect(within(card).getByRole('img', { name: `${name}头像` }).querySelector('img')).toHaveAttribute('src', url)
  }
  const configured = screen.getByRole('article', { name: '笔记助手' })
  checkAvatar(configured, '笔记助手', '/notes.png')
  fireEvent.click(within(configured).getByRole('button', { name: '移除笔记助手' }))
  expect(configured).not.toBeInTheDocument()
  const skillsSection = screen.getByText('Skills 服务', { exact: true }).closest('section')!
  fireEvent.click(within(skillsSection).getByRole('button', { name: '添加' }))
  const sheet = screen.getByRole('dialog', { name: '选择 Skills 服务' })
  const draftCard = await within(sheet).findByRole('article', { name: '教案助手' })
  checkAvatar(draftCard, '教案助手', '/lesson.png')
  const add = within(draftCard).getByRole('button', { name: '配置技能 教案助手' })
  fireEvent.click(add)
  expect(add).toHaveAttribute('aria-pressed', 'true')
  expect(write).not.toHaveBeenCalled()
  const showRecommendations = (currentSheet: HTMLElement) => fireEvent.click(within(currentSheet).getByRole('tab', { name: '技能推荐' }))
  const closeSkillPicker = (currentSheet: HTMLElement) => fireEvent.click(within(currentSheet).getByRole('button', { name: '关闭选择 Skills 服务' }))
  const reopen = () => {
    fireEvent.click(within(skillsSection).getByRole('button', { name: '添加' }))
    return screen.getByRole('dialog', { name: '选择 Skills 服务' })
  }
  showRecommendations(sheet)
  await within(sheet).findByRole('article', { name: '搜索助手' })
  fireEvent.click(within(sheet).getByRole('tab', { name: '我添加的' }))
  showRecommendations(sheet)
  expect(within(sheet).getByRole('article', { name: '搜索助手' })).toBeVisible()
  closeSkillPicker(sheet)
  const reopened = reopen()
  showRecommendations(reopened)
  expect(within(reopened).getByRole('article', { name: '搜索助手' })).toBeVisible()
  expect(recommendedRequests).toEqual(['辅导学习'])
  closeSkillPicker(reopened)

  fireEvent.change(screen.getByRole('textbox', { name: '指令' }), { target: { value: '推荐搜索和整理工具' } })
  const changed = reopen()
  showRecommendations(changed)
  const recommended = await within(changed).findByRole('article', { name: '搜索助手' })
  expect(recommendedRequests).toEqual(['辅导学习', '推荐搜索和整理工具'])
  checkAvatar(recommended, '搜索助手', '/search.png')
  fireEvent.click(within(recommended).getByRole('button', { name: '添加 ClawHub 技能 搜索助手' }))
  await within(changed).findByRole('button', { name: '配置技能 搜索助手', pressed: true })
  expect(write.mock.calls.map(([path]) => path)).toEqual(['/api/v1/skills/clawhub/search/install'])
  closeSkillPicker(changed)
  checkAvatar(screen.getByRole('article', { name: '教案助手' }), '教案助手', '/lesson.png')
  checkAvatar(screen.getByRole('article', { name: '搜索助手' }), '搜索助手', '/search.png')
  fireEvent.click(screen.getByRole('button', { name: '发布' }))
  await screen.findByText('智能体已更新。')
  const publish = write.mock.calls.find(([path]) => path === agentPath)
  expect(JSON.parse(String(publish?.[1])).enabled_skills).toEqual([{ skill_name: 'lesson' }, { skill_name: 'search' }])
})

it('旧推荐问题按分类完整展示；不改问题不重传，改了才校验并整体替换或清空', async () => {
  const userId = 'question-categories-test'
  localStorage.setItem('userInfo', JSON.stringify({ id: userId }))
  const legacyQuestions = [
    { question: '历史问题一', instruction: '指令一' },
    { question: '历史问题二', instruction: '指令二', category: '' },
    { question: '历史问题三', instruction: '指令三', category: '  ' },
    { question: '历史问题四', instruction: '指令四', category: '分类1' },
    { question: '备课问题', instruction: '备课指令', category: '备课' },
  ]
  const legacyPrompt = '教'.repeat(1001)
  const agent = {
    agent_id: 'lesson-agent', creator_user_id: userId, agent_name: '学习助手', description: '整理教案',
    agent_category: 'partner', agent_prompt: legacyPrompt, enabled_skills: [], knowledge_spaces: [], preset_questions: legacyQuestions,
  }
  const session = { session_id: 'lesson', session_name: '历史任务', agent_id: agent.agent_id, messages: [] }
  const updates: Record<string, unknown>[] = []
  vi.mocked(authorizedFetch).mockImplementation(async (url, options) => {
    const path = String(url)
    if (path.endsWith('/chat/sessions/lesson')) return Response.json(session)
    if (path.endsWith('/chat/sessions')) return Response.json({ sessions: [session] })
    if (path.endsWith(`/custom-agents/${agent.agent_id}`)) {
      if (options?.method === 'PUT') {
        const body = JSON.parse(String(options.body)) as Record<string, unknown>
        updates.push(body)
        Object.assign(agent, body)
      }
      return Response.json({ data: { agent } })
    }
    return Response.json({ success: true, data: {} })
  })
  render(<MemoryRouter initialEntries={['/ai?sessionId=lesson']}><AIPage onClose={vi.fn()} /></MemoryRouter>)
  const openDetails = async () => {
    fireEvent.click(await screen.findByRole('button', { name: '打开自定义智能体更多操作' }))
    fireEvent.click(screen.getByRole('button', { name: '智能体详情' }))
    return within(await screen.findByRole('dialog', { name: '智能体详情' }))
  }
  const openEditor = async () => fireEvent.click(await (await openDetails()).findByRole('button', { name: '编辑' }))
  const publish = () => fireEvent.click(screen.getByRole('button', { name: '发布' }))
  const editor = () => within(screen.getByRole('region', { name: '对话配置' }))
  const details = await openDetails()
  expect(within(details.getByRole('region', { name: '分类1' })).getAllByRole('listitem')).toHaveLength(4)
  expect(within(details.getByRole('region', { name: '备课' })).getByText('备课问题')).toBeVisible()
  fireEvent.click(await details.findByRole('button', { name: '编辑' }))
  const mainPrompt = () => screen.getByPlaceholderText('请输入智能体的角色设定、回答风格和边界要求')
  expect(mainPrompt()).toHaveAttribute('maxlength', '1000')
  expect(mainPrompt()).toHaveValue(legacyPrompt)
  fireEvent.change(mainPrompt(), { target: { value: '规'.repeat(1001) } })
  publish()
  expect(screen.getAllByText(/智能体指令最多 1000 字/).length).toBeGreaterThan(0)
  expect(updates).toHaveLength(0)
  fireEvent.change(mainPrompt(), { target: { value: legacyPrompt } })
  publish()
  await waitFor(() => expect(screen.queryByRole('button', { name: '发布' })).not.toBeInTheDocument())
  expect(updates[0]).not.toHaveProperty('agent_prompt')
  expect(updates[0]).not.toHaveProperty('preset_questions')
  expect(updates[0]).not.toHaveProperty('agent_category')

  await openEditor()
  const group = within(editor().getByRole('region', { name: '分类1' }))
  expect(group.getAllByRole('article')).toHaveLength(4)
  expect(group.getByRole('button', { name: '添加问题到 分类1' })).toBeDisabled()
  fireEvent.change(group.getAllByRole('textbox', { name: '名称' })[0], { target: { value: '修改历史问题一' } })
  publish()
  expect(screen.getAllByText(/「分类1」最多 3 个问题/).length).toBeGreaterThan(0)
  expect(updates).toHaveLength(1)
  fireEvent.click(group.getByRole('button', { name: '删除问题4' }))
  const validPrompt = '规'.repeat(1000)
  fireEvent.change(mainPrompt(), { target: { value: validPrompt } })
  publish()
  await waitFor(() => expect(screen.queryByRole('button', { name: '发布' })).not.toBeInTheDocument())
  expect(updates[1].agent_prompt).toBe(validPrompt)
  expect(updates[1].preset_questions).toEqual([
    { category: '分类1', question: '修改历史问题一', instruction: '指令一' },
    { category: '分类1', question: '历史问题二', instruction: '指令二' },
    { category: '分类1', question: '历史问题三', instruction: '指令三' },
    { category: '备课', question: '备课问题', instruction: '备课指令' },
  ])

  await openEditor()
  for (let i = 0; i < 4; i += 1) {
    fireEvent.click(editor().getAllByRole('button', { name: '删除问题1' })[0])
  }
  publish()
  await waitFor(() => expect(screen.queryByRole('button', { name: '发布' })).not.toBeInTheDocument())
  expect(updates[2].preset_questions).toEqual([])
})

it('智能体正式对话和测试与预览都使用任务输入框，调试不向正式会话发送', async () => {
  localStorage.setItem('userInfo', JSON.stringify({ id: 'shared-composer-test' }))
  const agent = {
    agent_id: 'course-agent', creator_user_id: 'shared-composer-test', agent_name: '备课智能体', description: '整理教案',
    agent_prompt: '帮助备课', is_active: true, enable_web_search: true, enabled_skills: [], knowledge_spaces: [],
    preset_questions: [
      { question: '怎么备课？', instruction: '按课程大纲备课', category: '备课' },
      { question: '需要预习吗？', instruction: '生成预习材料', category: '备课' },
      { question: '怎么演示？', instruction: '生成演示脚本', category: '上课' },
      { question: '怎样验收？', instruction: '生成验收表', category: '上课' },
      { question: '怎样复习？', instruction: '按错题复习', category: '复习' },
    ],
  }
  const debugPayloads: unknown[] = []
  vi.mocked(authorizedFetch).mockImplementation(async (url, options) => {
    const path = String(url)
    if (path.endsWith('/custom-agents/public/list')) return Response.json({ data: { agents: [agent], total: 1 } })
    if (path.endsWith('/custom-agents/course-agent')) return Response.json({ data: { agent } })
    if (path.endsWith('/debug/stream')) {
      debugPayloads.push(JSON.parse(String(options?.body)))
      return new Response('data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
    }
    return Response.json({ success: true, data: {} })
  })
  render(<MemoryRouter initialEntries={['/ai']}><AIPage onClose={vi.fn()} /></MemoryRouter>)
  const taskInput = screen.getByRole('textbox', { name: '提问输入框' })
  expect(taskInput.closest('.ai-workspace-composer')).not.toBeNull()
  fireEvent.click(within(screen.getByRole('navigation', { name: 'AI 工作区' })).getByRole('button', { name: '智能体' }))
  fireEvent.click(await screen.findByRole('button', { name: '去对话：备课智能体' }))
  const liveInput = await screen.findByRole('textbox', { name: '自定义智能体输入框' })
  expect(liveInput.closest('.ai-workspace-composer')).not.toBeNull()
  expect(liveInput).toHaveAttribute('placeholder', '发消息或按住说话…')
  fireEvent.click(within(screen.getByRole('region', { name: '备课' })).getByRole('button', { name: '怎么备课？' }))
  expect(liveInput).toHaveValue('按课程大纲备课')
  expect(within(screen.getByRole('region', { name: '复习' })).getByRole('button', { name: '怎样复习？' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '打开更多操作' }))
  const plus = screen.getByRole('dialog', { name: '更多操作' })
  expect(within(plus).getByRole('button', { name: '拍照' })).toBeVisible()
  expect(within(plus).getByRole('switch', { name: /联网/ })).toBeDisabled()
  fireEvent.click(plus)

  fireEvent.click(screen.getByRole('button', { name: '编辑自定义智能体' }))
  fireEvent.click(screen.getByRole('button', { name: '测试与预览' }))
  const debugInput = screen.getByRole('textbox', { name: '智能体调试输入框' })
  const debugComposer = debugInput.closest<HTMLElement>('.ai-workspace-composer')!
  const debugPreview = within(debugInput.closest<HTMLElement>('.ai-agent-chat-preview')!)
  expect(debugInput).toHaveAttribute('placeholder', '发消息或按住说话…')
  fireEvent.click(within(debugPreview.getByRole('region', { name: '复习' })).getByRole('button', { name: '怎样复习？' }))
  expect(debugInput).toHaveValue('按错题复习')
  expect(debugPayloads).toEqual([])
  fireEvent.change(debugInput, { target: { value: '调试这一轮' } })
  expect(within(debugComposer).queryByRole('button', { name: /选择模型|思考强度/ })).not.toBeInTheDocument()
  fireEvent.click(within(debugComposer).getByRole('button', { name: '发送调试消息' }))
  expect(await screen.findByText('调试这一轮')).toBeVisible()
  expect(debugPayloads).toEqual([expect.objectContaining({ message: '调试这一轮', agent_prompt: '帮助备课' })])
  expect(debugPayloads[0]).not.toHaveProperty('model')
  expect(vi.mocked(authorizedFetch).mock.calls.some(([url, options]) => String(url).includes('/chat/sessions') && options?.method === 'POST')).toBe(false)
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
    expect(screen.getByRole('tab', { name: '伙伴' })).toBeVisible()
    expect(screen.queryByRole('tab', { name: '订阅' })).not.toBeInTheDocument()
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
