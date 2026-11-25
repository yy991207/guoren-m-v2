import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchClawhubSkills, fetchOfficialSkills, searchClawhubSkills, type SkillSummaryItem } from '../../../services/skills'

type LoadList = (query: string, signal: AbortSignal) => Promise<SkillSummaryItem[]>
type ListResult = { query: string; items: SkillSummaryItem[] } | { query: string; error: string }
const empty: SkillSummaryItem[] = []
const loadOfficial: LoadList = (_, signal) => fetchOfficialSkills(signal)
const loadBrowse: LoadList = (_, signal) => fetchClawhubSkills({ limit: 20, signal })
const loadSearch: LoadList = (query, signal) => searchClawhubSkills(query, { signal })

function usePageList(enabled: boolean, query: string, load: LoadList) {
  const [result, setResult] = useState<ListResult | null>(null)
  const pending = useRef<{ query: string; controller: AbortController } | null>(null)
  const current = result?.query === query ? result : null
  const ready = current !== null && 'items' in current

  useEffect(() => () => {
    pending.current?.controller.abort()
    pending.current = null
  }, [])

  useEffect(() => {
    // 快速切栏仍共用正在加载的请求；只有换关键词或离开工作区才取消。
    if (pending.current && pending.current.query !== query) {
      pending.current.controller.abort()
      pending.current = null
    }
    if (!enabled || ready || pending.current) return
    const controller = new AbortController()
    pending.current = { query, controller }
    setResult(null)
    void load(query, controller.signal).then(items => {
      if (!controller.signal.aborted) setResult({ query, items })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ query, error: error instanceof Error ? error.message : '技能列表加载失败' })
    }).finally(() => {
      if (pending.current?.controller === controller) pending.current = null
    })
  }, [enabled, query, ready, load])

  return {
    items: ready ? current.items : empty,
    loading: current === null,
    error: current && 'error' in current ? current.error : '',
  }
}

export function useSkillCommunity(open: boolean, keyword: string) {
  const query = keyword.trim()
  const [settledQuery, setSettledQuery] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledQuery(query), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  // 缓存只属于本次 AI 页面：保留两份初始列表和最近一次搜索，不累计所有关键词。
  const official = usePageList(open, '', loadOfficial)
  const browse = usePageList(open && !query, '', loadBrowse)
  const search = usePageList(open && !!query && query === settledQuery, query, loadSearch)
  const clawhub = query ? search : browse

  // 安装或移除成功后的状态也适用于缓存和仍在返回途中的列表。
  const [selection, setSelection] = useState(() => new Map<string, boolean>())
  const setSkillSelected = useCallback((name: string, selected: boolean) => {
    setSelection(previous => new Map(previous).set(name, selected))
  }, [])
  const withSelection = useCallback((items: SkillSummaryItem[]) => selection.size ? items.map(item => {
    const selected = selection.get(item.skillName || item.id)
    return selected === undefined || selected === item.isSelected ? item : { ...item, isSelected: selected }
  }) : items, [selection])
  const officialSkills = useMemo(() => withSelection(official.items), [official.items, withSelection])
  const communitySkills = useMemo(() => withSelection(clawhub.items), [clawhub.items, withSelection])
  return { official: { ...official, items: officialSkills }, clawhub: { ...clawhub, items: communitySkills }, setSkillSelected }
}
