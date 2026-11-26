import { AddOutline, DeleteOutline, MessageOutline } from 'antd-mobile-icons'
import type { SkillSummaryItem } from '../../../services/skills'
import { AiLoadingRing } from './AiLoading'
import { AiNameAvatar } from './AiNameAvatar'
import './AiSkillCard.css'

type AiSkillCardProps = {
  skill: SkillSummaryItem
  selected: boolean
  adding: boolean
  removing: boolean
  management?: { label: string; run: () => void }
  onOpen: () => void
  onAction: () => void
}

export function AiSkillCard({ skill, selected, adding, removing, management, onOpen, onAction }: AiSkillCardProps) {
  const label = selected ? '使用技能' : adding ? '正在添加技能' : '添加技能'
  return (
    <article aria-busy={adding || removing} aria-label={skill.title} className="ai-skill-card">
      <div className="ai-skill-card-main">
        <AiNameAvatar
          ariaLabel={`${skill.title}头像`}
          avatarUrl={skill.iconUrl}
          className="ai-skill-card-avatar"
          fallbackOnError
          imageClassName="ai-skill-card-avatar-image"
          name={skill.title}
          tone="blue"
        />
        <span className="ai-skill-card-copy">
          <span className="ai-skill-card-title" title={skill.title}>{skill.title}</span>
          <span className="ai-skill-card-summary">{skill.description || '暂无描述'}</span>
        </span>
      </div>
      <button aria-label={`查看技能详情 ${skill.title}`} className="ai-skill-card-open" type="button" onClick={onOpen} />
      <button aria-label={`${label} ${skill.title}`} className="ai-skill-card-action" disabled={adding || removing} type="button" onClick={onAction}>
        {adding ? <AiLoadingRing /> : selected ? <MessageOutline aria-hidden="true" width={17} height={17} /> : <AddOutline aria-hidden="true" width={17} height={17} />}
      </button>
      {management && (
        <button aria-label={management.label} className="ai-skill-card-action is-management" disabled={removing} type="button" onClick={management.run}>
          <DeleteOutline aria-hidden="true" width={17} height={17} />
        </button>
      )}
    </article>
  )
}
