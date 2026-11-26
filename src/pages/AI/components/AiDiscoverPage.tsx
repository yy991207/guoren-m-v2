import { useEffect, useMemo, useState } from 'react'

import type { AgentCategoryKey, AgentSavedKey, DiscoverAgentItem } from '../../../services/agents'
import DisplayName from '../../../components/DisplayName'
import { useDisplayNamePrefetch } from '../../IM/utils/displayNameHooks'
import { AiNameAvatar, type AiNameAvatarTone } from './AiNameAvatar'
import { AiDiscoverHeader } from './AiDiscoverHeader'
import { AiSearchField } from './AiSearchField'
import { AiSectionTabs } from './AiSectionTabs'

type DiscoverSection<Key extends string> = { key: Key; title: string; items: DiscoverAgentItem[] }
type DiscoverSectionKey = AgentCategoryKey | AgentSavedKey

type AiDiscoverPageProps = {
  discoverLoading: boolean
  discoverError: string
  discoverSections: Array<DiscoverSection<AgentCategoryKey>>
  savedAgents: Record<AgentSavedKey, DiscoverAgentItem[]>
  pendingAgentIds: ReadonlySet<string>
  onChangeSubscription: (agentId: string, isSubscribed: boolean) => void
  onChangeFavorite: (agentId: string, isFavorite: boolean) => void
  onOpenAgentChat: (agent: DiscoverAgentItem) => void
  onOpenCreateAgent: () => void
  onBack: () => void
}

export const AI_DISCOVER_CATEGORY_PAGE_SIZE = 5

const SAVED_TABS = [
  { key: 'favorite', title: '收藏' },
  { key: 'subscribed', title: '订阅' },
] as const

const DISCOVER_SECTION_EMPTY_TEXT: Record<DiscoverSectionKey, string> = {
  official: '暂无官方智能体',
  enterprise: '暂无企业智能体',
  collaboration: '暂无共创智能体',
  mine: '暂无我的智能体',
  favorite: '暂无收藏的智能体',
  subscribed: '暂无订阅的智能体',
}

function createInitialCategoryPages(): Record<DiscoverSectionKey, number> {
  return {
    official: 0,
    enterprise: 0,
    collaboration: 0,
    mine: 0,
    favorite: 0,
    subscribed: 0,
  }
}

function formatAgentMeta(agent: DiscoverAgentItem): string {
  if (agent.publishScope === 'specified') {
    return '协作'
  }

  if (agent.tenantId === null) {
    return '官方'
  }

  return '企业'
}

function DiscoverAgentCard({
  agent,
  tone,
  pending,
  onOpenChat,
  onChangeSubscription,
  onChangeFavorite,
}: {
  agent: DiscoverAgentItem
  tone: AiNameAvatarTone
  pending: boolean
  onOpenChat: () => void
  onChangeSubscription: (isSubscribed: boolean) => void
  onChangeFavorite: (isFavorite: boolean) => void
}) {
  const subscription = agent.subscription

  return (
    <article aria-label={agent.agentName} className="ai-discover-card">
      <AiNameAvatar
        ariaLabel={`${agent.agentName}头像`}
        avatarUrl={agent.avatarUrl}
        className="ai-discover-card-avatar"
        imageClassName="ai-discover-card-avatar-image"
        name={agent.agentName}
        tone={tone}
      />
      <div className="ai-discover-card-body">
        <div className="ai-discover-card-title">{agent.agentName}</div>
        <div className="ai-discover-card-desc">{agent.description || '暂无描述'}</div>
        <div className="ai-discover-card-meta">
          <DisplayName userId={agent.creatorUserId} prefix="@" />
          <span className="ai-discover-card-chats">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {formatAgentMeta(agent)}
          </span>
        </div>
      </div>
      <div aria-busy={pending} className="ai-discover-card-actions">
        {subscription?.value === true && (
          <button className="ai-discover-card-action" disabled={pending} type="button" onClick={() => onChangeFavorite(!subscription.isFavorite)}>
            {subscription.isFavorite ? '取消收藏' : '收藏'}
          </button>
        )}
        {subscription && (
          <button className="ai-discover-card-action" disabled={pending} type="button" onClick={() => onChangeSubscription(!subscription.value)}>
            {subscription.value ? '取消订阅' : '订阅'}
          </button>
        )}
        <button className="ai-discover-card-action is-primary" disabled={!agent.isActive} type="button" onClick={onOpenChat}>去对话</button>
      </div>
    </article>
  )
}

function getCategoryTotalPages(agents: DiscoverAgentItem[]): number {
  return Math.max(1, Math.ceil(agents.length / AI_DISCOVER_CATEGORY_PAGE_SIZE))
}

function filterDiscoverAgents(agents: DiscoverAgentItem[], keyword: string): DiscoverAgentItem[] {
  const normalizedKeyword = keyword.trim().toLowerCase()

  if (!normalizedKeyword) {
    return agents
  }

  return agents.filter((agent) => (
    agent.agentName.toLowerCase().includes(normalizedKeyword) ||
    agent.description.toLowerCase().includes(normalizedKeyword)
  ))
}

export function AiDiscoverPage({
  discoverLoading,
  discoverError,
  discoverSections,
  savedAgents,
  pendingAgentIds,
  onChangeSubscription,
  onChangeFavorite,
  onOpenAgentChat,
  onOpenCreateAgent,
  onBack,
}: AiDiscoverPageProps) {
  const [searchValue, setSearchValue] = useState('')
  const [savedTab, setSavedTab] = useState<AgentSavedKey>('favorite')
  const [categoryPages, setCategoryPages] = useState(createInitialCategoryPages)
  const filteredDiscoverSections = useMemo(() => (
    discoverSections.map((section) => ({
      ...section,
      items: filterDiscoverAgents(section.items, searchValue),
    }))
  ), [discoverSections, searchValue])

  const savedSections = useMemo(() => SAVED_TABS.map(tab => ({
    ...tab,
    items: filterDiscoverAgents(savedAgents[tab.key], searchValue),
  })), [savedAgents, searchValue])

  const allCreatorIds = useMemo(
    () => [...new Set([...filteredDiscoverSections, ...savedSections].flatMap((section) => section.items.map((agent) => agent.creatorUserId)))],
    [filteredDiscoverSections, savedSections],
  )
  useDisplayNamePrefetch(allCreatorIds)

  const sectionLengthSignature = useMemo(
    () => `${searchValue.trim()}|${filteredDiscoverSections.map((section) => `${section.key}:${section.items.length}`).join('|')}`,
    [filteredDiscoverSections, searchValue],
  )

  useEffect(() => {
    // 分类结果变化后统一回到第一页，避免切换到空页。
    setCategoryPages(createInitialCategoryPages())
  }, [sectionLengthSignature])

  const renderSection = (section: DiscoverSection<DiscoverSectionKey>, showTitle: boolean) => {
    const totalPages = getCategoryTotalPages(section.items)
    const currentPage = Math.min(categoryPages[section.key], totalPages - 1)
    const start = currentPage * AI_DISCOVER_CATEGORY_PAGE_SIZE
    const currentAgents = section.items.slice(start, start + AI_DISCOVER_CATEGORY_PAGE_SIZE)
    const goToPage = (page: number) => setCategoryPages(current => ({ ...current, [section.key]: page }))

    return (
      <section aria-label={showTitle ? section.title : undefined} className="ai-discover-section" key={section.key}>
        {(showTitle || totalPages > 1) && (
          <div className="ai-discover-section-header">
            {showTitle && <div className="ai-discover-section-title">{section.title}</div>}
            <div className="ai-discover-section-switch">
              <button
                aria-label={`${section.title}上一页`}
                className="ai-discover-section-switch-btn is-emphasis"
                disabled={currentPage === 0}
                type="button"
                onClick={() => goToPage(currentPage - 1)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                aria-label={`${section.title}下一页`}
                className="ai-discover-section-switch-btn is-emphasis"
                disabled={currentPage >= totalPages - 1}
                type="button"
                onClick={() => goToPage(currentPage + 1)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="ai-discover-list">
          {currentAgents.length > 0 ? currentAgents.map((agent) => (
            <DiscoverAgentCard
              key={agent.agentId}
              agent={agent}
              tone="white"
              pending={pendingAgentIds.has(agent.agentId)}
              onChangeSubscription={value => onChangeSubscription(agent.agentId, value)}
              onChangeFavorite={value => onChangeFavorite(agent.agentId, value)}
              onOpenChat={() => onOpenAgentChat(agent)}
            />
          )) : <div className="ai-discover-empty-state">{DISCOVER_SECTION_EMPTY_TEXT[section.key]}</div>}
        </div>
      </section>
    )
  }

  const status = discoverLoading
    ? <div className="ai-data-status" role="status">智能体列表加载中…</div>
    : discoverError ? <div className="ai-data-status" role="alert">{discoverError}</div> : null

  return (
    <div className="ai-discover-page">
      <AiDiscoverHeader onBack={onBack} />

      <div className="ai-discover-content">
        <div className="ai-discover-actions">
          <AiSearchField className="ai-discover-search" placeholder="搜索智能体" value={searchValue} onChange={setSearchValue} />

          <button className="ai-discover-create-btn" type="button" onClick={onOpenCreateAgent}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            创建智能体
          </button>
        </div>

        <div className="ai-discover-saved">
          <AiSectionTabs
            label="收藏和订阅"
            tabs={savedSections.map(section => ({ key: section.key, label: section.title, content: status ?? renderSection(section, false) }))}
            value={savedTab}
            onChange={setSavedTab}
          />
        </div>
        {!status && filteredDiscoverSections.map(section => renderSection(section, true))}
      </div>
    </div>
  )
}
