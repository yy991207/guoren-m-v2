import type { ReactNode } from 'react'
import { AiBottomSheet } from './AiBottomSheet'
import { AiLoading } from './AiLoading'
import { AiSearchField } from './AiSearchField'

type AiSelectionSheetItem = {
  id: string
  title: string
  description?: string
  badge?: string
}

type AiSelectionSheetProps = {
  visible: boolean
  title: string
  searchPlaceholder: string
  searchValue: string
  items: AiSelectionSheetItem[]
  selectedIds: string[]
  showSearch?: boolean
  loading: boolean
  error: string
  emptyText: string
  fixedHeight?: boolean
  children?: ReactNode
  onClose: () => void
  onSearchChange: (value: string) => void
  onSelect: (itemId: string) => void
}

export function AiSelectionSheet({
  visible,
  title,
  searchPlaceholder,
  searchValue,
  items,
  selectedIds,
  showSearch = true,
  loading,
  error,
  emptyText,
  fixedHeight = false,
  children,
  onClose,
  onSearchChange,
  onSelect,
}: AiSelectionSheetProps) {
  if (!visible) {
    return null
  }

  return (
    <AiBottomSheet className={`ai-selection-sheet${fixedHeight ? ' is-fixed-height' : ''}`} label={title} onClose={onClose}>
      <div className="ai-selection-sheet-header">
        <div className="ai-selection-sheet-title">{title}</div>
        <button
          aria-label={`关闭${title}`}
          className="ai-selection-sheet-close"
          type="button"
          onClick={onClose}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6L18 18" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
      </div>

      {showSearch ? (
        <AiSearchField placeholder={searchPlaceholder} value={searchValue} onChange={onSearchChange} />
      ) : null}

      <div className={`ai-selection-sheet-body has-edge-scrollbar${children ? ' is-plain' : ''}`}>
        {children ?? (
          <>
            {loading ? <AiLoading message="加载中…" /> : null}
            {!loading && error ? <div className="ai-selection-sheet-status is-error">{error}</div> : null}
            {!loading && !error && items.length === 0 ? <div className="ai-selection-sheet-status">{emptyText}</div> : null}
            {!loading && !error && items.length > 0 ? (
              <div className="ai-selection-sheet-list">
                {items.map((item) => {
                  const checked = selectedIds.includes(item.id)

                  return (
                    <button
                      aria-pressed={checked}
                      className={`ai-selection-sheet-item${checked ? ' is-selected' : ''}`}
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(item.id)}
                    >
                      <div className="ai-selection-sheet-item-main">
                        <div className="ai-selection-sheet-item-title-row">
                          <span className="ai-selection-sheet-item-title">{item.title}</span>
                          {item.badge ? <span className="ai-selection-sheet-item-badge">{item.badge}</span> : null}
                        </div>
                        {item.description ? <div className="ai-selection-sheet-item-desc">{item.description}</div> : null}
                      </div>
                      <span className="ai-selection-sheet-item-action">{checked ? '已添加' : '添加'}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
    </AiBottomSheet>
  )
}
