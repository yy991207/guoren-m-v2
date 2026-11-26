import type { KeyboardEventHandler, ReactNode } from 'react'
import { AiNameAvatar, type AiNameAvatarTone } from './AiNameAvatar'
import './AiCatalogCard.css'

type AiCatalogCardProps = {
  title: string
  description?: string | null
  avatarUrl?: string | null
  avatarTone?: AiNameAvatarTone
  showAvatar?: boolean
  meta?: ReactNode
  body?: ReactNode
  footer?: ReactNode
  sideAction?: ReactNode
  busy?: boolean
  open?: { label: string; run: () => void; disabled?: boolean; actionText?: string }
  onKeyDown?: KeyboardEventHandler<HTMLElement>
}

export function AiCatalogCard({
  title, description, avatarUrl, avatarTone = 'white', showAvatar = true, meta, body, footer, sideAction,
  busy, open, onKeyDown,
}: AiCatalogCardProps) {
  return (
    <article aria-busy={busy} aria-label={title} className="ai-catalog-card" onKeyDown={onKeyDown}>
      <div className="ai-catalog-card-head">
        {showAvatar && (
          <AiNameAvatar avatarUrl={avatarUrl} className="ai-catalog-card-avatar" imageClassName="ai-catalog-card-avatar-image" name={title} tone={avatarTone} />
        )}
        <div className="ai-catalog-card-heading">
          <div className="ai-catalog-card-title" title={title}>{title}</div>
          {meta}
        </div>
      </div>
      {description && <p className="ai-catalog-card-description">{description}</p>}
      {body}
      {/* 整卡点击和附加操作是并列的按钮，键盘或触屏操作不会串到详情。 */}
      {open && (
        <button aria-label={open.label} className="ai-catalog-card-open" disabled={open.disabled} type="button" onClick={open.run}>
          {open.actionText && <span aria-hidden="true" className="ai-catalog-card-open-label">{open.actionText}</span>}
        </button>
      )}
      {footer && <div className="ai-catalog-card-footer" data-side-action={sideAction ? '' : undefined}>{footer}</div>}
      {sideAction}
    </article>
  )
}

export function AiCatalogTag({ children }: { children: ReactNode }) {
  return <span className="ai-catalog-card-tag">{children}</span>
}
