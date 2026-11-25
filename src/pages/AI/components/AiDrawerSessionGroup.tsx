import type { ChatSession } from '../../../services/chat/types'

type AiDrawerSessionGroupProps = {
  title: '今天' | '7天内' | '7天外'
  items: ChatSession[]
  activeSessionId?: string | null
  removingSessionIds?: Set<string>
  selection?: { selected: ReadonlySet<string>; toggle: (sessionId: string) => void }
  onOpenSession: (sessionId: string) => void
}

const EMPTY_REMOVING_SESSION_IDS = new Set<string>()

export function AiDrawerSessionGroup({
  title,
  items,
  activeSessionId = null,
  removingSessionIds = EMPTY_REMOVING_SESSION_IDS,
  selection,
  onOpenSession,
}: AiDrawerSessionGroupProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="ai-drawer-chat-group">
      <div className="ai-drawer-chat-group-title">{title}</div>
      {items.map((session) => {
        const isRemoving = removingSessionIds.has(session.session_id)
        const sessionTitle = session.session_name?.trim() || '话题'

        return (
          <div className={`ai-drawer-chat-row ${isRemoving ? 'is-removing' : ''}`} key={session.session_id}>
            <button
              className={`ai-drawer-chat-item ${activeSessionId === session.session_id ? 'is-active' : ''}`}
              disabled={isRemoving}
              role={selection ? 'checkbox' : undefined}
              aria-checked={selection ? selection.selected.has(session.session_id) : undefined}
              type="button"
              onClick={() => selection ? selection.toggle(session.session_id) : onOpenSession(session.session_id)}
            >
              {selection && <span aria-hidden="true" className="ai-task-check" />}
              <div className="ai-drawer-chat-icon">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="ai-drawer-chat-title">{sessionTitle}</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
