import { CloseOutline } from 'antd-mobile-icons'
import type { SkillSummaryItem, UserSkillGroups } from '../../../services/skills'
import { AiBottomSheet } from './AiBottomSheet'
import { AiLoading } from './AiLoading'
import { AiSearchField } from './AiSearchField'
import { AiSkillCard } from './AiSkillCard'
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

const groups = [['created', '我创建的'], ['added', '我添加的']] as const

export function AiChatSkillPickerSheet({
  skills, searchValue, selectedSkillName, loading, error, onSearchChange, onSelect, onClose,
}: AiChatSkillPickerSheetProps) {
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

      <div className="ai-chat-skill-picker-list">
        {loading ? <AiLoading message="技能加载中…" /> : null}
        {!loading && error && <div className="ai-chat-skill-picker-status" role="status">{error}</div>}
        {!loading && !error && groups.map(([key, label]) => (
          <section aria-label={label} className="ai-chat-skill-picker-group" key={key}>
            <h3>{label}</h3>
            {skills[key].length === 0 ? (
              <div className="ai-chat-skill-picker-status">{searchValue.trim() ? '暂无匹配技能' : '暂无技能'}</div>
            ) : (
              <div className="ai-skill-list">
                {skills[key].map(skill => {
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
            )}
          </section>
        ))}
      </div>
    </AiBottomSheet>
  )
}
