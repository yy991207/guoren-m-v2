import { useId, useLayoutEffect, useRef } from 'react'
import { CheckOutline, CloseOutline } from 'antd-mobile-icons'
import './AiWorkspaceModelSheet.css'

type AiWorkspaceModelSheetProps = {
  onClose: () => void
}

export function AiWorkspaceModelSheet({ onClose }: AiWorkspaceModelSheetProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    // 交给浏览器限制弹层内的焦点范围，卸载前关闭才能把焦点还给触发按钮。
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      aria-labelledby={titleId}
      className="ai-workspace-model-sheet"
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="ai-workspace-model-sheet__content">
        <div aria-hidden="true" className="ai-workspace-model-sheet__handle" />
        <div className="ai-workspace-model-sheet__header">
          <h2 id={titleId}>选择模型</h2>
          <button aria-label="关闭模型选择" className="ai-workspace-model-sheet__close" type="button" onClick={onClose}>
            <CloseOutline aria-hidden="true" width={18} height={18} />
          </button>
        </div>
        <p className="ai-workspace-model-sheet__option">
          <span className="ai-workspace-model-sheet__label">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="8.5" />
              <path d="m9 15.5 3-7 3 7M10 13.25h4" />
            </svg>
            <span>Auto</span>
            <span className="ai-workspace-model-sheet__visually-hidden">（当前已选）</span>
          </span>
          <CheckOutline aria-hidden="true" className="ai-workspace-model-sheet__check" width={18} height={18} />
        </p>
      </div>
    </dialog>
  )
}
