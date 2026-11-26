import { useId, useLayoutEffect, useRef } from 'react'
import './AiDeleteConfirmDialog.css'

type AiDeleteConfirmDialogProps = {
  title: string
  description?: string
  cancelLabel?: string
  confirmLabel?: string
  closeOnBackdrop?: boolean
  pending?: { title: string; message: string; progress?: { done: number; total: number } }
  onCancel: () => void
  onConfirm: () => void
}

function isBackdrop(target: EventTarget, dialog: HTMLDialogElement, x: number, y: number) {
  if (target !== dialog) return false
  const { left, top, right, bottom } = dialog.getBoundingClientRect()
  return x < left || x >= right || y < top || y >= bottom
}

export function AiDeleteConfirmDialog({
  title, description = '删除后无法恢复。', cancelLabel = '取消删除', confirmLabel = '确认删除',
  closeOnBackdrop = false, pending, onCancel, onConfirm,
}: AiDeleteConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const startedOnBackdrop = useRef(false)
  const titleId = useId()
  const detailId = useId()
  const running = Boolean(pending)

  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  useLayoutEffect(() => {
    const target = running ? titleRef.current : cancelRef.current
    target?.focus({ preventScroll: true })
  }, [running])

  return (
    <dialog
      aria-describedby={detailId}
      aria-labelledby={titleId}
      className="ai-delete-confirm-dialog"
      ref={ref}
      onCancel={event => {
        event.preventDefault()
        if (!running) onCancel()
      }}
      onClick={event => {
        event.stopPropagation()
        // 只允许从遮罩开始并结束的点击取消，弹窗内容和拖动都不算。
        if (closeOnBackdrop && !running && startedOnBackdrop.current && isBackdrop(event.target, event.currentTarget, event.clientX, event.clientY)) onCancel()
        startedOnBackdrop.current = false
      }}
      onKeyDown={event => event.stopPropagation()}
      onPointerDown={event => {
        startedOnBackdrop.current = isBackdrop(event.target, event.currentTarget, event.clientX, event.clientY)
      }}
    >
      <h2 id={titleId} ref={titleRef} tabIndex={-1}>{pending?.title ?? title}</h2>
      {pending ? (
        <>
          <p id={detailId} role="status"><span className="ai-delete-confirm-spinner" aria-hidden="true" />{pending.message}</p>
          {pending.progress && (
            <div className="ai-delete-confirm-track" role="progressbar" aria-label="删除进度" aria-valuemin={0} aria-valuemax={pending.progress.total} aria-valuenow={pending.progress.done}>
              <span style={{ width: `${100 * pending.progress.done / pending.progress.total}%` }} />
            </div>
          )}
        </>
      ) : (
        <>
          <p id={detailId}>{description}</p>
          <div className="ai-delete-confirm-actions">
            <button ref={cancelRef} type="button" onClick={onCancel}>{cancelLabel}</button>
            <button className="is-destructive" type="button" onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </>
      )}
    </dialog>
  )
}
