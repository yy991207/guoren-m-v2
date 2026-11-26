import { authorizedFetch, buildAiApiUrl, handleUnauthorizedResponse } from '../utils/request'
import { getChatUserId } from './chat/api'

const VISIBLE_AGENTS_PATH = '/api/v1/custom-agents/public/list'
const AGENT_PREFERENCE_PATH = '/api/v1/custom-agents/{agent_id}'
const VISIBLE_AGENTS_PAGE_SIZE = 100
const AGENT_USAGE_LOGS_PATH = '/api/v1/custom-agents/usage-logs'
const AGENT_USAGE_LOG_DETAIL_PATH = '/api/v1/custom-agents/usage-logs/{agent_id}'
const AGENT_USAGE_PAGE_SIZE = 100

export type AgentPublishScope = 'private' | 'public' | 'specified'
export type AgentCategoryKey = 'subscribed' | 'official' | 'enterprise' | 'collaboration' | 'mine'

export type AgentSubscription = { value: false } | { value: true; isFavorite: boolean }

export interface DiscoverAgentItem {
  agentId: string
  creatorUserId: string
  tenantId: string | null
  agentName: string
  description: string
  avatarUrl: string | null
  isActive: boolean
  publishScope: AgentPublishScope | null
  subscription: AgentSubscription | null
  createdAt: string
  updatedAt: string
}

export interface AgentUsageLog {
  agentId: string
  userId: string
  agentName: string
  avatarUrl: string | null
  usedAt: string
}

export type AgentSubscriptionState = { agentId: string; subscription: AgentSubscription }

export class AgentRequestError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message)
    this.name = 'AgentRequestError'
  }
}

type AgentResponse<Data> = {
  success?: boolean
  code?: number | string
  msg?: string
  detail?: unknown
  data?: Data | null
}

function agentRequestError(response: Response, payload: AgentResponse<unknown> | null, fallback: string): AgentRequestError {
  const code = String(payload?.code ?? 'AGENT_REQUEST_FAILED')
  if (response.status === 403 && code === 'IDENTITY_ACCESS_DENIED') {
    // 只有身份不匹配的 403 走登录失效处理。
    handleUnauthorizedResponse(response, { code: '401' })
  }
  const message = typeof payload?.msg === 'string' ? payload.msg.trim() : ''
  const detail = typeof payload?.detail === 'string' ? payload.detail.trim() : ''
  return new AgentRequestError(message || detail || fallback, code, response.status)
}

type AgentUsageLogsResponse = {
  success?: boolean
  code?: number | string
  msg?: string
  message?: string
  data?: {
    logs?: Array<{
      agent_id?: string
      user_id?: string
      agent_name?: string
      avatar_url?: string
      used_at?: string
    }>
  }
}

function getRequiredUserId(): string {
  const userId = getChatUserId()

  if (!userId) {
    throw new Error('当前缺少用户 ID，暂时无法加载智能体数据')
  }

  return userId
}

function normalizeSubscription(input: unknown): AgentSubscription | null {
  if (!input || typeof input !== 'object') return null
  const { value, is_favorite } = input as Record<string, unknown>
  if (value === false) return { value: false }
  if (value !== true || (is_favorite !== undefined && typeof is_favorite !== 'boolean')) return null
  // 历史订阅缺少收藏标志，按接口约定显示为未收藏。
  return { value: true, isFavorite: is_favorite === true }
}

function normalizeVisibleAgent(item: unknown): DiscoverAgentItem | null {
  if (!item || typeof item !== 'object') {
    return null
  }

  const record = item as Record<string, unknown>
  const agentId = typeof record.agent_id === 'string' ? record.agent_id : ''
  const agentName = typeof record.agent_name === 'string' ? record.agent_name : ''

  if (!agentId || !agentName) {
    return null
  }

  return {
    agentId,
    creatorUserId: typeof record.creator_user_id === 'string' ? record.creator_user_id : '',
    tenantId: typeof record.tenant_id === 'string' || typeof record.tenant_id === 'number' ? String(record.tenant_id) : null,
    agentName,
    description: typeof record.description === 'string' ? record.description : '',
    avatarUrl: typeof record.avatar_url === 'string' ? record.avatar_url : null,
    isActive: Boolean(record.is_active),
    publishScope: typeof record.publish_scope === 'string' ? record.publish_scope as AgentPublishScope : null,
    subscription: normalizeSubscription(record.is_subscribed),
    createdAt: typeof record.created_at === 'string' ? record.created_at : '',
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : '',
  }
}

export async function listVisibleAgents(signal?: AbortSignal): Promise<DiscoverAgentItem[]> {
  const userId = getRequiredUserId()
  const agents = new Map<string, DiscoverAgentItem>()
  let skip = 0

  while (true) {
    const requestUrl = buildAiApiUrl(VISIBLE_AGENTS_PATH, {
      user_id: userId,
      limit: String(VISIBLE_AGENTS_PAGE_SIZE),
      skip: String(skip),
    })
    const response = await authorizedFetch(requestUrl, { method: 'GET', headers: { Accept: 'application/json' }, signal })
    const payload = await response.json().catch(() => null) as AgentResponse<{ agents?: unknown[]; total?: number }> | null

    if (!response.ok || payload?.success === false) {
      throw agentRequestError(response, payload, '获取可见智能体列表失败')
    }

    const page = payload?.data?.agents
    const total = payload?.data?.total
    if (!Array.isArray(page) || typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) {
      throw new AgentRequestError('可见智能体列表响应不完整', 'AGENT_LIST_RESPONSE_INVALID', response.status)
    }

    for (const item of page) {
      const agent = normalizeVisibleAgent(item)
      if (agent && !agents.has(agent.agentId)) agents.set(agent.agentId, agent)
    }
    // 跳过数量按服务端原始页计算，不使用去重或筛选之后的条数。
    skip += page.length
    if (page.length === 0 || skip >= total) break
  }

  return [...agents.values()]
}

async function writeAgentPreference(
  agentId: string,
  operation: 'subscription' | 'favorite',
  value: boolean,
  signal?: AbortSignal,
): Promise<AgentSubscriptionState> {
  const label = operation === 'subscription' ? '订阅' : '收藏'
  const body = operation === 'subscription' ? { is_subscribed: value } : { is_favorite: value }
  const path = `${AGENT_PREFERENCE_PATH.replace('{agent_id}', encodeURIComponent(agentId))}/${operation}`
  const requestUrl = buildAiApiUrl(path, { user_id: getRequiredUserId() })
  const responseUnavailable = (status: number) => new AgentRequestError(`未确认智能体${label}结果`, 'AGENT_SUBSCRIPTION_RESPONSE_UNAVAILABLE', status)
  const response = await authorizedFetch(requestUrl, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }).catch((error: unknown) => {
    if (signal?.aborted) throw error
    throw responseUnavailable(0)
  })
  if (response.status === 408 || response.status === 504) throw responseUnavailable(response.status)

  const payload = await response.json().catch(() => null) as AgentResponse<{
    agent_id?: unknown
    is_subscribed?: unknown
  }> | null
  if (!response.ok || payload?.success === false) {
    throw agentRequestError(response, payload, `修改智能体${label}失败`)
  }

  const state = payload?.data
  const subscription = normalizeSubscription(state?.is_subscribed)
  if (payload?.success !== true || state?.agent_id !== agentId || !subscription) throw responseUnavailable(response.status)
  return { agentId, subscription }
}

export function setAgentSubscription(agentId: string, value: boolean, signal?: AbortSignal) {
  return writeAgentPreference(agentId, 'subscription', value, signal)
}

export function setAgentFavorite(agentId: string, value: boolean, signal?: AbortSignal) {
  return writeAgentPreference(agentId, 'favorite', value, signal)
}

export function groupVisibleAgents(
  agents: DiscoverAgentItem[],
  currentUserId: string,
): Record<AgentCategoryKey | 'favorite', DiscoverAgentItem[]> {
  const subscribed = agents.filter((agent) => agent.subscription?.value === true)
  return {
    official: agents.filter((agent) => (
      agent.tenantId === null &&
      agent.publishScope === 'public' &&
      agent.isActive
    )),
    enterprise: agents.filter((agent) => (
      agent.tenantId !== null &&
      agent.publishScope === 'public' &&
      agent.isActive
    )),
    collaboration: agents.filter((agent) => (
      agent.tenantId !== null &&
      agent.publishScope === 'specified' &&
      agent.creatorUserId !== currentUserId &&
      agent.isActive
    )),
    mine: agents.filter((agent) => agent.creatorUserId === currentUserId),
    subscribed,
    favorite: subscribed.filter((agent) => agent.subscription?.value && agent.subscription.isFavorite),
  }
}

export async function getAgentUsageLogs(signal?: AbortSignal): Promise<AgentUsageLog[]> {
  const userId = getRequiredUserId()
  const logs: AgentUsageLog[] = []
  let skip = 0

  while (true) {
    const requestUrl = buildAiApiUrl(AGENT_USAGE_LOGS_PATH, {
      user_id: userId,
      limit: String(AGENT_USAGE_PAGE_SIZE),
      skip: String(skip),
    })

    const response = await authorizedFetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    })

    if (!response.ok) {
      throw new Error('获取智能体使用记录失败')
    }

    const payload = (await response.json()) as AgentUsageLogsResponse

    if (payload.success === false) {
      throw new Error(payload.msg || payload.message || '获取智能体使用记录失败')
    }

    const pageLogs = Array.isArray(payload.data?.logs)
      ? payload.data.logs.flatMap((item) => {
          if (!item?.agent_id || !item.used_at) {
            return []
          }

          return [{
            agentId: item.agent_id,
            userId: typeof item.user_id === 'string' ? item.user_id : '',
            agentName: typeof item.agent_name === 'string' ? item.agent_name : '',
            avatarUrl: typeof item.avatar_url === 'string' ? item.avatar_url : null,
            usedAt: item.used_at,
          }]
        })
      : []

    logs.push(...pageLogs)

    if (pageLogs.length < AGENT_USAGE_PAGE_SIZE) {
      break
    }

    skip += AGENT_USAGE_PAGE_SIZE
  }

  return logs.sort((left, right) => (
    new Date(right.usedAt).getTime() - new Date(left.usedAt).getTime()
  ))
}

export async function addAgentUsageLog(agentId: string, signal?: AbortSignal): Promise<void> {
  const userId = getRequiredUserId()
  const requestUrl = buildAiApiUrl(AGENT_USAGE_LOGS_PATH, {
    user_id: userId,
  })

  const response = await authorizedFetch(requestUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: agentId,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error('添加智能体使用记录失败')
  }

  const payload = await response.json() as { success?: boolean; msg?: string; message?: string }

  if (payload.success === false) {
    throw new Error(payload.msg || payload.message || '添加智能体使用记录失败')
  }
}

export async function deleteAgentUsageLog(agentId: string, signal?: AbortSignal): Promise<void> {
  const userId = getRequiredUserId()
  const requestUrl = buildAiApiUrl(
    AGENT_USAGE_LOG_DETAIL_PATH.replace('{agent_id}', encodeURIComponent(agentId)),
    {
      user_id: userId,
      agent_id: agentId,
    },
  )

  const response = await authorizedFetch(requestUrl, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error('删除智能体使用记录失败')
  }

  const payload = await response.json() as { success?: boolean; msg?: string; message?: string }

  if (payload.success === false) {
    throw new Error(payload.msg || payload.message || '删除智能体使用记录失败')
  }
}

export async function ensureAgentUsageLog(agentId: string, signal?: AbortSignal): Promise<boolean> {
  const logs = await getAgentUsageLogs(signal)

  if (logs.some((item) => item.agentId === agentId)) {
    return false
  }

  await addAgentUsageLog(agentId, signal)
  return true
}
