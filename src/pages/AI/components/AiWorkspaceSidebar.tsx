import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import './AiWorkspaceSidebar.css'

type AiWorkspaceSidebarProps = {
  id: string
  open: boolean
  backgroundRef: RefObject<HTMLDivElement>
  onClose: () => void
  children: ReactNode
}

export function AiSidebarToggleIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M5 8.5h14M5 15.5h9" />
    </svg>
  )
}

export function AiWorkspaceSidebar({ id, open, backgroundRef, onClose, children }: AiWorkspaceSidebarProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      // 收起后再还焦，避免 React 提交过程把焦点还原到已经隐藏的侧栏。
      const returnTarget = returnFocusRef.current
      returnFocusRef.current = null
      if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true })
      return
    }
    const dialog = dialogRef.current
    const background = backgroundRef.current
    if (!dialog || !background) return

    if (document.activeElement instanceof HTMLElement && !dialog.contains(document.activeElement)) {
      returnFocusRef.current = document.activeElement
    }
    const wasInert = background.inert
    // 页面节点仍保留以保持草稿和滚动，但展开时不能点到或用键盘进入右侧对话。
    dialog.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
    background.inert = true
    return () => {
      background.inert = wasInert
    }
  }, [open, backgroundRef])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    // 折叠的历史节点仍在，焦点循环要排除它们，避免进入看不见的会话按钮。
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      .filter((button) => !button.closest('[hidden]'))
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus({ preventScroll: true })
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus({ preventScroll: true })
    }
  }

  return (
    <div
      aria-label="任务历史"
      aria-modal="true"
      className="ai-workspace-sidebar"
      hidden={!open}
      id={id}
      onKeyDown={handleKeyDown}
      ref={dialogRef}
      role="dialog"
    >
      <div className="ai-workspace-sidebar__panel">{children}</div>
      <button
        aria-label="收起任务侧栏"
        className="ai-workspace-sidebar__dismiss"
        onClick={onClose}
        type="button"
      />
    </div>
  )
}
