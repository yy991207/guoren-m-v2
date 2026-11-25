import { useRef, useState, type CSSProperties } from 'react'
import { levelLabels } from '../../../services/chat/models'
import type { ChatThinkingLevel } from '../../../services/chat/types'

type Props = {
  modelName: string
  levels: ChatThinkingLevel[]
  value: ChatThinkingLevel | null
  onSelect: (level: ChatThinkingLevel) => void
}

export function AiThinkingLevelControl({ modelName, levels, value, onSelect }: Props) {
  const dragPointer = useRef<number | null>(null)
  const [preview, setPreview] = useState<number | null>(null)
  if (!levels.length) return null
  const single = levels.length === 1
  const index = single ? 0 : preview ?? (value ? levels.indexOf(value) : -1)
  const label = levels[index] ? levelLabels[levels[index]] : '选择档位'
  const scaleStyle = {
    '--level-count': levels.length,
    '--fill-ratio': single ? 1 : Math.max(0, index) / (levels.length - 1),
  } as CSSProperties
  return (
    <div className="ai-thinking-control">
      <div className="ai-thinking-summary"><strong>{label}</strong><span title={modelName}>{modelName}</span></div>
      <div className="ai-thinking-scale" data-single={single} style={scaleStyle}>
        <div className="ai-thinking-axis">
          {!single && <input
            className="ai-thinking-slider"
            aria-label="思考强度" aria-valuetext={label} type="range" min={0} max={levels.length - 1} step={1} value={Math.max(0, index)}
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return
              dragPointer.current = event.pointerId
              event.currentTarget.setPointerCapture?.(event.pointerId)
            }}
            onChange={(event) => {
              const next = event.currentTarget.valueAsNumber
              if (dragPointer.current !== null) setPreview(next)
              else onSelect(levels[next])
            }}
            onPointerUp={(event) => {
              if (dragPointer.current !== event.pointerId) return
              dragPointer.current = null
              // 拖动时只预览，松手时提交；系统打断手势不更改原档位。
              onSelect(levels[event.currentTarget.valueAsNumber])
              setPreview(null)
            }}
            onLostPointerCapture={(event) => {
              if (dragPointer.current === event.pointerId) { dragPointer.current = null; setPreview(null) }
            }}
            onPointerCancel={(event) => {
              if (dragPointer.current === event.pointerId) { dragPointer.current = null; setPreview(null) }
            }}
          />}
          <div aria-hidden="true" className="ai-thinking-rail" data-has-value={index >= 0} />
          <div aria-hidden="true" className="ai-thinking-marks">
            {levels.map((level, i) => <span key={level} data-reached={i <= index} data-current={i === index} />)}
          </div>
        </div>
        {single ? <p className="ai-thinking-single" title="此模型仅支持这一档">{label}</p> : (
          <div aria-label="思考强度档位" className="ai-thinking-options" role="group">
            {levels.map((level, i) => (
              <button key={level} aria-pressed={value === level} data-current={i === index} type="button" onClick={() => onSelect(level)}>
                <span>{levelLabels[level]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
