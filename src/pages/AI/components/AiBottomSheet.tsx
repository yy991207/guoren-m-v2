import { useLayoutEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import './AiBottomSheet.css'

type AiBottomSheetProps = {
  label: string
  className?: string
  nativeModal?: boolean
  children: ReactNode
  onClose: () => void
}

export function AiBottomSheet({ label, className, nativeModal = false, children, onClose }: AiBottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const startedOnBackdrop = useRef(false)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [nativeModal])

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    // 从面板内开始的拖动即使在遮罩上松手，也不应把操作弹窗点掉。
    if (event.target === event.currentTarget && (startedOnBackdrop.current || event.detail === 0)) onClose()
    startedOnBackdrop.current = false
  }
  const panel = (
    <div
      className={className ? `ai-bottom-sheet__panel ${className}` : 'ai-bottom-sheet__panel'}
      role={nativeModal ? undefined : 'dialog'}
      aria-label={nativeModal ? undefined : label}
      aria-modal={nativeModal ? undefined : true}
    >
      <div aria-hidden="true" className="ai-bottom-sheet__handle" />
      {children}
    </div>
  )
  const surfaceEvents = {
    onClick: handleClick,
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      startedOnBackdrop.current = event.target === event.currentTarget
    },
  }

  // 保留原生弹层已有的键盘和焦点行为；页面内弹层仍在应用层，避免短提示被浏览器顶层盖住。
  return nativeModal ? (
    <dialog
      {...surfaceEvents}
      ref={dialogRef}
      aria-label={label}
      className="ai-bottom-sheet"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      {panel}
    </dialog>
  ) : (
    <div {...surfaceEvents} className="ai-bottom-sheet ai-bottom-sheet--local">
      {panel}
    </div>
  )
}
