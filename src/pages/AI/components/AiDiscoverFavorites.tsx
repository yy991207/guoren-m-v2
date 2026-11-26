import type { DiscoverAgentItem } from '../../../services/agents'
import { AiNameAvatar } from './AiNameAvatar'
import './AiDiscoverFavorites.css'

const AGENTS_PER_CARD = 3

type AiDiscoverFavoritesProps = {
  agents: DiscoverAgentItem[]
  onOpenAgentChat: (agent: DiscoverAgentItem) => void
}

export function AiDiscoverFavorites({ agents, onOpenAgentChat }: AiDiscoverFavoritesProps) {
  const cardCount = Math.max(1, Math.ceil(agents.length / AGENTS_PER_CARD))

  return (
    <section aria-label="收藏" className="ai-discover-favorites">
      <div className="ai-discover-favorites-track" data-scrollable={cardCount > 1}>
        {Array.from({ length: cardCount }, (_, index) => {
          const first = index * AGENTS_PER_CARD
          const items = agents.slice(first, first + AGENTS_PER_CARD)

          return (
            <div className="ai-discover-favorites-card" key={items[0]?.agentId ?? 'empty'}>
              <div className="ai-discover-favorites-header">
                {index === 0 ? <h2>收藏</h2> : <span>收藏</span>}
                {cardCount > 1 && <span className="ai-discover-favorites-position">{index + 1} / {cardCount}</span>}
              </div>
              {items.length ? (
                <div className="ai-discover-favorites-items">
                  {items.map(agent => (
                    <div className="ai-discover-favorites-entry" data-active={agent.isActive} key={agent.agentId}>
                      <AiNameAvatar
                        avatarUrl={agent.avatarUrl}
                        className="ai-discover-favorites-avatar"
                        imageClassName="ai-discover-favorites-avatar-image"
                        name={agent.agentName}
                        tone="white"
                      />
                      <span className="ai-discover-favorites-name" title={agent.agentName}>{agent.agentName}</span>
                      <button
                        aria-label={`去对话：${agent.agentName}`}
                        className="ai-discover-favorites-chat"
                        disabled={!agent.isActive}
                        type="button"
                        onClick={() => onOpenAgentChat(agent)}
                      />
                    </div>
                  ))}
                </div>
              ) : <p className="ai-discover-favorites-empty">暂无收藏的智能体</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
