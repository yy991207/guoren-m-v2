import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { fetchCustomAgentRecommendedSkills, type SkillSummaryItem } from '../../../services/skills'
import { useRecommendedSkillCache, useRecommendedSkillResult } from './useRecommendedSkillCache'

vi.mock('../../../services/skills', () => ({ fetchCustomAgentRecommendedSkills: vi.fn() }))

const load = vi.mocked(fetchCustomAgentRecommendedSkills)
const payload = { agent_name: '备课助手', description: '整理教案', agent_prompt: '帮助备课' }
const item: SkillSummaryItem = { id: 'lesson', skillName: 'lesson', title: '教案助手', description: '', template: '', source: 'official', tags: [], isSelected: false }

function deferred() {
  let resolve!: (items: SkillSummaryItem[]) => void
  const promise = new Promise<SkillSummaryItem[]>(done => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => { load.mockReset() })

it('切走再回来共用未完成的请求；空结果也缓存，换智能体才重新请求', async () => {
  const pending = deferred()
  load.mockReturnValueOnce(pending.promise).mockResolvedValueOnce([item])
  const { result, rerender } = renderHook(({ open, agentId }) => {
    const cache = useRecommendedSkillCache('editor')
    return useRecommendedSkillResult(cache, open, agentId, payload)
  }, { initialProps: { open: true, agentId: 'first' } })
  expect(result.current.loading).toBe(true)
  expect(load).toHaveBeenCalledOnce()
  rerender({ open: false, agentId: 'first' })
  rerender({ open: true, agentId: 'first' })
  expect(load).toHaveBeenCalledOnce()
  expect(load.mock.calls[0][1]?.aborted).toBe(false)
  await act(async () => { pending.resolve([]) })
  expect(result.current).toEqual({ items: [], loading: false, error: '' })
  rerender({ open: false, agentId: 'first' })
  rerender({ open: true, agentId: 'first' })
  expect(load).toHaveBeenCalledOnce()
  rerender({ open: true, agentId: 'second' })
  await waitFor(() => expect(result.current.items).toEqual([item]))
  expect(load).toHaveBeenCalledTimes(2)
})

it('离开页面或换账号取消原请求，迟到的结果不会进入另一个账号', async () => {
  const first = deferred()
  const second = deferred()
  load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const { result, rerender, unmount } = renderHook(userId => {
    const cache = useRecommendedSkillCache(userId)
    return useRecommendedSkillResult(cache, true, 'agent', payload)
  }, { initialProps: 'first-user' })
  rerender('second-user')
  expect(load.mock.calls[0][1]?.aborted).toBe(true)
  expect(load).toHaveBeenCalledTimes(2)
  await act(async () => { first.resolve([item]) })
  expect(result.current.items).toHaveLength(0)
  expect(result.current.loading).toBe(true)
  unmount()
  expect(load.mock.calls[1][1]?.aborted).toBe(true)
})

it('失败不缓存也不自动重试，主动重进推荐后才请求', async () => {
  load.mockRejectedValueOnce(new Error('请求失败')).mockResolvedValueOnce([item])
  const { result, rerender } = renderHook(open => {
    const cache = useRecommendedSkillCache('editor')
    return useRecommendedSkillResult(cache, open, 'agent', payload)
  }, { initialProps: true })
  await waitFor(() => expect(result.current.error).toBe('请求失败'))
  expect(load).toHaveBeenCalledOnce()
  rerender(false)
  rerender(true)
  await waitFor(() => expect(result.current.items).toEqual([item]))
  expect(load).toHaveBeenCalledTimes(2)
})
