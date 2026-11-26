import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { Toast } from 'antd-mobile'
import { beforeEach, expect, it, vi } from 'vitest'
import { AgentRequestError, groupVisibleAgents, listVisibleAgents, setAgentFavorite, setAgentSubscription } from '../../../services/agents'
import type { AgentSubscription, AgentSubscriptionState, DiscoverAgentItem } from '../../../services/agents'
import { AiDiscoverPage } from '../components/AiDiscoverPage'
import { useDiscoverAgents } from './useDiscoverAgents'

vi.mock('../../../services/agents', async (load) => ({
  ...await load<typeof import('../../../services/agents')>(), listVisibleAgents: vi.fn(), setAgentSubscription: vi.fn(), setAgentFavorite: vi.fn(),
}))
vi.mock('antd-mobile', async (load) => ({ ...await load<typeof import('antd-mobile')>(), Toast: { show: vi.fn() } }))
vi.mock('../../IM/utils/displayNameHooks', () => ({ useDisplayNamePrefetch: vi.fn() }))
vi.mock('../../../components/DisplayName', () => ({ default: () => null }))

const subscribed = { value: true, isFavorite: false } as const
const favorite = { value: true, isFavorite: true } as const
const unsubscribed = { value: false } as const
const publicAgent: DiscoverAgentItem = {
  agentId: 'public-id', agentName: '公开助手', creatorUserId: 'other', tenantId: null, description: '', avatarUrl: null,
  isActive: true, publishScope: 'public', subscription: unsubscribed, createdAt: '', updatedAt: '',
}
const privateAgent: DiscoverAgentItem = {
  ...publicAgent, agentId: 'private-id', agentName: '私有助手', creatorUserId: 'me', tenantId: '1002',
  isActive: false, publishScope: 'private', subscription: favorite,
}
const stateFor = (subscription: AgentSubscription): AgentSubscriptionState => ({ agentId: publicAgent.agentId, subscription })
const list = vi.mocked(listVisibleAgents)
const subscriptionWrite = vi.mocked(setAgentSubscription)
const favoriteWrite = vi.mocked(setAgentFavorite)

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>(finish => { resolve = finish })
  return { promise, resolve }
}

function Page({ onOpenAgentChat }: { onOpenAgentChat: (agent: DiscoverAgentItem) => void }) {
  const agents = useDiscoverAgents(true)
  const groups = groupVisibleAgents(agents.visibleAgents, 'me')
  return <AiDiscoverPage
    allAgents={agents.visibleAgents}
    discoverError={agents.discoverError} discoverLoading={agents.discoverLoading}
    discoverSections={[
      { key: 'subscribed', title: '订阅', items: groups.subscribed },
      { key: 'official', title: '官方智能体', items: groups.official },
      { key: 'enterprise', title: '企业智能体', items: groups.enterprise },
      { key: 'collaboration', title: '共创', items: groups.collaboration },
      { key: 'mine', title: '我的智能体', items: groups.mine },
    ]}
    favoriteAgents={groups.favorite}
    pendingAgentIds={agents.pendingAgentIds} onChangeSubscription={agents.changeSubscription} onChangeFavorite={agents.changeFavorite}
    onOpenAgentChat={onOpenAgentChat} onOpenCreateAgent={vi.fn()} onBack={vi.fn()}
  />
}

beforeEach(() => vi.resetAllMocks())

it('加载智能体列表复用页面加载组件，成功后切换为列表', async () => {
  const pending = deferred<DiscoverAgentItem[]>()
  list.mockReturnValueOnce(pending.promise)
  render(<Page onOpenAgentChat={vi.fn()} />)
  const loading = screen.getByRole('status')
  expect(loading).toHaveClass('ai-loading')
  expect(loading).toHaveAttribute('data-variant', 'page')
  expect(loading).toHaveTextContent('智能体列表加载中…')
  await act(async () => pending.resolve([publicAgent]))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByRole('article', { name: publicAgent.agentName })).toBeVisible()
})

const favoritesPanel = () => within(screen.getByRole('region', { name: '收藏' }))
const categoryPanel = (name: string) => within(screen.getByRole('tabpanel', { name }))
const selectCategory = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))
const chatName = (agent: DiscoverAgentItem) => `去对话：${agent.agentName}`
const more = (card: ReturnType<typeof within>) => card.getByRole('button', { name: /^更多操作：/ })
const action = (card: ReturnType<typeof within>, name: string) => {
  fireEvent.click(more(card))
  fireEvent.click(card.getByRole('button', { name }))
}

it('默认全部且不重复显示，切换分类不影响顶部收藏或搜索', async () => {
  const onOpenAgentChat = vi.fn()
  list.mockResolvedValueOnce([publicAgent, privateAgent])
  render(<Page onOpenAgentChat={onOpenAgentChat} />)
  const top = await screen.findByRole('region', { name: '收藏' })
  const tabs = screen.getByRole('tablist', { name: '智能体分类' })
  expect(top.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(tabs).toHaveAttribute('data-variant', 'chips')
  expect(within(tabs).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['全部', '订阅', '官方', '企业', '共创', '我的'])
  expect(within(tabs).getByRole('tab', { name: '全部' })).toHaveAttribute('aria-selected', 'true')
  expect(categoryPanel('全部').getAllByRole('article')).toHaveLength(2)
  expect(favoritesPanel().getByRole('button', { name: chatName(privateAgent) })).toBeDisabled()
  selectCategory('订阅')
  const privateCard = within(categoryPanel('订阅').getByRole('article', { name: privateAgent.agentName }))
  expect(privateCard.getByRole('button', { name: chatName(privateAgent) })).toBeDisabled()
  fireEvent.click(more(privateCard))
  expect(privateCard.getByRole('button', { name: '取消订阅' })).toBeEnabled()

  selectCategory('官方')
  expect(screen.queryByRole('tabpanel', { name: '订阅' })).not.toBeInTheDocument()
  expect(favoritesPanel().getByRole('button', { name: chatName(privateAgent) })).toBeDisabled()
  const publicCard = within(categoryPanel('官方').getByRole('article', { name: publicAgent.agentName }))
  fireEvent.click(more(publicCard))
  expect(publicCard.getByRole('button', { name: '订阅' })).toBeEnabled()
  expect(publicCard.queryByRole('button', { name: '收藏' })).not.toBeInTheDocument()
  fireEvent.keyDown(publicCard.getByRole('button', { name: '订阅' }), { key: 'Escape' })
  expect(more(publicCard)).toHaveFocus()
  expect(publicCard.queryByRole('button', { name: '订阅' })).not.toBeInTheDocument()
  expect(onOpenAgentChat).not.toHaveBeenCalled()

  fireEvent.click(publicCard.getByRole('button', { name: chatName(publicAgent) }))
  expect(onOpenAgentChat).toHaveBeenCalledWith(expect.objectContaining({ subscription: unsubscribed }))
  fireEvent.change(screen.getByRole('searchbox', { name: '搜索智能体' }), { target: { value: publicAgent.agentName } })
  expect(favoritesPanel().getByText('暂无收藏的智能体')).toBeVisible()
  selectCategory('订阅')
  expect(categoryPanel('订阅').getByText('暂无订阅的智能体')).toBeVisible()
  expect(screen.getByRole('searchbox', { name: '搜索智能体' })).toHaveValue(publicAgent.agentName)
  expect(list).toHaveBeenCalledTimes(1)
})

it('菜单写入在分类间同步；取消收藏不退订，退订同时清除收藏', async () => {
  const pendingWrite = deferred<AgentSubscriptionState>()
  const onOpenAgentChat = vi.fn()
  list.mockResolvedValueOnce([publicAgent, privateAgent])
  subscriptionWrite.mockResolvedValueOnce(stateFor(subscribed)).mockResolvedValueOnce(stateFor(unsubscribed))
  favoriteWrite.mockReturnValueOnce(pendingWrite.promise).mockResolvedValueOnce(stateFor(subscribed)).mockResolvedValueOnce(stateFor(favorite))
  render(<Page onOpenAgentChat={onOpenAgentChat} />)

  const cardIn = (category: string) => within(categoryPanel(category).getByRole('article', { name: publicAgent.agentName }))
  await screen.findByRole('tabpanel', { name: '全部' })
  action(cardIn('全部'), '订阅')
  selectCategory('订阅')
  await categoryPanel('订阅').findByRole('article', { name: publicAgent.agentName })
  action(cardIn('订阅'), '收藏')
  expect(favoriteWrite).toHaveBeenCalledWith(publicAgent.agentId, true, expect.any(AbortSignal))
  expect(more(cardIn('订阅'))).toBeDisabled()
  selectCategory('全部')
  expect(more(cardIn('全部'))).toBeDisabled()
  expect(cardIn('全部').getByRole('button', { name: chatName(publicAgent) })).toBeEnabled()
  expect(onOpenAgentChat).not.toHaveBeenCalled()

  const topEntry = () => favoritesPanel().queryByRole('button', { name: chatName(publicAgent) })
  await act(async () => pendingWrite.resolve(stateFor(favorite)))
  expect(topEntry()).toBeVisible()
  fireEvent.click(topEntry()!)
  expect(onOpenAgentChat).toHaveBeenCalledWith(expect.objectContaining({ subscription: favorite }))
  selectCategory('订阅')
  action(cardIn('订阅'), '取消收藏')
  await waitFor(() => expect(topEntry()).not.toBeInTheDocument())
  expect(more(cardIn('订阅'))).toBeEnabled()
  action(cardIn('订阅'), '收藏')
  await waitFor(() => expect(topEntry()).toBeVisible())
  action(cardIn('订阅'), '取消订阅')
  await waitFor(() => expect(topEntry()).not.toBeInTheDocument())
  expect(categoryPanel('订阅').queryByRole('article', { name: publicAgent.agentName })).not.toBeInTheDocument()
  selectCategory('官方')
  expect(more(cardIn('官方'))).toBeEnabled()
  expect(favoriteWrite.mock.calls.map(([, target]) => target)).toEqual([true, false, true])
  expect(subscriptionWrite.mock.calls.map(([, target]) => target)).toEqual([true, false])
  expect(list).toHaveBeenCalledTimes(1)
})

it('收藏分卡不受切换影响，当前分类一次显示全部且不重查', async () => {
  const agents = Array.from({ length: 7 }, (_, index) => ({
    ...publicAgent, agentId: `agent-${index}`, agentName: `助手 ${index + 1}`, subscription: favorite,
  }))
  list.mockResolvedValueOnce(agents)
  render(<Page onOpenAgentChat={vi.fn()} />)
  const favorites = await screen.findByRole('region', { name: '收藏' })
  const cards = Array.from(favorites.querySelectorAll<HTMLElement>('.ai-discover-favorites-card'))
  expect(cards.map(card => within(card).getAllByRole('button').length)).toEqual([3, 3, 1])
  expect(categoryPanel('全部').getAllByRole('article')).toHaveLength(7)
  selectCategory('订阅')
  expect(categoryPanel('订阅').getAllByRole('article')).toHaveLength(7)
  expect(categoryPanel('订阅').queryByRole('button', { name: /上一页|下一页/ })).not.toBeInTheDocument()
  selectCategory('官方')
  expect(categoryPanel('官方').getAllByRole('article')).toHaveLength(7)
  expect(screen.getByRole('region', { name: '收藏' })).toBe(favorites)
  expect(list).toHaveBeenCalledTimes(1)
})

it.each([
  [404, 'AGENT_NOT_VISIBLE', []],
  [409, 'AGENT_NOT_SUBSCRIBED', [publicAgent]],
  [409, 'AGENT_VISIBILITY_CHANGED', []],
  [409, 'AGENT_SUBSCRIPTION_CHANGED', [{ ...publicAgent, ...stateFor(subscribed) }]],
  [409, 'AGENT_SUBSCRIPTION_TARGET_AMBIGUOUS', [publicAgent]],
  [409, 'AGENT_SUBSCRIPTION_SOURCE_CONFLICT', [publicAgent]],
  [504, 'AGENT_SUBSCRIPTION_RESPONSE_UNAVAILABLE', [{ ...publicAgent, ...stateFor(favorite) }]],
] as const)('收藏返回 HTTP %s / %s 时只刷新可见列表，不补发写入', async (status, code, latest) => {
  list.mockResolvedValueOnce([{ ...publicAgent, subscription: subscribed }]).mockResolvedValueOnce([...latest])
  favoriteWrite.mockRejectedValueOnce(new AgentRequestError('接口提示', code, status))
  const { result } = renderHook(() => useDiscoverAgents(true))
  await waitFor(() => expect(result.current.visibleAgents).toHaveLength(1))
  await act(async () => result.current.changeFavorite(publicAgent.agentId, true))
  expect(list).toHaveBeenCalledTimes(2)
  expect(favoriteWrite).toHaveBeenCalledTimes(1)
  expect(subscriptionWrite).not.toHaveBeenCalled()
  expect(result.current.pendingAgentIds.size).toBe(0)
  expect(result.current.visibleAgents).toEqual(latest)
  expect(Toast.show).toHaveBeenCalledWith({ content: '接口提示' })
})

it('取消收藏时服务端确认已退订，整体替换订阅状态', async () => {
  list.mockResolvedValueOnce([{ ...publicAgent, subscription: favorite }])
  favoriteWrite.mockResolvedValueOnce(stateFor(unsubscribed))
  const { result } = renderHook(() => useDiscoverAgents(true))
  await waitFor(() => expect(result.current.visibleAgents).toHaveLength(1))
  await act(async () => result.current.changeFavorite(publicAgent.agentId, false))
  expect(result.current.visibleAgents).toEqual([publicAgent])
})

it('身份校验暂时不可用时保留当前列表，不刷新或重发', async () => {
  list.mockResolvedValueOnce([publicAgent])
  subscriptionWrite.mockRejectedValueOnce(new AgentRequestError('稍后再试', 'IDENTITY_VERIFY_UNAVAILABLE', 503))
  const { result } = renderHook(() => useDiscoverAgents(true))
  await waitFor(() => expect(result.current.visibleAgents).toHaveLength(1))
  await act(async () => result.current.changeSubscription(publicAgent.agentId, true))
  expect(result.current.visibleAgents).toEqual([publicAgent])
  expect(list).toHaveBeenCalledTimes(1)
  expect(subscriptionWrite).toHaveBeenCalledTimes(1)
})

it('分页期间完成收藏时，旧列表不能覆盖结果，同一项不重复写入', async () => {
  const pendingList = deferred<DiscoverAgentItem[]>()
  const pendingWrite = deferred<AgentSubscriptionState>()
  const agent = { ...publicAgent, subscription: subscribed }
  list.mockResolvedValueOnce([agent]).mockReturnValueOnce(pendingList.promise)
  favoriteWrite.mockReturnValueOnce(pendingWrite.promise)
  const { result } = renderHook(() => useDiscoverAgents(true))
  await waitFor(() => expect(result.current.visibleAgents).toHaveLength(1))
  act(() => { void result.current.refreshVisibleAgents(true); void result.current.changeFavorite(publicAgent.agentId, true) })
  await act(async () => result.current.changeSubscription(publicAgent.agentId, false))
  expect(subscriptionWrite).not.toHaveBeenCalled()
  await act(async () => pendingWrite.resolve(stateFor(favorite)))
  await act(async () => pendingList.resolve([agent]))
  expect(result.current.visibleAgents[0]).toMatchObject(stateFor(favorite))
})
