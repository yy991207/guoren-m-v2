import { FileOutline, RightOutline, SearchOutline, VideoOutline } from 'antd-mobile-icons'
import { type ReactNode, useId } from 'react'
import type { CommandPromptItem } from '../../../services/commands'
import './AiWorkspaceWelcome.css'

type AiWorkspaceWelcomeProps = {
  children: ReactNode
  items: readonly CommandPromptItem[]
  onApply: (item: CommandPromptItem) => void
  onOpenAll: () => void
}

function ScreenOutline() {
  return (
    <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M12 17v3m-4 0h8" />
    </svg>
  )
}

// 图标按位置展示，推荐内容和顺序仍完全由最佳实践列表决定。
const recommendationIcons = [ScreenOutline, VideoOutline, SearchOutline, FileOutline]

export function AiWorkspaceWelcome({ children, items, onApply, onOpenAll }: AiWorkspaceWelcomeProps) {
  const titleId = useId()
  const recommendations = items.slice(0, recommendationIcons.length)

  return (
    <section aria-labelledby={titleId} className="ai-workspace-welcome">
      <div className="ai-workspace-welcome__content">
        <h1 id={titleId} className="ai-workspace-welcome__title">{children}</h1>
        {recommendations.length > 0 && (
          <ul className="ai-workspace-welcome__list" role="list">
            {recommendations.map((item, index) => {
              const Icon = recommendationIcons[index]
              return (
                <li key={item.id}>
                  <button className="ai-workspace-welcome__button" type="button" onClick={() => onApply(item)}>
                    <Icon aria-hidden="true" width={16} height={16} />
                    <span className="ai-workspace-welcome__label">{item.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <button className="ai-workspace-welcome__button ai-workspace-welcome__button--all" type="button" onClick={onOpenAll}>
          <span className="ai-workspace-welcome__label">全部最佳实践</span>
          <RightOutline aria-hidden="true" width={12} height={12} />
        </button>
      </div>
    </section>
  )
}
