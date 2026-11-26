import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useAiBatchDelete } from './useAiBatchDelete'

it('用调用方的上限、数据编号与文案执行批删，不依赖对话列表', async () => {
  const removeOne = vi.fn<(id: string, signal: AbortSignal) => Promise<void>>()
    .mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('网络异常'))
  const refresh = vi.fn(async () => true)
  const { result } = renderHook(() => useAiBatchDelete({
    enabled: true,
    maxSelection: 2,
    availableIds: ['file-a', 'file-b', 'file-c'],
    messages: {
      limitNotice: '最多两个文件',
      partialFailure: (done, total, reason) => `文件 ${done}/${total}，${reason}`,
      refreshError: '文件列表未刷新',
      removeError: '文件无法删除',
    },
    removeOne,
    refresh,
  }))
  act(() => result.current.changeMode(true))
  act(() => result.current.toggleAll())
  expect(result.current.notice).toBe('最多两个文件')
  expect(result.current.selected.size).toBe(0)
  act(() => result.current.toggle('file-a'))
  act(() => result.current.toggle('file-b'))
  act(() => result.current.askDelete())
  await act(async () => result.current.confirmDelete())
  expect(removeOne.mock.calls.map(([id]) => id)).toEqual(['file-a', 'file-b'])
  expect(result.current.notice).toBe('文件 1/2，网络异常')
  expect([...result.current.selected]).toEqual(['file-b'])
  expect(refresh).toHaveBeenCalledOnce()
})
