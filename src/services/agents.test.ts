import { beforeEach, expect, it, vi } from 'vitest'
import { authorizedFetch, handleUnauthorizedResponse } from '../utils/request'
import { groupVisibleAgents, listVisibleAgents, setAgentFavorite, setAgentSubscription } from './agents'

vi.mock('../utils/request', () => ({
  authorizedFetch: vi.fn(),
  handleUnauthorizedResponse: vi.fn(),
  buildAiApiUrl: (path: string, params: Record<string, string>) => `${path}?${new URLSearchParams(params)}`,
}))
vi.mock('./chat/api', () => ({ getChatUserId: () => 'current-user' }))

const fetch = vi.mocked(authorizedFetch)
const visibleAgent = (agent_id: string, subscription: unknown) => ({
  agent_id, agent_name: agent_id, tenant_id: '1002', creator_user_id: 'other-user',
  publish_scope: 'specified', is_active: true, is_subscribed: subscription,
})
const page = (agents: unknown[], total: number) => Response.json({ success: true, data: { agents, total } })
const changed = (subscription: unknown) => Response.json({ success: true, data: { agent_id: 'id/a', is_subscribed: subscription } })

beforeEach(() => vi.resetAllMocks())

it('按原始可见列表条数翻页，第一页没有订阅或收藏也继续', async () => {
  const unsubscribed = { ...visibleAgent('a', { value: false }), agent_category: 'partner' }
  const favorite = { ...visibleAgent('b', { value: true, is_favorite: true }), agent_category: '' }
  const subscribed = visibleAgent('c', { value: true, is_favorite: false })
  const controller = new AbortController()
  fetch.mockResolvedValueOnce(page([unsubscribed, unsubscribed, {}], 5)).mockResolvedValueOnce(page([favorite, subscribed], 5))

  const agents = await listVisibleAgents(controller.signal)
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/custom-agents/public/list?user_id=current-user&limit=100&skip=0',
    '/api/v1/custom-agents/public/list?user_id=current-user&limit=100&skip=3',
  ])
  expect(fetch).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({ signal: controller.signal }))
  expect(agents.map(agent => agent.agentCategory)).toEqual(['partner', '', null])
  const groups = groupVisibleAgents(agents, 'current-user')
  expect(groups.collaboration.map(agent => agent.agentId)).toEqual(['a', 'b', 'c'])
  expect(groups.subscribed.map(agent => agent.agentId)).toEqual(['b', 'c'])
  expect(groups.favorite.map(agent => agent.agentId)).toEqual(['b'])
})

it('旧订阅没有收藏字段时视为未收藏，旧的布尔响应不猜测订阅状态，空页停止', async () => {
  const items = [visibleAgent('a', { value: true }), visibleAgent('b', true), visibleAgent('c', undefined)]
  fetch.mockResolvedValueOnce(page(items, 4)).mockResolvedValueOnce(page([], 4))
  expect((await listVisibleAgents()).map(agent => agent.subscription)).toEqual([{ value: true, isFavorite: false }, null, null])
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each([true, false])('订阅 PUT 提交目标 %s，使用响应的完整状态', async (value) => {
  fetch.mockResolvedValueOnce(changed(value ? { value, is_favorite: true } : { value }))
  await expect(setAgentSubscription('id/a', value)).resolves.toEqual({ agentId: 'id/a', subscription: value ? { value, isFavorite: true } : { value } })
  expect(fetch).toHaveBeenCalledWith('/api/v1/custom-agents/id%2Fa/subscription?user_id=current-user', expect.objectContaining({
    method: 'PUT', body: JSON.stringify({ is_subscribed: value }),
  }))
})

it.each([true, false])('收藏 PUT 提交 is_favorite: %s', async (value) => {
  const signal = new AbortController().signal
  fetch.mockResolvedValueOnce(changed({ value: true, is_favorite: value }))
  await expect(setAgentFavorite('id/a', value, signal)).resolves.toEqual({ agentId: 'id/a', subscription: { value: true, isFavorite: value } })
  expect(fetch).toHaveBeenCalledWith('/api/v1/custom-agents/id%2Fa/favorite?user_id=current-user', expect.objectContaining({
    method: 'PUT', headers: expect.objectContaining({ 'Content-Type': 'application/json' }), body: JSON.stringify({ is_favorite: value }), signal,
  }))
})

it('取消收藏时，接受另一端已经退订的返回值', async () => {
  fetch.mockResolvedValueOnce(changed({ value: false }))
  await expect(setAgentFavorite('id/a', false)).resolves.toEqual({ agentId: 'id/a', subscription: { value: false } })
})

it.each([
  [403, 'IDENTITY_ACCESS_DENIED', true],
  [409, 'AGENT_NOT_SUBSCRIBED', false],
  [409, 'AGENT_SUBSCRIPTION_CHANGED', false],
  [503, 'IDENTITY_VERIFY_UNAVAILABLE', false],
] as const)('保留 HTTP %s 的业务码 %s，只对身份不匹配走登录处理', async (status, code, login) => {
  fetch.mockResolvedValueOnce(Response.json({ success: false, code, msg: '服务提示' }, { status }))
  await expect(setAgentFavorite('a', true)).rejects.toMatchObject({ code, status, message: '服务提示' })
  expect(handleUnauthorizedResponse).toHaveBeenCalledTimes(login ? 1 : 0)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('没有响应、网关超时或响应状态错误时返回结果未确认，不重发写入', async () => {
  fetch.mockRejectedValueOnce(new TypeError('offline'))
    .mockResolvedValueOnce(new Response(null, { status: 504 }))
    .mockResolvedValueOnce(changed({ value: true, is_favorite: 'yes' }))
  await expect(setAgentSubscription('id/a', true)).rejects.toMatchObject({ code: 'AGENT_SUBSCRIPTION_RESPONSE_UNAVAILABLE', status: 0 })
  await expect(setAgentFavorite('id/a', true)).rejects.toMatchObject({ code: 'AGENT_SUBSCRIPTION_RESPONSE_UNAVAILABLE', status: 504 })
  await expect(setAgentFavorite('id/a', true)).rejects.toMatchObject({ code: 'AGENT_SUBSCRIPTION_RESPONSE_UNAVAILABLE', status: 200 })
  expect(fetch).toHaveBeenCalledTimes(3)
})
