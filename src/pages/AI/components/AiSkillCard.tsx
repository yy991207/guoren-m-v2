import { AddOutline, CheckOutline, DeleteOutline, MessageOutline } from 'antd-mobile-icons'
import type { SkillSummaryItem } from '../../../services/skills'
import { AiLoadingRing } from './AiLoading'
import { AiNameAvatar } from './AiNameAvatar'
import './AiSkillCard.css'

const actionIcons = { add: AddOutline, check: CheckOutline, remove: DeleteOutline, use: MessageOutline }

type CardAction = {
  label: string
  run: () => void
  icon: keyof typeof actionIcons
  disabled?: boolean
  busy?: boolean
}

type CardBodyAction = Omit<CardAction, 'icon'> & {
  icon?: CardAction['icon']
  pressed?: boolean
  current?: boolean
}

type AiSkillCardProps = {
  skill: Pick<SkillSummaryItem, 'title' | 'description' | 'iconUrl'>
  open?: CardBodyAction
  action?: CardAction
  management?: CardAction
  highlighted?: boolean
}

function ActionIcon({ icon, busy }: Pick<CardAction, 'icon' | 'busy'>) {
  const Icon = actionIcons[icon]
  return busy ? <AiLoadingRing /> : <Icon aria-hidden="true" width={17} height={17} />
}

function CardActionButton({ action, subtle = false }: { action: CardAction; subtle?: boolean }) {
  return (
    <button aria-label={action.label} className={`ai-skill-card-action${subtle ? ' is-management' : ''}`} disabled={action.disabled || action.busy} type="button" onClick={action.run}>
      <ActionIcon icon={action.icon} busy={action.busy} />
    </button>
  )
}

export function AiSkillCard({ skill, open, action, management, highlighted }: AiSkillCardProps) {
  return (
    <article aria-busy={Boolean(open?.busy || action?.busy || management?.busy)} aria-label={skill.title} className="ai-skill-card" data-highlighted={highlighted || undefined}>
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
      {open && (
        <button aria-current={open.current} aria-label={open.label} aria-pressed={open.pressed} className="ai-skill-card-open" disabled={open.disabled || open.busy} type="button" onClick={open.run} />
      )}
      {/* 整卡本身可点击时，右侧图标只作提示，不重复增加一个按钮。 */}
      {open?.icon && <span aria-hidden="true" className="ai-skill-card-action ai-skill-card-indicator"><ActionIcon icon={open.icon} busy={open.busy} /></span>}
      {action && <CardActionButton action={action} />}
      {management && <CardActionButton action={management} subtle />}
    </article>
  )
}
