import { beforeEach, expect, it, vi } from 'vitest'
import { authorizedFetch } from '../../utils/request'
import { buildStartChatStreamRequest, streamChatMessage } from './api'
import { fetchChatModels } from './models'

vi.mock('../../utils/request', () => ({
  authorizedFetch: vi.fn(), buildAuthorizedHeaders: vi.fn(async () => ({})),
  buildAiApiUrl: (path: string) => path, buildAiBrowserUrl: (path: string) => path,
}))
beforeEach(() => vi.resetAllMocks())

it('查询模型使用 AI 鉴权请求和取消信号；不将业务失败当作空目录', async () => {
  const controller = new AbortController()
  vi.mocked(authorizedFetch).mockResolvedValue(new Response(JSON.stringify({ success: false, msg: '无权访问模型' })))
  await expect(fetchChatModels(controller.signal)).rejects.toThrow('无权访问模型')
  expect(authorizedFetch).toHaveBeenCalledWith('/api/v1/chat/models', expect.objectContaining({ signal: controller.signal }))
})

it.each([
  [null, null, 'auto', null], [null, 'low', 'auto', 'low'], ['model-x', 'auto', 'model-x', 'auto'], ['model-y', null, 'model-y', null],
] as const)('后台和直连发送使用相同协议：模型 %s，强度 %s', async (model, thinkingLevel, wireModel, wireLevel) => {
  const payload = { message: '问题', model, thinkingLevel }
  const { streamRequest } = await buildStartChatStreamRequest('sid', payload)
  expect(JSON.parse(streamRequest.body!)).toMatchObject({ model: wireModel, thinking_level: wireLevel, message: '问题' })
  vi.mocked(authorizedFetch).mockResolvedValue(new Response(''))
  await streamChatMessage('sid', payload)
  expect(authorizedFetch).toHaveBeenCalledWith('/api/v1/chat/sessions/sid/stream', expect.objectContaining({ body: streamRequest.body, method: 'POST' }))
})
