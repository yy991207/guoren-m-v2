import { beforeEach, expect, it, vi } from 'vitest'
import { authorizedFetch } from '../utils/request'
import { fetchAgentTemplateTask } from './agentTemplates'

vi.mock('../utils/request', () => ({
  authorizedFetch: vi.fn(),
  buildAiApiUrl: (path: string, params: Record<string, string>) => `${path}?${new URLSearchParams(params)}`,
}))
vi.mock('./chat/api', () => ({ getChatUserId: () => 'fixture' }))

beforeEach(() => vi.clearAllMocks())

it.each([
  ['running', '智能体正在生成'],
  ['completed', '智能体生成成功'],
  ['failed', '智能体生成失败，请稍后再试'],
])('读取顶层状态 %s 和提示，不要求附带任务结果', async (status, msg) => {
  const signal = new AbortController().signal
  vi.mocked(authorizedFetch).mockResolvedValueOnce(Response.json({ status, msg }))
  await expect(fetchAgentTemplateTask('task/a', signal)).resolves.toEqual({ status, message: msg })
  expect(authorizedFetch).toHaveBeenCalledWith('/api/v1/custom-agents/templates/tasks/task%2Fa?user_id=fixture',
    expect.objectContaining({ method: 'GET', signal }))
})

it('HTTP 查询失败用顶层 msg，异常响应不当作生成中', async () => {
  vi.mocked(authorizedFetch)
    .mockResolvedValueOnce(Response.json({ status: 'failed', msg: '任务不存在' }, { status: 404 }))
    .mockResolvedValueOnce(Response.json({ status: 'unknown', msg: '未知状态' }))
  await expect(fetchAgentTemplateTask('task')).rejects.toThrow('任务不存在')
  await expect(fetchAgentTemplateTask('task')).rejects.toThrow('模板任务状态数据不完整')
})
