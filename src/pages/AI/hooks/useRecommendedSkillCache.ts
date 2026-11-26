import { useEffect, useMemo, useState } from 'react'
import { fetchCustomAgentRecommendedSkills, type RecommendSkillsRequest, type SkillSummaryItem } from '../../../services/skills'

const MAX_RECOMMENDATIONS = 16
const emptyItems: SkillSummaryItem[] = []
type Entry = { items: SkillSummaryItem[] } | { controller: AbortController; promise: Promise<SkillSummaryItem[]> }

function createRecommendedSkillCache() {
  const entries = new Map<string, Entry>()

  const read = (key: string) => {
    const entry = entries.get(key)
    return entry && 'items' in entry ? entry.items : undefined
  }

  const load = (key: string, payload: RecommendSkillsRequest) => {
    const existing = entries.get(key)
    if (existing) return 'items' in existing ? Promise.resolve(existing.items) : existing.promise

    const controller = new AbortController()
    const promise = fetchCustomAgentRecommendedSkills(payload, controller.signal).then(items => {
      if (entries.get(key) === entry) entries.set(key, { items })
      return items
    }, error => {
      // 失败不写缓存，下次主动打开推荐时仍可请求。
      if (entries.get(key) === entry) entries.delete(key)
      throw error
    })
    const entry = { controller, promise }
    entries.set(key, entry)
    if (entries.size > MAX_RECOMMENDATIONS) {
      const oldest = entries.keys().next().value!
      const expired = entries.get(oldest)
      entries.delete(oldest)
      if (expired && 'controller' in expired) expired.controller.abort()
    }
    return promise
  }

  const clear = () => {
    for (const entry of entries.values()) {
      if ('controller' in entry) entry.controller.abort()
    }
    entries.clear()
  }

  return { read, load, clear }
}

export type RecommendedSkillCache = ReturnType<typeof createRecommendedSkillCache>

export function useRecommendedSkillCache(userId: string): RecommendedSkillCache {
  // 页面内按账号隔离；关闭编辑或切换分类不销毁，离开工作区则释放。
  const cache = useMemo(() => createRecommendedSkillCache(), [userId])
  useEffect(() => () => cache.clear(), [cache])
  return cache
}

export function useRecommendedSkillResult(cache: RecommendedSkillCache, enabled: boolean, agentId: string | undefined, payload: RecommendSkillsRequest) {
  const key = JSON.stringify([agentId ?? null, payload.agent_name, payload.description, payload.agent_prompt])
  const [completion, setCompletion] = useState<{ cache: RecommendedSkillCache; key: string; error: string } | null>(null)
  const items = cache.read(key)
  const error = items || completion?.cache !== cache || completion?.key !== key ? '' : completion.error

  useEffect(() => {
    if (!enabled || cache.read(key)) return
    let visible = true
    setCompletion(null)
    // 切走只取消本次界面订阅，回来时复用正在执行的请求或已保存的结果。
    void cache.load(key, payload).then(() => {
      if (visible) setCompletion({ cache, key, error: '' })
    }, reason => {
      if (visible) setCompletion({ cache, key, error: reason instanceof Error ? reason.message : '获取推荐技能失败' })
    })
    return () => { visible = false }
  }, [cache, enabled, key, payload])

  return { items: items ?? emptyItems, loading: enabled && !items && !error, error }
}
