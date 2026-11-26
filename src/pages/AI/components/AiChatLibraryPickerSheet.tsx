import type { LibraryResourceFile } from '../../../services/library'
import LibraryScopeTabs, { type LibraryScopeTabKey } from '../../Library/components/LibraryScopeTabs'
import { AiBottomSheet } from './AiBottomSheet'
import { AiLoading } from './AiLoading'
import '../../Library/index.css'
import './AiChatLibraryPickerSheet.css'

type AiChatLibraryPickerSheetProps = {
  items: LibraryResourceFile[]
  scope: LibraryScopeTabKey
  selectedIds: string[]
  attachedResourceIds: ReadonlySet<string>
  loading: boolean
  error: string
  onScopeChange: (scope: LibraryScopeTabKey) => void
  onToggle: (id: string) => void
  onConfirm: () => void
  onClose: () => void
}

function formatLibraryPickerDateTime(value: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\//g, '-')
}

function resolveLibraryPickerBadge(file: LibraryResourceFile): { bg: string; label: string } {
  const normalizedExt = file.fileExt.toLowerCase() || file.fileName.split('.').pop()?.toLowerCase() || ''

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(normalizedExt)) {
    return { bg: '#FF8A34', label: 'IMG' }
  }

  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'm4v'].includes(normalizedExt)) {
    return { bg: '#8D5BFF', label: 'VID' }
  }

  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(normalizedExt)) {
    return { bg: '#25B864', label: 'AUD' }
  }

  if (['ppt', 'pptx', 'key'].includes(normalizedExt)) {
    return { bg: '#FF8A34', label: 'PPT' }
  }

  if (normalizedExt === 'pdf') {
    return { bg: '#4A7CFF', label: 'PDF' }
  }

  if (normalizedExt === 'html' || normalizedExt === 'htm') {
    return { bg: '#8c8f96', label: 'HTML' }
  }

  return { bg: '#4A7CFF', label: 'DOC' }
}

function renderLibraryPickerFileBadge(file: LibraryResourceFile) {
  const { bg, label } = resolveLibraryPickerBadge(file)

  return (
    <span aria-hidden="true" className="library-file-icon" style={{ background: bg }}>
      {label}
    </span>
  )
}

export function AiChatLibraryPickerSheet({
  items, scope, selectedIds, attachedResourceIds, loading, error, onScopeChange, onToggle, onConfirm, onClose,
}: AiChatLibraryPickerSheetProps) {
  const canAdd = !loading && !error && items.some(item => selectedIds.includes(item.nodeId) && !attachedResourceIds.has(item.resourceId))
  return (
    <AiBottomSheet className="ai-library-picker-sheet" label="选择资料库文件" nativeModal onClose={onClose}>
      <div className="ai-library-picker-header">
        <h2>选择资料库文件</h2>
        <LibraryScopeTabs activeScope={scope} onScopeChange={onScopeChange} />
      </div>

      <div className="ai-library-picker-content">
        {loading && <AiLoading message="资料库加载中…" variant="page" />}
        {!loading && error && <div className="library-empty" role="alert">{error}</div>}
        {!loading && !error && items.length === 0 && <div className="library-empty library-empty-title">暂无可引用文件</div>}
        {!loading && !error && items.map(item => {
          const checked = selectedIds.includes(item.nodeId)
          const isAlreadyAttached = attachedResourceIds.has(item.resourceId)
          const date = formatLibraryPickerDateTime(item.createTime)
          return (
            <button
              aria-pressed={checked}
              className={['library-item', 'ai-library-picker-item', checked && 'is-selected', isAlreadyAttached && 'is-disabled'].filter(Boolean).join(' ')}
              disabled={isAlreadyAttached}
              key={item.nodeId}
              type="button"
              onClick={() => onToggle(item.nodeId)}
            >
              <span aria-hidden="true" className={checked ? 'ai-library-picker-checkbox is-checked' : 'ai-library-picker-checkbox'}>
                {checked && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span className="library-item-main">
                {renderLibraryPickerFileBadge(item)}
                <span className="library-item-body">
                  <span className="library-item-name" title={item.fileName}>{item.fileName}</span>
                  <span className="library-item-meta">{isAlreadyAttached ? '已添加到当前会话' : item.createBy || '未知来源'}</span>
                </span>
              </span>
              <span className="library-item-side-text" title={date}>{date}</span>
            </button>
          )
        })}
      </div>

      <div className="ai-library-picker-footer">
        <button className="ai-library-picker-footer-btn" type="button" onClick={onClose}>取消</button>
        <button className="ai-library-picker-footer-btn is-primary" disabled={!canAdd} type="button" onClick={onConfirm}>添加</button>
      </div>
    </AiBottomSheet>
  )
}
