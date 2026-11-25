import { MessageFill, MessageOutline } from 'antd-mobile-icons'
import {
  AiDrawerMenuDiscoverIcon,
  AiDrawerMenuLibraryIcon,
  AiDrawerMenuSkillsIcon,
} from './AiDrawerMenuIcons'
import './AiWorkspaceNavigation.css'

const entries = [
  { key: 'task', label: '任务' },
  { key: 'agents', label: '智能体', Icon: AiDrawerMenuDiscoverIcon },
  { key: 'library', label: '库', Icon: AiDrawerMenuLibraryIcon },
  { key: 'skills', label: '技能', Icon: AiDrawerMenuSkillsIcon },
] as const

export type AiWorkspaceTab = typeof entries[number]['key']

type AiWorkspaceNavigationProps = {
  active: AiWorkspaceTab
  onNavigate: (tab: AiWorkspaceTab) => void
}

export function AiWorkspaceNavigation({ active, onNavigate }: AiWorkspaceNavigationProps) {
  const TaskIcon = active === 'task' ? MessageFill : MessageOutline

  return (
    <nav aria-label="AI 工作区" className="ai-workspace-navigation">
      {entries.map((entry) => (
        <button
          aria-current={active === entry.key ? 'page' : undefined}
          className="ai-workspace-navigation__button"
          key={entry.key}
          type="button"
          onClick={() => { if (entry.key !== active) onNavigate(entry.key) }}
        >
          <span aria-hidden="true" className="ai-workspace-navigation__icon">
            {entry.key === 'task' ? <TaskIcon width={22} height={22} /> : <entry.Icon size={22} filled={active === entry.key} />}
          </span>
          <span>{entry.label}</span>
        </button>
      ))}
    </nav>
  )
}
