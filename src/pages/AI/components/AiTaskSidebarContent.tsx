import { useId } from 'react'
import { AddCircleOutline } from 'antd-mobile-icons'
import type { ChatSession } from '../../../services/chat/types'
import { AiDrawerSessionGroup } from './AiDrawerSessionGroup'
import './AiTaskSidebarContent.css'

type AiTaskSidebarContentProps = {
  groups: {
    today: ChatSession[]
    within7Days: ChatSession[]
    beyond7Days: ChatSession[]
  }
  activeSessionId: string | null
  removingSessionIds: Set<string>
  isLoading: boolean
  tasksExpanded: boolean
  onTasksExpandedChange: (expanded: boolean) => void
  onNewTask: () => void
  onOpenSession: (sessionId: string) => void
}

export function AiTaskSidebarContent({
  groups,
  activeSessionId,
  removingSessionIds,
  isLoading,
  tasksExpanded,
  onTasksExpandedChange,
  onNewTask,
  onOpenSession,
}: AiTaskSidebarContentProps) {
  const tasksId = useId()
  const toggleId = `${tasksId}-toggle`
  const hasSessions = groups.today.length > 0
    || groups.within7Days.length > 0
    || groups.beyond7Days.length > 0

  return (
    <div className="ai-task-sidebar-content">
      <button className="ai-task-sidebar-content__new" type="button" onClick={onNewTask}>
        <AddCircleOutline aria-hidden="true" fontSize={18} />
        <span>新建任务</span>
      </button>

      <button
        aria-controls={tasksId}
        aria-expanded={tasksExpanded}
        className="ai-task-sidebar-content__toggle"
        id={toggleId}
        type="button"
        onClick={() => onTasksExpandedChange(!tasksExpanded)}
      >
        <span>任务</span>
        <svg className="ai-task-sidebar-content__chevron" aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {/* 只隐藏历史区，不卸载会话行，收起后再展开仍保留列表的滚动位置。 */}
      <div
        aria-busy={isLoading}
        aria-labelledby={toggleId}
        className="ai-task-sidebar-content__history"
        hidden={!tasksExpanded}
        id={tasksId}
        role="region"
      >
        {isLoading ? (
          <div className="ai-task-sidebar-content__empty" role="status">正在刷新会话…</div>
        ) : !hasSessions ? (
          <div className="ai-task-sidebar-content__empty" role="status">还没有历史会话</div>
        ) : (
          <>
            <AiDrawerSessionGroup
              activeSessionId={activeSessionId}
              items={groups.today}
              removingSessionIds={removingSessionIds}
              title="今天"
              onOpenSession={onOpenSession}
            />
            <AiDrawerSessionGroup
              activeSessionId={activeSessionId}
              items={groups.within7Days}
              removingSessionIds={removingSessionIds}
              title="7天内"
              onOpenSession={onOpenSession}
            />
            <AiDrawerSessionGroup
              activeSessionId={activeSessionId}
              items={groups.beyond7Days}
              removingSessionIds={removingSessionIds}
              title="7天外"
              onOpenSession={onOpenSession}
            />
          </>
        )}
      </div>
    </div>
  )
}
