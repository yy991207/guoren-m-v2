import { vi } from 'vitest'
import { resolveModelChoice, type ChatModelCatalog } from '../../services/chat/models'
import type { ChatModelControls } from '../../pages/AI/hooks/useWorkspaceChatModels'

export const catalog: ChatModelCatalog = {
  default_model: 'model-a',
  models: [
    { model: 'model-a', display_name: '模型 A', is_default: true, thinking: { levels: ['low', 'high'], default_level: 'high' } },
    { model: 'model-b', display_name: '模型 B', is_default: false, thinking: { levels: ['medium'] } },
    { model: 'model-c', display_name: '模型 C', is_default: false },
  ],
}

export function makeModelControls(overrides: Partial<ChatModelControls> = {}): ChatModelControls {
  return { ...resolveModelChoice({ model: null, thinkingLevel: null }, catalog), loading: false, error: '', reload: vi.fn(), selectModel: vi.fn(), selectLevel: vi.fn(), ...overrides }
}
