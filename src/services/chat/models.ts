import { authorizedFetch, buildAiApiUrl } from '../../utils/request'
import type { ChatThinkingLevel } from './types'

export interface ChatModelItem {
  model: string
  display_name: string
  is_default: boolean
  thinking?: { levels: ChatThinkingLevel[]; default_level?: ChatThinkingLevel } | null
}
export interface ChatModelCatalog {
  default_model: string
  models: ChatModelItem[]
}
export interface ModelChoice {
  model: string | null
  thinkingLevel: ChatThinkingLevel | null
}

export const levelLabels: Record<ChatThinkingLevel, string> = {
  auto: '自动', low: '低', medium: '中等', high: '高', max: '极高',
}

export function isThinkingLevel(value: unknown): value is ChatThinkingLevel {
  return typeof value === 'string' && Object.hasOwn(levelLabels, value)
}

export function modelChoice(model?: string | null, level?: ChatThinkingLevel | null): ModelChoice {
  const id = model?.trim()
  return { model: id && id !== 'auto' ? id : null, thinkingLevel: isThinkingLevel(level) ? level : null }
}

export async function fetchChatModels(signal: AbortSignal): Promise<ChatModelCatalog> {
  const response = await authorizedFetch(buildAiApiUrl('/api/v1/chat/models'), { headers: { Accept: 'application/json' }, signal })
  if (!response.ok) throw new Error(`可用模型查询失败（HTTP ${response.status}）`)
  const result = await response.json() as { success?: boolean; msg?: string; data?: ChatModelCatalog } | null
  const data = result?.data
  if (!result?.success || !data || !Array.isArray(data.models)) throw new Error(result?.msg || '可用模型查询失败')
  if (!data.models.every((item) => typeof item?.model === 'string' && typeof item.display_name === 'string'
    && (item.thinking?.levels == null || Array.isArray(item.thinking.levels)))) {
    throw new Error('模型目录格式不正确')
  }
  return data
}

function defaultLevel(item: ChatModelItem | undefined, levels: ChatThinkingLevel[]): ChatThinkingLevel | null {
  const apiDefault = item?.thinking?.default_level
  if (apiDefault && levels.includes(apiDefault)) return apiDefault
  if (levels.length === 1) return levels[0]
  // 与 Web 相同：仅当接口列出对应档位时，才应用这两个模型约定的初始档。
  const name = `${item?.model} ${item?.display_name}`.toLowerCase()
  if (name.includes('qwen3.8-max') && levels.includes('auto')) return 'auto'
  if (name.includes('glm-5.3') && levels.includes('medium')) return 'medium'
  return null
}

export function resolveModelChoice(choice: ModelChoice, catalog: ChatModelCatalog | null) {
  const models = catalog?.models ?? []
  const defaultItem = models.find((item) => item.model === catalog?.default_model)
  const manual = choice.model ? models.find((item) => item.model === choice.model) : undefined
  const item = manual ?? defaultItem
  const levels = [...new Set((item?.thinking?.levels ?? []).filter(isThinkingLevel))]
  const unavailable = !!catalog && !!choice.model && !manual
  const model = unavailable ? null : choice.model
  const thinkingLevel = !catalog ? choice.thinkingLevel
    : !unavailable && choice.thinkingLevel && levels.includes(choice.thinkingLevel) ? choice.thinkingLevel : defaultLevel(item, levels)
  return { model, thinkingLevel, item, levels, defaultItem, models, label: model ? manual?.display_name || model : 'Auto' }
}
