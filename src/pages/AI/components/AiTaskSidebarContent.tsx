import { useId, useLayoutEffect, useMemo, useRef } from 'react'
import { AddCircleOutline } from 'antd-mobile-icons'
import type { GroupedChatSessions } from '../../../services/chat/session'
import { useAiBatchDelete } from '../hooks/useAiBatchDelete'
import { AiBatchDeleteFooter, AiBatchSelectionBar } from './AiBatchDeleteControls'
import { AiDrawerSessionGroup } from './AiDrawerSessionGroup'
import { AiLoading } from './AiLoading'
import { AiDeleteConfirmDialog } from './AiDeleteConfirmDialog'
import './AiTaskSidebarContent.css'

type AiTaskSidebarContentProps = {
  groups: GroupedChatSessions
  open: boolean
  activeSessionId: string | null
  removingSessionIds: Set<string>
  isLoading: boolean
  tasksExpanded: boolean
  onTasksExpandedChange: (expanded: boolean) => void
  onNewTask: () => void
  onOpenSession: (sessionId: string) => void
  onRemoveOne: (sessionId: string, signal: AbortSignal) => Promise<void>
  onRefresh: (signal: AbortSignal) => Promise<boolean>
}

const sections = [['today', '今天'], ['within7Days', '7天内'], ['beyond7Days', '7天外']] as const
const MAX_SESSION_BATCH = 50
const deletionMessages = {
  limitNotice: `每次最多选择 ${MAX_SESSION_BATCH} 条对话，请分批删除。`,
  removeError: '删除会话失败',
  partialFailure: (done: number, total: number, reason: string) => `已停止：已删除 ${done} / ${total} 条。${reason}，其余对话仍保持勾选。`,
  refreshError: '会话列表刷新失败。',
}

export function AiTaskSidebarContent({
  groups, open, activeSessionId, removingSessionIds, isLoading, tasksExpanded,
  onTasksExpandedChange, onNewTask, onOpenSession, onRemoveOne, onRefresh,
}: AiTaskSidebarContentProps) {
  const tasksId = useId()
  const toggleId = `${tasksId}-toggle`
  const hasSessions = sections.some(([key]) => groups[key].length > 0)
  const availableIds = useMemo(() => sections.flatMap(([key]) => groups[key].map((s) => s.session_id))
    .filter((id) => !removingSessionIds.has(id)), [groups, removingSessionIds])
  const selection = useAiBatchDelete({
    enabled: open, availableIds, maxSelection: MAX_SESSION_BATCH, messages: deletionMessages,
    removeOne: onRemoveOne, refresh: onRefresh,
  })
  const { selecting, selected, allSelected, notice, batch } = selection
  const manageRef = useRef<HTMLButtonElement>(null)
  const selectAllRef = useRef<HTMLButtonElement>(null)
  const newRef = useRef<HTMLButtonElement>(null)
  const lastMode = useRef(selecting)
  useLayoutEffect(() => {
    if (open && lastMode.current !== selecting) {
      const target = selecting ? selectAllRef.current : (manageRef.current?.disabled ? newRef.current : manageRef.current)
      target?.focus({ preventScroll: true })
    }
    lastMode.current = selecting
  }, [open, selecting])

  return (
    <div className="ai-task-sidebar-content">
      {selecting ? (
        <AiBatchSelectionBar
          allSelected={allSelected}
          disabled={isLoading || !availableIds.length}
          selectedCount={selected.size}
          selectAllRef={selectAllRef}
          onCancel={() => selection.changeMode(false)}
          onToggleAll={selection.toggleAll}
        />
      ) : (
        <button className="ai-task-sidebar-content__new" ref={newRef} type="button" onClick={onNewTask}>
          <AddCircleOutline aria-hidden="true" fontSize={18} /><span>新建任务</span>
        </button>
      )}
      <div className="ai-task-section-heading">
        <button aria-controls={tasksId} aria-expanded={tasksExpanded} className="ai-task-sidebar-content__toggle" id={toggleId} type="button" onClick={() => onTasksExpandedChange(!tasksExpanded)}>
          <span>任务</span>
          <svg className="ai-task-sidebar-content__chevron" aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
        </button>
        {!selecting && (
          <button
            aria-label="多选对话" className="ai-task-manage" disabled={isLoading || !availableIds.length} ref={manageRef} type="button"
            onClick={() => { if (!tasksExpanded) onTasksExpandedChange(true); selection.changeMode(true) }}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 6 1.5 1.5L7 4.5M10 6h10M3 12l1.5 1.5L7 10.5M10 12h10M3 18l1.5 1.5L7 16.5M10 18h10" />
            </svg>
          </button>
        )}
      </div>
      {/* 折叠只隐藏历史区，不卸载节点，因此列表滚动位置保持不变。 */}
      <div aria-busy={isLoading} aria-labelledby={toggleId} className="ai-task-sidebar-content__history" hidden={!tasksExpanded} id={tasksId} role="region">
        {isLoading ? (
          <AiLoading fill message="正在刷新会话…" />
        ) : !hasSessions ? (
          <div className="ai-task-sidebar-content__empty" role="status">还没有历史会话</div>
        ) : sections.map(([key, title]) => (
          <AiDrawerSessionGroup key={key} activeSessionId={activeSessionId} items={groups[key]} removingSessionIds={removingSessionIds}
            selection={selecting ? selection : undefined} title={title} onOpenSession={onOpenSession} />
        ))}
      </div>
      <AiBatchDeleteFooter deleteLabel="删除对话" disabled={!selected.size || isLoading} notice={notice} onDelete={selecting ? selection.askDelete : undefined} />
      {open && batch && (
        <AiDeleteConfirmDialog
          title={`删除选中的 ${batch.ids.length} 条对话？`}
          pending={batch.running ? {
            title: '正在删除对话',
            message: `已删除 ${batch.done} / ${batch.ids.length} 条`,
            progress: { done: batch.done, total: batch.ids.length },
          } : undefined}
          onCancel={selection.cancelConfirm}
          onConfirm={selection.confirmDelete}
        />
      )}
    </div>
  )
}
