import { useState } from 'react'
import type { CommandApiItem } from '../../../services/commands'
import { AiCatalogCard } from './AiCatalogCard'
import { AiCatalogGrid, AiCatalogPage } from './AiCatalogPage'
import { AiLoading } from './AiLoading'
import { AiScrollScope } from './scrollbars/AiScrollScope'
import './AiCommandsPage.css'

export type AiCommandsPageTabKey = 'best-practice' | 'recommended-prompts' | 'my-prompts'

type AiCommandsPageProps = {
  workspaceScrollbars: boolean
  activeTab: AiCommandsPageTabKey
  bestPractices: CommandApiItem[]
  error: string
  loading: boolean
  myCommands: CommandApiItem[]
  officialCommands: CommandApiItem[]
  onApplyCommand: (command: CommandApiItem) => void
  onBack: () => void
  onTabChange: (tab: AiCommandsPageTabKey) => void
}

const COMMAND_TABS: ReadonlyArray<{ key: AiCommandsPageTabKey; label: string }> = [
  { key: 'best-practice', label: '最佳实践' },
  { key: 'recommended-prompts', label: '推荐指令' },
  { key: 'my-prompts', label: '我的指令' },
]

export default function AiCommandsPage({
  workspaceScrollbars, activeTab, bestPractices, error, loading, myCommands, officialCommands,
  onApplyCommand, onBack, onTabChange,
}: AiCommandsPageProps) {
  const [search, setSearch] = useState('')
  const itemsByTab = { 'best-practice': bestPractices, 'recommended-prompts': officialCommands, 'my-prompts': myCommands }

  const renderCommands = (tab: (typeof COMMAND_TABS)[number]) => {
    if (loading) return <AiLoading message="内容加载中…" variant="page" />
    if (error) return <div className="ai-data-status" role="alert">{error}</div>

    const keyword = search.trim().toLowerCase()
    const items = itemsByTab[tab.key].filter(command => [command.name, command.description].some(value => value?.toLowerCase().includes(keyword)))
    if (!items.length) return <div className="ai-data-status">{keyword ? '未找到匹配的指令' : `暂无${tab.label}`}</div>

    const practice = tab.key === 'best-practice'
    return (
      <AiCatalogGrid>
        {items.map(command => {
          const apply = () => onApplyCommand(command)
          return (
            <AiCatalogCard
              body={(
                <div className="ai-commands-card-body">
                  {command.description && <p className="ai-catalog-card-description">{command.description}</p>}
                  {practice && command.image && <img alt={`${command.name}封面`} className="ai-commands-cover" decoding="async" loading="lazy" src={command.image} />}
                </div>
              )}
              key={command.id}
              open={{ label: `做同款：${command.name}`, run: apply, actionText: '做同款' }}
              showAvatar={false}
              title={command.name}
            />
          )
        })}
      </AiCatalogGrid>
    )
  }

  return (
    <AiScrollScope enabled={workspaceScrollbars} className="ai-commands-page">
      <AiCatalogPage
        backLabel="返回"
        categories={COMMAND_TABS.map(tab => ({ ...tab, content: tab.key === activeTab ? renderCommands(tab) : null }))}
        category={activeTab}
        categoryLabel="指令分类"
        search={{ value: search, placeholder: '搜索指令', onChange: setSearch }}
        title="指令"
        onBack={onBack}
        onCategoryChange={onTabChange}
      />
    </AiScrollScope>
  )
}
