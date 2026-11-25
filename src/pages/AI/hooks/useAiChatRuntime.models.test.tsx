import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAiChatRuntime } from './useAiChatRuntime'
import { createChatStreamBridge, type ChatStreamBridge } from '../../../services/chat/bridge'
import { fetchChatSessions, getChatSession } from '../../../services/chat/session'
import { fetchChatModels } from '../../../services/chat/models'
import { catalog } from '../../../test/fixtures/chatModels'
import type { ChatSessionDetail } from '../../../services/chat/types'

vi.mock('../../../services/chat/session', async (load) => ({ ...await load<typeof import('../../../services/chat/session')>(), fetchChatSessions: vi.fn(), getChatSession: vi.fn() }))
vi.mock('../../../services/chat/models', async (load) => ({ ...await load<typeof import('../../../services/chat/models')>(), fetchChatModels: vi.fn() }))
vi.mock('../../../services/chat/bridge', () => ({ createChatStreamBridge: vi.fn() }))
vi.mock('../../../utils/request', () => ({ buildAiApiUrl: (path: string) => path, buildAiBrowserUrl: (path: string) => path, buildAuthorizedHeaders: async () => ({}) }))

const detail: ChatSessionDetail = {
  session_id: 'b', session_name: '历史对话', created_at: '', updated_at: '', user_id: 'test', model: 'model-b', thinking_level: 'medium',
  theme_id: null, tool_config: null, message_count: 0, messages: [],
}
function renderRuntime() {
  return renderHook(useAiChatRuntime, { wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/ai?sessionId=a']}>{children}</MemoryRouter> })
}
beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  vi.mocked(fetchChatModels).mockResolvedValue(catalog)
  vi.mocked(fetchChatSessions).mockResolvedValue([])
  vi.mocked(createChatStreamBridge).mockReturnValue(null)
})

it('切会话时禁用设置，旧会话迟到的详情不能覆盖新会话；新建任务不继承历史', async () => {
  let resolveOld!: (data: ChatSessionDetail) => void
  vi.mocked(getChatSession).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve })).mockResolvedValue(detail)
  const { result } = renderRuntime()
  expect(result.current.modelBusy).toBe(true)
  act(() => result.current.openSession('b'))
  await waitFor(() => expect(result.current.modelControls.model).toBe('model-b'))
  expect(result.current.modelBusy).toBe(false)
  expect(vi.mocked(getChatSession).mock.calls[0][1]?.aborted).toBe(true)
  await act(async () => resolveOld({ ...detail, session_id: 'a', model: 'model-a', thinking_level: 'low' }))
  expect(result.current.modelControls).toMatchObject({ model: 'model-b', thinkingLevel: 'medium' })
  act(() => result.current.startNewChat())
  await waitFor(() => expect(result.current.modelControls.model).toBeNull())
  expect(result.current.modelControls.thinkingLevel).toBe('high')
})

it('即使后台已有消息快照，仍然从详情恢复模型，后台续聊发送恢复后的两项参数', async () => {
  const bridge: ChatStreamBridge = {
    subscribe: vi.fn().mockResolvedValue({ sessionId: 'a', status: 'completed', messages: [], activeMessageId: null, error: null, lastEventSequence: 0 }),
    unsubscribe: vi.fn(), startStream: vi.fn(), resumeStream: vi.fn(), stopStream: vi.fn(), destroy: vi.fn(),
  }
  vi.mocked(createChatStreamBridge).mockReturnValue(bridge)
  vi.mocked(getChatSession).mockResolvedValue({ ...detail, session_id: 'a' })
  const { result } = renderRuntime()
  await waitFor(() => expect(result.current.modelBusy).toBe(false))
  expect(getChatSession).toHaveBeenCalledOnce()
  expect(result.current.modelControls).toMatchObject({ model: 'model-b', thinkingLevel: 'medium' })
  await act(() => result.current.submitPrompt('继续'))
  const [sent] = vi.mocked(bridge.startStream).mock.calls[0]
  expect(JSON.parse(sent.streamRequest.body!)).toMatchObject({ message: '继续', model: 'model-b', thinking_level: 'medium' })
})
