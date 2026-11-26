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
    discoverError={agents.discoverError} discoverLoading={agents.discoverLoading}
    discoverSections={[
      { key: 'official', title: '官方智能体', items: groups.official },
      { key: 'mine', title: '我的智能体', items: groups.mine },
    ]}
    savedAgents={groups}
    pendingAgentIds={agents.pendingAgentIds} onChangeSubscription={agents.changeSubscription} onChangeFavorite={agents.changeFavorite}
    onOpenAgentChat={onOpenAgentChat} onOpenCreateAgent={vi.fn()} onBack={vi.fn()}
  />
}

beforeEach(() => vi.resetAllMocks())

it('顶部默认收藏、切换只筛顶部分区；未订阅也能对话，私有项可退订', async () => {
  const onOpenAgentChat = vi.fn()
  list.mockResolvedValueOnce([publicAgent, privateAgent])
  render(<Page onOpenAgentChat={onOpenAgentChat} />)
  const tabs = screen.getByRole('tablist', { name: '收藏和订阅' })
  const favorited = within(screen.getByRole('tabpanel', { name: '收藏' }))
  const official = await screen.findByRole('region', { name: '官方智能体' })
  expect(tabs.compareDocumentPosition(official) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const privateCard = within(favorited.getByRole('article', { name: privateAgent.agentName }))
  const publicCard = within(within(official).getByRole('article', { name: publicAgent.agentName }))
  expect(privateCard.getByRole('button', { name: '去对话' })).toBeDisabled()
  expect(privateCard.getByRole('button', { name: '取消订阅' })).toBeEnabled()
  expect(publicCard.queryByRole('button', { name: '收藏' })).not.toBeInTheDocument()
  fireEvent.click(publicCard.getByRole('button', { name: '去对话' }))
  expect(onOpenAgentChat).toHaveBeenCalledWith(expect.objectContaining({ subscription: unsubscribed }))

  fireEvent.click(screen.getByRole('tab', { name: '订阅' }))
  expect(screen.queryByRole('tabpanel', { name: '收藏' })).not.toBeInTheDocument()
  expect(within(screen.getByRole('tabpanel', { name: '订阅' })).getByText(privateAgent.agentName)).toBeVisible()
  expect(official).toBeVisible()
  expect(screen.getByRole('region', { name: '我的智能体' })).toBeVisible()
  expect(screen.queryByRole('region', { name: '我的订阅' })).not.toBeInTheDocument()

  fireEvent.change(screen.getByRole('searchbox', { name: '搜索智能体' }), { target: { value: publicAgent.agentName } })
  expect(within(screen.getByRole('tabpanel', { name: '订阅' })).getByText('暂无订阅的智能体')).toBeVisible()
  expect(publicCard.getByRole('button', { name: '订阅' })).toBeVisible()
  expect(list).toHaveBeenCalledTimes(1)
})

it('收藏和订阅同步更新同一项，取消收藏不退订，退订清除收藏但原分类仍保留', async () => {
  const pendingWrite = deferred<AgentSubscriptionState>()
  list.mockResolvedValueOnce([publicAgent, privateAgent])
  subscriptionWrite.mockResolvedValueOnce(stateFor(subscribed)).mockResolvedValueOnce(stateFor(unsubscribed))
  favoriteWrite.mockReturnValueOnce(pendingWrite.promise).mockResolvedValueOnce(stateFor(subscribed)).mockResolvedValueOnce(stateFor(favorite))
  render(<Page onOpenAgentChat={vi.fn()} />)

  const publicCard = within(await screen.findByRole('article', { name: publicAgent.agentName }))
  const select = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))
  const panel = (name: string) => within(screen.getByRole('tabpanel', { name }))
  const topCard = (name: string) => within(panel(name).getByRole('article', { name: publicAgent.agentName }))
  fireEvent.click(publicCard.getByRole('button', { name: '订阅' }))
  select('订阅')
  const subscribeCard = within(await panel('订阅').findByRole('article', { name: publicAgent.agentName }))
  fireEvent.click(subscribeCard.getByRole('button', { name: '收藏' }))
  expect(favoriteWrite).toHaveBeenCalledWith(publicAgent.agentId, true, expect.any(AbortSignal))
  expect(subscribeCard.getByRole('button', { name: '收藏' })).toBeDisabled()
  expect(publicCard.getByRole('button', { name: '取消订阅' })).toBeDisabled()
  expect(publicCard.getByRole('button', { name: '去对话' })).toBeEnabled()

  await act(async () => pendingWrite.resolve(stateFor(favorite)))
  select('收藏')
  fireEvent.click(topCard('收藏').getByRole('button', { name: '取消收藏' }))
  await waitFor(() => expect(panel('收藏').queryByRole('article', { name: publicAgent.agentName })).not.toBeInTheDocument())
  select('订阅')
  fireEvent.click(topCard('订阅').getByRole('button', { name: '收藏' }))
  select('收藏')
  fireEvent.click(within(await panel('收藏').findByRole('article', { name: publicAgent.agentName })).getByRole('button', { name: '取消订阅' }))
  await waitFor(() => expect(panel('收藏').queryByRole('article', { name: publicAgent.agentName })).not.toBeInTheDocument())
  select('订阅')
  expect(panel('订阅').queryByRole('article', { name: publicAgent.agentName })).not.toBeInTheDocument()
  expect(publicCard.getByRole('button', { name: '订阅' })).toBeEnabled()
  expect(favoriteWrite.mock.calls.map(([, target]) => target)).toEqual([true, false, true])
  expect(subscriptionWrite.mock.calls.map(([, target]) => target)).toEqual([true, false])
  expect(list).toHaveBeenCalledTimes(1)
})

it('收藏、订阅分别保留分页位置，切换不重新拉取', async () => {
  const agents = Array.from({ length: 6 }, (_, index) => ({
    ...publicAgent, agentId: `agent-${index}`, agentName: `助手 ${index + 1}`, subscription: favorite,
  }))
  list.mockResolvedValueOnce(agents)
  render(<Page onOpenAgentChat={vi.fn()} />)
  const panel = (name: string) => within(screen.getByRole('tabpanel', { name }))
  const next = (name: string) => panel(name).getByRole('button', { name: `${name}下一页` })
  await panel('收藏').findByRole('article', { name: '助手 1' })
  expect(panel('收藏').getAllByRole('article')).toHaveLength(5)
  fireEvent.click(next('收藏'))
  expect(panel('收藏').getByRole('article', { name: '助手 6' })).toBeVisible()
  fireEvent.click(screen.getByRole('tab', { name: '订阅' }))
  expect(panel('订阅').getAllByRole('article')).toHaveLength(5)
  fireEvent.click(screen.getByRole('tab', { name: '收藏' }))
  expect(panel('收藏').getByRole('article', { name: '助手 6' })).toBeVisible()
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
