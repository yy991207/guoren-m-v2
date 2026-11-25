import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchChatModels, modelChoice, resolveModelChoice, type ChatModelCatalog, type ModelChoice } from '../../../services/chat/models'
import type { ChatThinkingLevel } from '../../../services/chat/types'

const preferenceKey = 'guoren.h5.chat.model-choice.v1'
function readPreference(): ModelChoice {
  try {
    const saved = JSON.parse(sessionStorage.getItem(preferenceKey) ?? 'null')
    return modelChoice(typeof saved?.model === 'string' ? saved.model : null, saved?.thinkingLevel)
  } catch { return modelChoice() }
}

export function useWorkspaceChatModels() {
  const [choice, setChoice] = useState(readPreference)
  const preferred = useRef(choice)
  const [catalog, setCatalog] = useState<ChatModelCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const reload = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const data = await fetchChatModels(controller.signal)
      if (!controller.signal.aborted) setCatalog(data)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '可用模型查询失败')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])
  useEffect(() => { void reload(); return () => request.current?.abort() }, [reload])

  const resolved = useMemo(() => resolveModelChoice(choice, catalog), [choice, catalog])
  const restoreHistory = useCallback((model?: string | null, level?: ChatThinkingLevel | null) => setChoice(modelChoice(model, level)), [])
  const restorePreference = useCallback(() => setChoice(preferred.current), [])
  function remember(next: ModelChoice) {
    // 只记主动操作；模型和档位成对存储，打开历史不覆盖新任务偏好。
    preferred.current = next
    setChoice(next)
    try { sessionStorage.setItem(preferenceKey, JSON.stringify(next)) } catch { /* 存储不可用时仍保留当页选择。 */ }
  }
  function selectModel(model: string | null) {
    if (model === resolved.model || (model !== null && !resolved.models.some((item) => item.model === model))) return
    const next = resolveModelChoice(modelChoice(model), catalog)
    remember({ model: next.model, thinkingLevel: next.thinkingLevel })
  }
  function selectLevel(level: ChatThinkingLevel) {
    if (resolved.levels.includes(level)) remember({ model: resolved.model, thinkingLevel: level })
  }
  return { controls: { ...resolved, loading, error, reload, selectModel, selectLevel }, restoreHistory, restorePreference }
}

export type ChatModelControls = ReturnType<typeof useWorkspaceChatModels>['controls']
