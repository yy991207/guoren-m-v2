import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { fetchClawhubSkills, fetchOfficialSkills, searchClawhubSkills, type SkillSummaryItem } from '../../../services/skills'
import { useSkillCommunity } from './useSkillCommunity'

vi.mock('../../../services/skills', () => ({
  fetchOfficialSkills: vi.fn(), fetchClawhubSkills: vi.fn(), searchClawhubSkills: vi.fn(),
}))

const skill: SkillSummaryItem = { id: 'sk', skillName: 'sk', title: '测试技能', description: '', template: '', tags: [], source: 'official', isSelected: false }
const mount = (open = false) => renderHook(({ open, query }) => useSkillCommunity(open, query), { initialProps: { open, query: '' } })
function deferred() {
  let resolve!: (rows: SkillSummaryItem[]) => void
  const promise = new Promise<SkillSummaryItem[]>(ok => { resolve = ok })
  return { promise, resolve }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchOfficialSkills).mockResolvedValue([skill])
  vi.mocked(fetchClawhubSkills).mockResolvedValue([])
  vi.mocked(searchClawhubSkills).mockResolvedValue([skill])
})

it('首次按需加载，快速往返共用未完成请求，空列表也是命中；重新挂载才重新请求', async () => {
  const pending = deferred()
  vi.mocked(fetchOfficialSkills).mockReturnValueOnce(pending.promise)
  const { result, rerender, unmount } = mount()
  expect(fetchOfficialSkills).not.toHaveBeenCalled()
  expect(fetchClawhubSkills).not.toHaveBeenCalled()
  rerender({ open: true, query: '' })
  rerender({ open: false, query: '' })
  rerender({ open: true, query: '' })
  expect(vi.mocked(fetchOfficialSkills).mock.calls[0][0]?.aborted).toBe(false)
  await act(async () => pending.resolve([]))
  rerender({ open: false, query: '' })
  rerender({ open: true, query: '' })
  expect(result.current.official).toEqual({ items: [], loading: false, error: '' })
  expect(result.current.clawhub).toEqual({ items: [], loading: false, error: '' })
  expect(fetchOfficialSkills).toHaveBeenCalledOnce()
  expect(fetchClawhubSkills).toHaveBeenCalledOnce()
  unmount()
  const fresh = mount(true)
  await waitFor(() => expect(fresh.result.current.official.items).toEqual([skill]))
  expect(fetchOfficialSkills).toHaveBeenCalledTimes(2)
  expect(fetchClawhubSkills).toHaveBeenCalledTimes(2)
})

it('官方和社区独立缓存，失败保留提示且不循环重试，再次进入仅请求失败的一项', async () => {
  vi.mocked(fetchClawhubSkills).mockRejectedValueOnce(new Error('社区请求失败'))
  const { result, rerender } = mount(true)
  await waitFor(() => expect(result.current.clawhub.error).toBe('社区请求失败'))
  expect(result.current.official.items).toEqual([skill])
  expect(fetchClawhubSkills).toHaveBeenCalledOnce()
  rerender({ open: false, query: '' })
  rerender({ open: true, query: '' })
  await waitFor(() => expect(result.current.clawhub).toEqual({ items: [], loading: false, error: '' }))
  expect(fetchClawhubSkills).toHaveBeenCalledTimes(2)
  expect(fetchOfficialSkills).toHaveBeenCalledOnce()
})

it('搜索只查 ClawHub，迟到的旧查询不会覆盖当前结果，清空后复用浏览列表', async () => {
  const stale = deferred()
  vi.mocked(searchClawhubSkills).mockReturnValueOnce(stale.promise)
  const { result, rerender } = mount(true)
  rerender({ open: true, query: '甲' })
  await waitFor(() => expect(searchClawhubSkills).toHaveBeenCalledTimes(1))
  rerender({ open: true, query: ' 乙 ' })
  expect(vi.mocked(searchClawhubSkills).mock.calls[0][1]?.signal?.aborted).toBe(true)
  await waitFor(() => expect(result.current.clawhub.items).toEqual([skill]))
  expect(vi.mocked(searchClawhubSkills).mock.calls.map(([q]) => q)).toEqual(['甲', '乙'])
  await act(async () => stale.resolve([{ ...skill, id: '旧' }]))
  rerender({ open: false, query: ' 乙 ' })
  rerender({ open: true, query: ' 乙 ' })
  expect(result.current.clawhub.items).toEqual([skill])
  expect(result.current.clawhub.loading).toBe(false)
  rerender({ open: true, query: '' })
  expect(result.current.clawhub.items).toEqual([])
  expect(result.current.clawhub.loading).toBe(false)
  expect(fetchOfficialSkills).toHaveBeenCalledOnce()
  expect(fetchClawhubSkills).toHaveBeenCalledOnce()
  expect(searchClawhubSkills).toHaveBeenCalledTimes(2)
})

it('已确认的添加和移除同步到缓存及晚到的结果，卸载后终止未完成请求', async () => {
  const pending = deferred()
  vi.mocked(fetchClawhubSkills).mockReturnValueOnce(pending.promise)
  const { result, rerender, unmount } = mount(true)
  await waitFor(() => expect(result.current.official.items).toEqual([skill]))
  act(() => result.current.setSkillSelected('sk', true))
  await act(async () => pending.resolve([skill]))
  expect(result.current.official.items[0].isSelected).toBe(true)
  expect(result.current.clawhub.items[0].isSelected).toBe(true)
  act(() => result.current.setSkillSelected('sk', false))
  expect(result.current.clawhub.items[0].isSelected).toBe(false)
  vi.mocked(searchClawhubSkills).mockReturnValueOnce(deferred().promise)
  rerender({ open: true, query: '最后' })
  await waitFor(() => expect(searchClawhubSkills).toHaveBeenCalledOnce())
  unmount()
  expect(vi.mocked(searchClawhubSkills).mock.calls[0][1]?.signal?.aborted).toBe(true)
})
