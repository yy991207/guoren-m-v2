import { CompassOutline, MessageFill, MessageOutline, RightOutline } from 'antd-mobile-icons'
import { useId } from 'react'
import {
  AiDrawerMenuDiscoverIcon,
  AiDrawerMenuLibraryIcon,
  AiDrawerMenuSkillsIcon,
} from './AiDrawerMenuIcons'
import './AiWorkspaceNavigation.css'

type AiWorkspaceNavigationProps = {
  active: 'task' | 'discover'
  onTask: () => void
  onDiscover: () => void
}

type AiDiscoverHubProps = {
  onOpenDiscover: () => void
  onOpenLibrary: () => void
  onOpenSkills: () => void
}

export function AiWorkspaceNavigation({ active, onTask, onDiscover }: AiWorkspaceNavigationProps) {
  const TaskIcon = active === 'task' ? MessageFill : MessageOutline

  return (
    <nav aria-label="AI 工作区" className="ai-workspace-navigation">
      <button
        aria-current={active === 'task' ? 'page' : undefined}
        className="ai-workspace-navigation__button"
        type="button"
        onClick={onTask}
      >
        <TaskIcon aria-hidden="true" width={22} height={22} />
        <span>任务</span>
      </button>
      <button
        aria-current={active === 'discover' ? 'page' : undefined}
        className="ai-workspace-navigation__button"
        type="button"
        onClick={onDiscover}
      >
        <CompassOutline aria-hidden="true" width={22} height={22} />
        <span>发现</span>
      </button>
    </nav>
  )
}

export function AiDiscoverHub({ onOpenDiscover, onOpenLibrary, onOpenSkills }: AiDiscoverHubProps) {
  const titleId = useId()
  const entries = [
    { label: '发现', Icon: AiDrawerMenuDiscoverIcon, onClick: onOpenDiscover },
    { label: '库', Icon: AiDrawerMenuLibraryIcon, onClick: onOpenLibrary },
    { label: '技能', Icon: AiDrawerMenuSkillsIcon, onClick: onOpenSkills },
  ]

  return (
    <section aria-labelledby={titleId} className="ai-discover-hub">
      <header className="ai-discover-hub__header">
        <h1 id={titleId} className="ai-discover-hub__title">发现</h1>
      </header>
      <div className="ai-discover-hub__content">
        <ul className="ai-discover-hub__list" role="list">
          {entries.map(({ label, Icon, onClick }) => (
            <li key={label}>
              <button className="ai-discover-hub__entry" type="button" onClick={onClick}>
                <span aria-hidden="true" className="ai-discover-hub__icon"><Icon size={20} /></span>
                <span>{label}</span>
                <RightOutline aria-hidden="true" className="ai-discover-hub__arrow" width={14} height={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
