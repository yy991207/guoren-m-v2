import { forwardRef, type ComponentPropsWithoutRef, type Ref } from 'react'
import './AiBatchDeleteControls.css'

type AiBatchCheckboxProps = Omit<ComponentPropsWithoutRef<'button'>, 'aria-checked' | 'role' | 'type'> & {
  checked?: boolean | 'mixed'
}

// 普通模式和勾选模式共用同一个原生按钮，切换时不用替换列表行。
export const AiBatchCheckbox = forwardRef<HTMLButtonElement, AiBatchCheckboxProps>(function AiBatchCheckbox({ checked, children, ...props }, ref) {
  return (
    <button {...props} aria-checked={checked} ref={ref} role={checked === undefined ? undefined : 'checkbox'} type="button">
      {checked !== undefined && <span aria-hidden="true" className="ai-batch-check" />}
      {children}
    </button>
  )
})

type AiBatchSelectionBarProps = {
  selectedCount: number
  allSelected: boolean
  disabled: boolean
  selectAllRef?: Ref<HTMLButtonElement>
  onToggleAll: () => void
  onCancel: () => void
}

export function AiBatchSelectionBar({ selectedCount, allSelected, disabled, selectAllRef, onToggleAll, onCancel }: AiBatchSelectionBarProps) {
  return (
    <div className="ai-batch-selection-bar">
      <AiBatchCheckbox checked={allSelected || (selectedCount ? 'mixed' : false)} disabled={disabled} ref={selectAllRef} onClick={onToggleAll}>全选</AiBatchCheckbox>
      <span aria-live="polite">已选 {selectedCount} 条</span>
      <button type="button" onClick={onCancel}>取消</button>
    </div>
  )
}

export function AiBatchDeleteFooter({ notice, disabled, onDelete, deleteLabel }: {
  notice: string
  disabled: boolean
  onDelete?: () => void
  deleteLabel: string
}) {
  return (
    <>
      {notice && <p className="ai-batch-delete-notice" role="status">{notice}</p>}
      {onDelete && <button className="ai-batch-delete-button" disabled={disabled} type="button" onClick={onDelete}>{deleteLabel}</button>}
    </>
  )
}
