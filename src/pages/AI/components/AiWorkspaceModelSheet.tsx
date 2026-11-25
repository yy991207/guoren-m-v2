import { useId, useLayoutEffect, useRef } from 'react'
import { CheckOutline, CloseOutline } from 'antd-mobile-icons'
import type { ChatModelControls } from '../hooks/useWorkspaceChatModels'
import { AiThinkingLevelControl } from './AiThinkingLevelControl'
import './AiWorkspaceModelSheet.css'

type Props = {
  mode: 'model' | 'thinking'
  controls: ChatModelControls
  onClose: () => void
}

export function AiWorkspaceModelSheet({ mode, controls, onClose }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const title = mode === 'model' ? '选择模型' : '思考强度'
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const option = (id: string | null, name: string, description?: string) => (
    <button key={id === null ? 'auto' : `model:${id}`} aria-selected={controls.model === id} className="ai-workspace-model-sheet__option" role="option" type="button"
      onClick={() => { controls.selectModel(id); onClose() }}>
      <span className="ai-workspace-model-sheet__label"><strong>{name}</strong>{description && <small>{description}</small>}</span>
      {controls.model === id && <CheckOutline aria-hidden="true" className="ai-workspace-model-sheet__check" width={18} height={18} />}
    </button>
  )

  return (
    <dialog aria-labelledby={titleId} className="ai-workspace-model-sheet" ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="ai-workspace-model-sheet__content">
        <div aria-hidden="true" className="ai-workspace-model-sheet__handle" />
        <div className="ai-workspace-model-sheet__header">
          <h2 id={titleId}>{title}</h2>
          <button aria-label={mode === 'model' ? '关闭模型选择' : '关闭思考强度'} className="ai-workspace-model-sheet__close" type="button" onClick={onClose}>
            <CloseOutline aria-hidden="true" width={18} height={18} />
          </button>
        </div>
        {mode === 'model' ? (
          <>
            <div role="listbox" aria-label="可用模型">
              {option(null, 'Auto', controls.defaultItem ? `使用 ${controls.defaultItem.display_name} 模型` : '使用默认模型')}
              {!controls.loading && !controls.error && controls.models.map((item) => option(item.model, item.display_name))}
            </div>
            {controls.loading && <p role="status">模型列表加载中…</p>}
            {!controls.loading && controls.error && <div className="ai-model-load-error" role="alert">{controls.error}<button type="button" onClick={() => void controls.reload()}>重新加载</button></div>}
          </>
        ) : (
          <AiThinkingLevelControl modelName={controls.item?.display_name ?? ''} levels={controls.levels} value={controls.thinkingLevel} onSelect={controls.selectLevel} />
        )}
      </div>
    </dialog>
  )
}
