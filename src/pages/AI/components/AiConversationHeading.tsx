import { AiNameAvatar } from './AiNameAvatar'
import './AiConversationHeading.css'

type AiConversationHeadingProps = {
  sessionName?: string
  agentName?: string
  avatarUrl?: string | null
}

export function AiConversationHeading({ sessionName, agentName, avatarUrl }: AiConversationHeadingProps) {
  const sessionTitle = sessionName?.trim()
  const agentTitle = agentName?.trim()
  const stacked = Boolean(sessionTitle && agentTitle)

  return (
    <div className="ai-conversation-heading" data-layout={stacked ? 'stacked' : 'single'}>
      {sessionTitle && <div className="ai-conversation-heading-title" title={sessionTitle}>{sessionTitle}</div>}
      {agentTitle && (
        <div className="ai-conversation-heading-agent">
          <AiNameAvatar
            avatarUrl={avatarUrl}
            className="ai-conversation-heading-avatar"
            imageClassName="ai-conversation-heading-avatar-image"
            name={agentTitle}
            tone="white"
          />
          <span className="ai-conversation-heading-agent-name" title={agentTitle}>{agentTitle}</span>
        </div>
      )}
    </div>
  )
}
