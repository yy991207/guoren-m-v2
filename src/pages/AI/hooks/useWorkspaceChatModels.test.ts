import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchChatModels, modelChoice, resolveModelChoice, type ChatModelCatalog } from '../../../services/chat/models'
import { catalog } from '../../../test/fixtures/chatModels'
import { useWorkspaceChatModels } from './useWorkspaceChatModels'

vi.mock('../../../services/chat/models', async (load) => ({ ...await load<typeof import('../../../services/chat/models')>(), fetchChatModels: vi.fn() }))
beforeEach(() => { sessionStorage.clear(); vi.mocked(fetchChatModels).mockReset().mockResolvedValue(catalog) })

describe('主对话模型与档位', () => {
  it('Auto 保留自动语义、使用默认模型的档位；切模型时清除上一模型的强度', async () => {
    const { result } = renderHook(useWorkspaceChatModels)
    await waitFor(() => expect(result.current.controls.loading).toBe(false))
    expect(result.current.controls).toMatchObject({ model: null, label: 'Auto', thinkingLevel: 'high' })
    act(() => result.current.controls.selectLevel('low'))
    act(() => result.current.controls.selectModel(null))
    expect(result.current.controls.thinkingLevel).toBe('low')
    act(() => result.current.controls.selectModel('model-b'))
    expect(result.current.controls.thinkingLevel).toBe('medium')
    act(() => result.current.controls.selectModel('model-c'))
    expect(result.current.controls).toMatchObject({ levels: [], thinkingLevel: null })
    act(() => result.current.controls.selectLevel('high'))
    expect(result.current.controls.thinkingLevel).toBeNull()
  })

  it('历史选择不写偏好，新任务和刷新页面都恢复最后一次手动选择的组合', async () => {
    const first = renderHook(useWorkspaceChatModels)
    await waitFor(() => expect(first.result.current.controls.loading).toBe(false))
    act(() => first.result.current.controls.selectModel('model-a'))
    act(() => first.result.current.controls.selectLevel('low'))
    act(() => first.result.current.restoreHistory('model-b', 'medium'))
    expect(first.result.current.controls.model).toBe('model-b')
    act(() => first.result.current.restorePreference())
    expect(first.result.current.controls).toMatchObject({ model: 'model-a', thinkingLevel: 'low' })
    act(() => first.result.current.restoreHistory('auto', 'high'))
    first.unmount()
    const second = renderHook(useWorkspaceChatModels)
    await waitFor(() => expect(second.result.current.controls.loading).toBe(false))
    expect(second.result.current.controls).toMatchObject({ model: 'model-a', thinkingLevel: 'low' })
  })

  it('历史选项先于目录到达时不丢失；失效模型不把旧档位带入 Auto', async () => {
    let finish!: (data: ChatModelCatalog) => void
    vi.mocked(fetchChatModels).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const { result } = renderHook(useWorkspaceChatModels)
    act(() => result.current.restoreHistory('model-a', 'low'))
    await act(async () => finish(catalog))
    expect(result.current.controls).toMatchObject({ model: 'model-a', thinkingLevel: 'low' })
    act(() => result.current.restoreHistory('removed', 'low'))
    expect(result.current.controls).toMatchObject({ model: null, thinkingLevel: 'high' })
    act(() => result.current.restoreHistory())
    expect(result.current.controls).toMatchObject({ model: null, thinkingLevel: 'high' })
  })

  it('查询失败可手动重载，卸载终止请求', async () => {
    vi.mocked(fetchChatModels).mockRejectedValueOnce(new Error('模型查询失败'))
    const { result, unmount } = renderHook(useWorkspaceChatModels)
    await waitFor(() => expect(result.current.controls.error).toBe('模型查询失败'))
    expect(fetchChatModels).toHaveBeenCalledOnce()
    await act(() => result.current.controls.reload())
    expect(result.current.controls.models).toHaveLength(3)
    expect(result.current.controls.error).toBe('')
    const [signal] = vi.mocked(fetchChatModels).mock.calls[1]
    unmount()
    expect(signal.aborted).toBe(true)
  })

  it.each([['qwen3.8-max', 'auto'], ['glm-5.3', 'medium'], ['other', null]])('%s 未指定默认档时遵循 Web 规则，不臆造档位', (id, expected) => {
    const data: ChatModelCatalog = { default_model: id, models: [{ model: id, display_name: id, is_default: true, thinking: { levels: ['low', 'auto', 'medium'] } }] }
    expect(resolveModelChoice(modelChoice(), data).thinkingLevel).toBe(expected)
  })
})
