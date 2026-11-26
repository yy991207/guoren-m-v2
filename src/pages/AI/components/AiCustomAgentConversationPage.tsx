import { SetOutline } from 'antd-mobile-icons'
import type { ReactNode } from 'react'

import type { ChatMessage } from '../../../services/chat/types'
import type { SelectedArtifact } from '../hooks/useAiChatRuntime'
import type { AiAgentPresetQuestion } from '../utils/agentPresetQuestions'
import { AiAgentConversationPreview } from './AiAgentConversationPreview'
import { AiLoading } from './AiLoading'
import { AiConversationHeading } from './AiConversationHeading'

type AiCustomAgentConversationPageProps = {
  agentName: string
  sessionName?: string
  avatarUrl?: string | null
  description: string
  questions: AiAgentPresetQuestion[]
  messages?: ChatMessage[]
  composer: ReactNode
  requestError?: string
  loading?: boolean
  error?: string
  canEdit?: boolean
  onBack: () => void
  onOpenEdit?: () => void
  onSelectArtifact?: (artifact: SelectedArtifact) => void
  onSuggestionClick: (prompt: string) => void
}

export function AiCustomAgentConversationPage({
  agentName,
  sessionName,
  avatarUrl,
  description,
  questions,
  messages,
  composer,
  requestError = '',
  loading = false,
  error = '',
  canEdit = false,
  onBack,
  onOpenEdit,
  onSelectArtifact,
  onSuggestionClick,
}: AiCustomAgentConversationPageProps) {
  const heading = <AiConversationHeading sessionName={sessionName} agentName={agentName} avatarUrl={avatarUrl} />

  if (loading || error) {
    return (
      <div className="ai-custom-agent-conversation-page">
        <div className="ai-agent-config-header">
          <button
            aria-label="返回主页"
            className="ai-agent-config-back"
            type="button"
            onClick={onBack}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {heading}
          <div aria-hidden="true" className="ai-agent-config-header-spacer" />
        </div>

        {loading ? <AiLoading fill message="智能体加载中…" variant="page" /> : (
          <div className="ai-custom-agent-conversation-status" role="alert">{error || '智能体加载失败'}</div>
        )}
      </div>
    )
  }

  return (
    <div className="ai-custom-agent-conversation-page">
      <div className="ai-agent-config-header">
        <button
          aria-label="返回主页"
          className="ai-agent-config-back"
          type="button"
          onClick={onBack}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {heading}
        {canEdit ? (
          <button
            aria-label="编辑自定义智能体"
            className="ai-agent-config-close"
            type="button"
            onClick={onOpenEdit}
          >
            <SetOutline aria-hidden="true" style={{ fontSize: 20 }} />
          </button>
        ) : (
          <div aria-hidden="true" className="ai-agent-config-header-spacer" />
        )}
      </div>

      <AiAgentConversationPreview
        agentName={agentName}
        avatarUrl={avatarUrl}
        composer={composer}
        description={description}
        messages={messages}
        questions={questions}
        requestError={requestError}
        showProfileEditButton={false}
        onSelectArtifact={onSelectArtifact}
        onSuggestionClick={onSuggestionClick}
      />
    </div>
  )
}
