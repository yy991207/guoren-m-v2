import { useId, useRef } from 'react'
import { Popover } from 'antd-mobile'
import { MoreOutline } from 'antd-mobile-icons'
import type { DiscoverAgentItem } from '../../../services/agents'
import DisplayName from '../../../components/DisplayName'
import { AiNameAvatar } from './AiNameAvatar'
import './AiDiscoverAgentCard.css'

type AiDiscoverAgentCardProps = {
  agent: DiscoverAgentItem
  pending: boolean
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  onOpenChat: () => void
  onChangeSubscription: (isSubscribed: boolean) => void
  onChangeFavorite: (isFavorite: boolean) => void
}

function formatAgentMeta(agent: DiscoverAgentItem): string {
  if (agent.publishScope === 'specified') return '协作'
  return agent.tenantId === null ? '官方' : '企业'
}

export function AiDiscoverAgentCard({
  agent, pending, menuOpen, onMenuOpenChange, onOpenChat, onChangeSubscription, onChangeFavorite,
}: AiDiscoverAgentCardProps) {
  const menuId = useId()
  const moreRef = useRef<HTMLButtonElement>(null)
  const { subscription } = agent
  const runAction = (change: (value: boolean) => void, value: boolean) => {
    onMenuOpenChange(false)
    change(value)
  }

  return (
    <article
      aria-busy={pending}
      aria-label={agent.agentName}
      className="ai-discover-card"
      onKeyDown={event => {
        if (event.key !== 'Escape' || !menuOpen) return
        event.stopPropagation()
        onMenuOpenChange(false)
        moreRef.current?.focus()
      }}
    >
      <div className="ai-discover-card-head">
        <AiNameAvatar
          avatarUrl={agent.avatarUrl}
          className="ai-discover-card-avatar"
          imageClassName="ai-discover-card-avatar-image"
          name={agent.agentName}
          tone="white"
        />
        <div className="ai-discover-card-heading">
          <div className="ai-discover-card-title" title={agent.agentName}>{agent.agentName}</div>
          <DisplayName className="ai-discover-card-author" userId={agent.creatorUserId} prefix="@" />
        </div>
      </div>
      <p className="ai-discover-card-desc">{agent.description || '暂无描述'}</p>
      <div className="ai-discover-card-footer">
        <span className="ai-discover-card-tag">{formatAgentMeta(agent)}</span>
      </div>
      {/* 对话和更多操作用独立的按钮，菜单里的点击不会触发会话。 */}
      <button
        aria-label={`去对话：${agent.agentName}`}
        className="ai-discover-card-chat"
        disabled={!agent.isActive}
        type="button"
        onClick={onOpenChat}
      />
      {subscription && (
        <Popover
          className="ai-discover-card-menu"
          content={(
            <div aria-label={`${agent.agentName}的操作`} id={menuId} role="group">
              {subscription.value && (
                <button disabled={pending} type="button" onClick={() => runAction(onChangeFavorite, !subscription.isFavorite)}>
                  {subscription.isFavorite ? '取消收藏' : '收藏'}
                </button>
              )}
              <button disabled={pending} type="button" onClick={() => runAction(onChangeSubscription, !subscription.value)}>
                {subscription.value ? '取消订阅' : '订阅'}
              </button>
            </div>
          )}
          destroyOnHide
          getContainer={null}
          placement="top-end"
          trigger="click"
          visible={menuOpen && !pending}
          onVisibleChange={onMenuOpenChange}
        >
          <button
            aria-controls={menuOpen && !pending ? menuId : undefined}
            aria-expanded={menuOpen && !pending}
            aria-label={`更多操作：${agent.agentName}`}
            className="ai-discover-card-more"
            disabled={pending}
            ref={moreRef}
            type="button"
          ><MoreOutline aria-hidden="true" width={18} height={18} /></button>
        </Popover>
      )}
    </article>
  )
}
