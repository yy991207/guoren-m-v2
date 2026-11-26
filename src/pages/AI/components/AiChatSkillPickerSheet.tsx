import { CloseOutline } from 'antd-mobile-icons'
import { useState } from 'react'
import type { SkillSummaryItem, UserSkillGroups } from '../../../services/skills'
import { filterSkillItems } from '../utils/skillDisplay'
import { AiBottomSheet } from './AiBottomSheet'
import { AiLoading } from './AiLoading'
import { AiSearchField } from './AiSearchField'
import { AiSkillCard } from './AiSkillCard'
import { AiSectionTabs } from './AiSectionTabs'
import './AiChatSkillPickerSheet.css'

type AiChatSkillPickerSheetProps = {
  skills: UserSkillGroups
  searchValue: string
  selectedSkillName: string | null
  loading: boolean
  error: string
  onSearchChange: (value: string) => void
  onSelect: (skill: SkillSummaryItem) => void
  onClose: () => void
}

const categories = [{ key: 'added', label: '我添加的' }, { key: 'created', label: '我创建的' }] as const

export function AiChatSkillPickerSheet({
  skills, searchValue, selectedSkillName, loading, error, onSearchChange, onSelect, onClose,
}: AiChatSkillPickerSheetProps) {
  const [category, setCategory] = useState<keyof UserSkillGroups>('added')
  const visibleSkills = filterSkillItems(skills[category], searchValue)

  const renderSkills = () => {
    if (loading) return <AiLoading fill message="技能加载中…" />
    if (error) return <div className="ai-chat-skill-picker-status" role="status">{error}</div>
    if (!visibleSkills.length) {
      return <div className="ai-chat-skill-picker-status">{searchValue.trim() ? '暂无匹配技能' : '暂无技能'}</div>
    }
    return (
      <div className="ai-skill-list">
        {visibleSkills.map(skill => {
          const current = selectedSkillName === (skill.skillName || skill.id)
          return (
            <AiSkillCard
              highlighted={current}
              key={skill.id}
              open={{ label: `选择技能 ${skill.title}`, icon: 'use', current: current || undefined, run: () => onSelect(skill) }}
              skill={skill}
            />
          )
        })}
      </div>
    )
  }

  return (
    <AiBottomSheet className="ai-chat-skill-picker-sheet" label="选择技能" nativeModal onClose={onClose}>
      <div className="ai-chat-skill-picker-toolbar">
        <div className="ai-chat-skill-picker-header">
          <h2 className="ai-chat-skill-picker-title">选择技能</h2>
          <button aria-label="关闭技能选择" className="ai-chat-skill-picker-close" type="button" onClick={onClose}>
            <CloseOutline aria-hidden="true" width={16} height={16} />
          </button>
        </div>
        <AiSearchField label="搜索可用技能" placeholder="搜索" value={searchValue} onChange={onSearchChange} />
      </div>

      <div className="ai-skill-picker-tabs ai-chat-skill-picker-results">
        <AiSectionTabs
          label="技能分类"
          value={category}
          variant="picker"
          tabs={categories.map(tab => ({ ...tab, content: tab.key === category ? renderSkills() : null }))}
          onChange={setCategory}
        />
      </div>
    </AiBottomSheet>
  )
}
