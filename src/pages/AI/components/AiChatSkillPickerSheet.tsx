import { CloseOutline } from 'antd-mobile-icons'
import type { SkillSummaryItem } from '../../../services/skills'
import { getSkillCardTags } from '../utils/skillDisplay'
import { AiBottomSheet } from './AiBottomSheet'
import { AiLoading } from './AiLoading'
import { AiNameAvatar } from './AiNameAvatar'
import { AiSearchField } from './AiSearchField'
import './AiChatSkillPickerSheet.css'

type AiChatSkillPickerSheetProps = {
  skills: SkillSummaryItem[]
  searchValue: string
  selectedSkillName: string | null
  loading: boolean
  error: string
  onSearchChange: (value: string) => void
  onSelect: (skill: SkillSummaryItem) => void
  onClose: () => void
}

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
        {!loading && (error || !skills.length) ? <div className="ai-chat-skill-picker-status" role="status">{error || '暂无可用技能'}</div> : null}
        {!loading && !error && skills.map(skill => {
          const name = skill.skillName || skill.id
          const tags = getSkillCardTags(skill)
          const isActive = selectedSkillName === name

          return (
            <button
              aria-current={isActive || undefined}
              className={`ai-chat-skill-picker-item${isActive ? ' is-active' : ''}`}
              key={skill.id}
              type="button"
              onClick={() => onSelect(skill)}
            >
              <AiNameAvatar
                ariaLabel={`${skill.title}头像`}
                className="ai-chat-skill-picker-item-icon"
                imageClassName="ai-chat-skill-picker-item-icon-image"
                name={skill.title}
                tone="blue"
              />
              <span className="ai-chat-skill-picker-item-body">
                <span className="ai-chat-skill-picker-item-top">
                  <span className="ai-chat-skill-picker-item-title">{skill.title}</span>
                  {tags.length > 0 && (
                    <span className="ai-chat-skill-picker-item-tags">
                      {tags.map(tag => <span className="ai-chat-skill-picker-item-tag" key={`${skill.id}-${tag}`}>{tag}</span>)}
                    </span>
                  )}
                </span>
                <span className="ai-chat-skill-picker-item-name">{name}</span>
                <span className="ai-chat-skill-picker-item-desc">{skill.description || '暂无描述'}</span>
              </span>
            </button>
          )
        })}
      </div>
    </AiBottomSheet>
  )
}
