import { useEffect, useMemo, useRef, useState } from 'react'

type Batch = { ids: string[]; running: boolean; done: number }

type BatchDeleteOptions = {
  enabled: boolean
  availableIds: readonly string[]
  maxSelection: number
  messages: {
    limitNotice: string
    removeError: string
    partialFailure: (done: number, total: number, reason: string) => string
    refreshError: string
  }
  removeOne: (id: string, signal: AbortSignal) => Promise<void>
  refresh: (signal: AbortSignal) => Promise<boolean>
}

export function useAiBatchDelete({ enabled, availableIds, maxSelection, messages, removeOne, refresh }: BatchDeleteOptions) {
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState('')
  const [batch, setBatch] = useState<Batch | null>(null)
  const active = useRef<AbortController | null>(null)
  const selected = useMemo(() => new Set(availableIds.filter((id) => picked.has(id))), [availableIds, picked])
  const allSelected = selected.size > 0 && selected.size === availableIds.length

  useEffect(() => {
    if (!enabled) {
      setSelecting(false)
      setPicked(new Set())
      setNotice('')
      setBatch(null)
    }
    return () => {
      // 关闭列表入口或卸载组件后不再派发新的删除请求。
      active.current?.abort()
      active.current = null
    }
  }, [enabled])

  function changeMode(next: boolean) {
    if (batch) return
    setSelecting(next)
    setPicked(new Set())
    setNotice('')
  }

  function toggle(id: string) {
    if (batch || !availableIds.includes(id)) return
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else if (next.size < maxSelection) next.add(id)
    else { setNotice(messages.limitNotice); return }
    setNotice('')
    setPicked(next)
  }

  function toggleAll() {
    if (batch) return
    if (availableIds.length > maxSelection) { setNotice(messages.limitNotice); return }
    setNotice('')
    setPicked(new Set(allSelected ? [] : availableIds))
  }

  function askDelete() {
    if (!selecting || batch || !selected.size || selected.size > maxSelection) return
    // 确认前固定本批编号，后续列表刷新、勾选数量变化都不能扩大删除范围。
    setBatch({ ids: [...selected], running: false, done: 0 })
  }

  function cancelConfirm() {
    if (!active.current) setBatch(null)
  }

  async function confirmDelete() {
    if (!batch || batch.running || active.current) return
    const controller = new AbortController()
    active.current = controller
    const { signal } = controller
    const { ids } = batch
    let done = 0
    setNotice('')
    setBatch({ ids, running: true, done })
    try {
      // 后端仅支持单删：上一条确认成功才更新进度、发下一条，不重试失败项。
      for (const id of ids) {
        if (signal.aborted) return
        await removeOne(id, signal)
        if (signal.aborted) return
        done += 1
        setPicked((previous) => {
          const next = new Set(previous)
          next.delete(id)
          return next
        })
        setBatch({ ids, running: true, done })
      }
    } catch (error) {
      if (!signal.aborted) {
        const reason = error instanceof Error ? error.message : messages.removeError
        setNotice(messages.partialFailure(done, ids.length, reason))
      }
    }

    if (signal.aborted) return
    // 列表同步失败不代表删除失败，不能因此恢复成功项或再次发送删除。
    const refreshed = await refresh(signal)
    if (signal.aborted) return
    if (!refreshed) setNotice((message) => [message, messages.refreshError].filter(Boolean).join(' '))
    if (done === ids.length) setSelecting(false)
    setBatch(null)
    active.current = null
  }

  return { selecting, selected, allSelected, notice, batch, changeMode, toggle, toggleAll, askDelete, cancelConfirm, confirmDelete }
}
