import { useEffect, useMemo, useState } from 'react'
import type { AgentCategoryKey, DiscoverAgentItem } from '../../../services/agents'
import { useDisplayNamePrefetch } from '../../IM/utils/displayNameHooks'
import { AiDiscoverAgentCard } from './AiDiscoverAgentCard'
import { AiDiscoverFavorites } from './AiDiscoverFavorites'
import { AiCatalogCreateButton, AiCatalogGrid, AiCatalogPage } from './AiCatalogPage'
import { AiLoading } from './AiLoading'

type DiscoverCategoryKey = 'all' | AgentCategoryKey
type DiscoverSection<Key extends DiscoverCategoryKey = DiscoverCategoryKey> = { key: Key; title: string; items: DiscoverAgentItem[] }

type AiDiscoverPageProps = {
  allAgents: DiscoverAgentItem[]
  discoverLoading: boolean
  discoverError: string
  discoverSections: DiscoverSection<AgentCategoryKey>[]
  favoriteAgents: DiscoverAgentItem[]
  pendingAgentIds: ReadonlySet<string>
  onChangeSubscription: (agentId: string, isSubscribed: boolean) => void
  onChangeFavorite: (agentId: string, isFavorite: boolean) => void
  onOpenAgentChat: (agent: DiscoverAgentItem) => void
  onOpenCreateAgent: () => void
  onBack: () => void
}

const CATEGORY_LABELS: Record<DiscoverCategoryKey, string> = {
  all: '全部', subscribed: '订阅', official: '官方', enterprise: '企业', collaboration: '共创', mine: '我的',
}

const DISCOVER_SECTION_EMPTY_TEXT: Record<DiscoverCategoryKey, string> = {
  all: '暂无可展示的智能体',
  subscribed: '暂无订阅的智能体',
  official: '暂无官方智能体',
  enterprise: '暂无企业智能体',
  collaboration: '暂无共创智能体',
  mine: '暂无我的智能体',
}

function filterDiscoverAgents(agents: DiscoverAgentItem[], keyword: string): DiscoverAgentItem[] {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) return agents

  return agents.filter(agent => (
    agent.agentName.toLowerCase().includes(normalizedKeyword) ||
    agent.description.toLowerCase().includes(normalizedKeyword)
  ))
}

export function AiDiscoverPage({
  allAgents,
  discoverLoading,
  discoverError,
  discoverSections,
  favoriteAgents,
  pendingAgentIds,
  onChangeSubscription,
  onChangeFavorite,
  onOpenAgentChat,
  onOpenCreateAgent,
  onBack,
}: AiDiscoverPageProps) {
  const [searchValue, setSearchValue] = useState('')
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null)
  const [category, setCategory] = useState<DiscoverCategoryKey>('all')
  const filteredSections = useMemo(() => {
    // 「全部」直接用已去重的可见列表，不能拼接互相重叠的分类。
    const sections: DiscoverSection[] = [{ key: 'all', title: CATEGORY_LABELS.all, items: allAgents }, ...discoverSections]
    return sections.map(section => ({ ...section, items: filterDiscoverAgents(section.items, searchValue) }))
  }, [allAgents, discoverSections, searchValue])
  const filteredFavorites = useMemo(() => filterDiscoverAgents(favoriteAgents, searchValue), [favoriteAgents, searchValue])

  const allCreatorIds = useMemo(
    () => [...new Set(filteredSections[0].items.map(agent => agent.creatorUserId))],
    [filteredSections],
  )
  useDisplayNamePrefetch(allCreatorIds)

  const sectionLengthSignature = `${searchValue.trim()}|${filteredSections.map(section => `${section.key}:${section.items.length}`).join('|')}`
  useEffect(() => {
    setOpenMenuKey(null)
  }, [sectionLengthSignature])

  const renderSection = (section: DiscoverSection) => {
    if (discoverLoading) return <AiLoading fill message="智能体列表加载中…" variant="page" />
    if (discoverError) return <div className="ai-data-status" role="alert">{discoverError}</div>
    if (!section.items.length) return <div className="ai-discover-empty-state">{DISCOVER_SECTION_EMPTY_TEXT[section.key]}</div>
    return (
      <AiCatalogGrid>
        {section.items.map(agent => {
          const menuKey = `${section.key}:${agent.agentId}`
          return (
            <AiDiscoverAgentCard
              key={agent.agentId}
              agent={agent}
              pending={pendingAgentIds.has(agent.agentId)}
              menuOpen={openMenuKey === menuKey}
              onMenuOpenChange={open => {
                // 同一智能体可能在多个分类里，只展开点击的实例。
                setOpenMenuKey(current => open ? menuKey : current === menuKey ? null : current)
              }}
              onChangeSubscription={value => onChangeSubscription(agent.agentId, value)}
              onChangeFavorite={value => onChangeFavorite(agent.agentId, value)}
              onOpenChat={() => onOpenAgentChat(agent)}
            />
          )
        })}
      </AiCatalogGrid>
    )
  }

  return (
    <AiCatalogPage
      action={<AiCatalogCreateButton label="创建智能体" onClick={onOpenCreateAgent} />}
      beforeCategories={!discoverLoading && !discoverError && <AiDiscoverFavorites agents={filteredFavorites} onOpenAgentChat={onOpenAgentChat} />}
      categories={filteredSections.map(section => ({
        key: section.key,
        label: CATEGORY_LABELS[section.key],
        content: section.key === category ? renderSection(section) : null,
      }))}
      category={category}
      categoryLabel="智能体分类"
      search={{ placeholder: '搜索智能体', value: searchValue, onChange: setSearchValue }}
      title="智能体"
      onBack={onBack}
      onCategoryChange={next => {
        setOpenMenuKey(null)
        setCategory(next)
      }}
    />
  )
}
