import { DeleteOutline } from 'antd-mobile-icons'
import type { SkillSource, SkillSummaryItem } from '../../../services/skills'
import { getSkillCardTags } from '../utils/skillDisplay'
import { AiCatalogCard, AiCatalogTag } from './AiCatalogCard'
import { AiCatalogCreateButton, AiCatalogGrid, AiCatalogPage } from './AiCatalogPage'
import { AiLoading } from './AiLoading'

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
  category, lists, searchValue, removingId, onSearchChange, onCategoryChange, onOpenDetail, onDelete, onUse, onCreate, onBack,
}: AiSkillsPageProps) {
  const renderList = ({ key, label, empty, loading }: (typeof CATEGORIES)[number]) => {
    const list = lists[key]
    const managed = key === 'added' || key === 'created'
    if (list.loading) return <AiLoading message={loading} variant="page" />
    if (list.error) return <div className="ai-data-status" role="alert">{list.error}</div>
    if (list.items.length === 0) return <div className="ai-data-status">{empty}</div>
    return (
      <AiCatalogGrid>
        {list.items.map(skill => {
          const tags = getSkillCardTags(skill)
          return (
            <AiCatalogCard
              avatarTone="blue"
              busy={managed && removingId === skill.id}
              description={skill.description || '暂无描述'}
              footer={managed ? (
                <button className="ai-catalog-card-action" type="button" onClick={() => onUse(skill)}>立即使用</button>
              ) : <><AiCatalogTag>{label}</AiCatalogTag>{tags.map(tag => <AiCatalogTag key={tag}>{tag}</AiCatalogTag>)}</>}
              key={skill.id}
              open={{ label: `查看技能详情 ${skill.title}`, run: () => onOpenDetail(skill, key) }}
              sideAction={managed ? (
                <button aria-label="删除技能" className="ai-catalog-card-side-action" disabled={removingId === skill.id} type="button" onClick={() => onDelete(skill)}>
                  <DeleteOutline aria-hidden="true" width={18} height={18} />
                </button>
              ) : undefined}
              title={skill.title}
            />
          )
        })}
      </AiCatalogGrid>
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
