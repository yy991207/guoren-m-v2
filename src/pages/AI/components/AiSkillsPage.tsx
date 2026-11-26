import type { SkillSource, SkillSummaryItem } from '../../../services/skills'
import { AiCatalogCreateButton, AiCatalogPage } from './AiCatalogPage'
import { AiLoading } from './AiLoading'
import { AiSkillCard } from './AiSkillCard'

type SkillList = {
  items: SkillSummaryItem[]
  loading: boolean
  error: string
}

type AiSkillsPageProps = {
  category: SkillSource
  lists: Record<SkillSource, SkillList>
  searchValue: string
  removingId: string | null
  addingNames: ReadonlySet<string>
  onAdd: (skill: SkillSummaryItem) => void
  onSearchChange: (value: string) => void
  onCategoryChange: (category: SkillSource) => void
  onOpenDetail: (skill: SkillSummaryItem, category: SkillSource) => void
  onDelete: (skill: SkillSummaryItem) => void
  onUse: (skill: SkillSummaryItem) => void
  onCreate: () => void
  onBack: () => void
}

const CATEGORIES: ReadonlyArray<{ key: SkillSource; label: string; empty: string; loading: string }> = [
  { key: 'official', label: '官方精选', empty: '暂无精选技能', loading: '技能加载中…' },
  { key: 'clawhub', label: 'ClawHub', empty: '暂无 ClawHub 技能', loading: 'ClawHub 技能加载中…' },
  { key: 'added', label: '我添加的', empty: '暂无添加的技能', loading: '我的技能加载中…' },
  { key: 'created', label: '我创建的', empty: '暂无创建的技能', loading: '我的技能加载中…' },
]

export function AiSkillsPage({
  category, lists, searchValue, removingId, addingNames, onAdd, onSearchChange, onCategoryChange, onOpenDetail, onDelete, onUse, onCreate, onBack,
}: AiSkillsPageProps) {
  const renderList = ({ key, empty, loading }: (typeof CATEGORIES)[number]) => {
    const list = lists[key]
    const managed = key === 'added' || key === 'created'
    if (list.loading) return <AiLoading message={loading} variant="page" />
    if (list.error) return <div className="ai-data-status" role="alert">{list.error}</div>
    if (list.items.length === 0) return <div className="ai-data-status">{empty}</div>
    return (
      <div className="ai-skill-list">
        {list.items.map(skill => {
          const selected = managed || skill.isSelected
          return (
            <AiSkillCard
              adding={addingNames.has(skill.skillName || skill.id)}
              key={skill.id}
              management={managed ? { label: key === 'added' ? '移除技能' : '删除技能', run: () => onDelete(skill) } : undefined}
              removing={managed && removingId === skill.id}
              selected={selected}
              skill={skill}
              onAction={() => selected ? onUse(skill) : onAdd({ ...skill, source: key })}
              onOpen={() => onOpenDetail(skill, key)}
            />
          )
        })}
      </div>
    )
  }

  return (
    <AiCatalogPage
      action={<AiCatalogCreateButton label="创建技能" onClick={onCreate} />}
      categories={CATEGORIES.map(tab => ({ ...tab, content: tab.key === category ? renderList(tab) : null }))}
      category={category}
      categoryLabel="技能分类"
      search={{ value: searchValue, placeholder: '搜索技能名称、描述或标签', onChange: onSearchChange }}
      title="技能社区"
      onBack={onBack}
      onCategoryChange={onCategoryChange}
    />
  )
}
