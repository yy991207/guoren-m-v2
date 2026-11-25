import { useId, useLayoutEffect, useRef } from 'react'

type Props = {
  total: number
  done: number
  running: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AiSessionDeleteDialog({ total, done, running, onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  useLayoutEffect(() => {
    if (running) titleRef.current?.focus({ preventScroll: true })
  }, [running])

  return (
    <dialog
      aria-labelledby={titleId} className="ai-session-delete-dialog" ref={ref}
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => { event.preventDefault(); if (!running) onCancel() }}
    >
      <h2 id={titleId} ref={titleRef} tabIndex={-1}>{running ? '正在删除对话' : `删除选中的 ${total} 条对话？`}</h2>
      {running ? (
        <>
          <p role="status"><span className="ai-session-delete-spinner" aria-hidden="true" />已删除 {done} / {total} 条</p>
          <div className="ai-session-delete-track" role="progressbar" aria-label="删除进度" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
            <span style={{ width: `${100 * done / total}%` }} />
          </div>
        </>
      ) : (
        <>
          <p>删除后无法恢复。</p>
          <div className="ai-session-delete-actions">
            <button autoFocus type="button" onClick={onCancel}>取消删除</button>
            <button className="is-destructive" type="button" onClick={onConfirm}>确认删除</button>
          </div>
        </>
      )}
    </dialog>
  )
}
