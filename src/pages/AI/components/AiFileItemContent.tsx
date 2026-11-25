import type { ReactNode } from 'react'
import type { LibraryPageFileItem } from '../../../services/library'
import './AiFileItemContent.css'

type FileType = LibraryPageFileItem['fileType']

const BADGES: Record<FileType, string> = {
  document: 'DOC', image: 'IMG', video: 'VID', audio: 'AUD',
  classroom: 'CLS', review: 'REV', whiteboard: 'WBD', other: 'FILE',
}

export function AiFileItemContent({ fileType, name, meta, compact = false }: {
  fileType: FileType
  name: string
  meta: ReactNode
  compact?: boolean
}) {
  return (
    <span className="ai-file-item-content" data-compact={compact ? '' : undefined}>
      <span className={`ai-file-item-content__badge type-${fileType}`}>{BADGES[fileType]}</span>
      <span className="ai-file-item-content__body">
        <span className="ai-file-item-content__name">{name}</span>
        <span className="ai-file-item-content__meta">{meta}</span>
      </span>
    </span>
  )
}
