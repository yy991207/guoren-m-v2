import { useCallback, useEffect, useRef, useState } from 'react'
import { Toast } from 'antd-mobile'
import { AgentRequestError, listVisibleAgents, setAgentFavorite, setAgentSubscription } from '../../../services/agents'
import type { AgentSubscriptionState, DiscoverAgentItem } from '../../../services/agents'

type SubscriptionChanges = Map<string, AgentSubscriptionState | null>

const REFRESH_AFTER_ERROR = new Set([
  'AGENT_NOT_VISIBLE',
  'AGENT_NOT_SUBSCRIBED',
  'AGENT_VISIBILITY_CHANGED',
  'AGENT_SUBSCRIPTION_CHANGED',
  'AGENT_SUBSCRIPTION_TARGET_AMBIGUOUS',
  'AGENT_SUBSCRIPTION_SOURCE_CONFLICT',
  'AGENT_SUBSCRIPTION_RESPONSE_UNAVAILABLE',
])

function applySubscriptionChanges(agents: DiscoverAgentItem[], changes: SubscriptionChanges) {
  return agents.flatMap(agent => {
    const state = changes.get(agent.agentId)
    if (state === null) return []
    return [state ? { ...agent, subscription: state.subscription } : agent]
  })
}

export function useDiscoverAgents(open: boolean) {
  const [visibleAgents, setVisibleAgents] = useState<DiscoverAgentItem[]>([])
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState('')
  const [pendingAgentIds, setPendingAgentIds] = useState<ReadonlySet<string>>(() => new Set())
  const listRequestRef = useRef<{ controller: AbortController; changes: SubscriptionChanges } | null>(null)
  const writesRef = useRef(new Map<string, AbortController>())

  const refreshVisibleAgents = useCallback(async (keepVisible = false) => {
    listRequestRef.current?.controller.abort()
    const controller = new AbortController()
    const changes: SubscriptionChanges = new Map()
    listRequestRef.current = { controller, changes }
    setDiscoverLoading(!keepVisible)
    setDiscoverError('')

    try {
      const agents = await listVisibleAgents(controller.signal)
      if (!controller.signal.aborted) {
        // 分页途中可能完成另一个卡片的写入，较旧的列表响应不能覆盖其结果。
        setVisibleAgents(applySubscriptionChanges(agents, changes))
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : '智能体列表加载失败'
      if (keepVisible) Toast.show({ content: message })
      else setDiscoverError(message)
    } finally {
      if (listRequestRef.current?.controller === controller) {
        listRequestRef.current = null
        setDiscoverLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (open) void refreshVisibleAgents()
  }, [open, refreshVisibleAgents])

  useEffect(() => () => {
    listRequestRef.current?.controller.abort()
    listRequestRef.current = null
    writesRef.current.forEach(controller => controller.abort())
    writesRef.current.clear()
  }, [])

  const changePreference = async (agentId: string, operation: 'subscription' | 'favorite', value: boolean) => {
    // 同一智能体的收藏和订阅共用写入锁，避免两个响应互相覆盖。
    if (writesRef.current.has(agentId)) return
    const controller = new AbortController()
    writesRef.current.set(agentId, controller)
    setPendingAgentIds(current => new Set(current).add(agentId))

    const applyChange = (state: AgentSubscriptionState | null) => {
      listRequestRef.current?.changes.set(agentId, state)
      setVisibleAgents(agents => applySubscriptionChanges(agents, new Map([[agentId, state]])))
    }

    try {
      const write = operation === 'favorite' ? setAgentFavorite : setAgentSubscription
      const state = await write(agentId, value, controller.signal)
      if (!controller.signal.aborted) applyChange(state)
    } catch (error) {
      if (controller.signal.aborted) return
      const code = error instanceof AgentRequestError ? error.code : ''
      if (code === 'AGENT_NOT_VISIBLE') applyChange(null)

      const label = operation === 'favorite' ? '收藏' : '订阅'
      Toast.show({ content: error instanceof Error ? error.message : `修改智能体${label}失败` })
      // 冲突或结果不明只读最新列表，从不自动补发写入。
      if (REFRESH_AFTER_ERROR.has(code)) await refreshVisibleAgents(true)
    } finally {
      if (writesRef.current.get(agentId) === controller) {
        writesRef.current.delete(agentId)
        setPendingAgentIds(current => {
          const next = new Set(current)
          next.delete(agentId)
          return next
        })
      }
    }
  }

  return {
    visibleAgents, setVisibleAgents, discoverLoading, discoverError, refreshVisibleAgents, pendingAgentIds,
    changeSubscription: (agentId: string, value: boolean) => changePreference(agentId, 'subscription', value),
    changeFavorite: (agentId: string, value: boolean) => changePreference(agentId, 'favorite', value),
  }
}
