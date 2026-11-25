import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { TextArea, Toast } from 'antd-mobile'
import type { TextAreaRef } from 'antd-mobile/es/components/text-area'
import { AddOutline, DownOutline, StopOutline, UpOutline } from 'antd-mobile-icons'
import { useVoiceInput } from '../../../hooks/useVoiceInput'
import { AiWorkspaceModelSheet } from './AiWorkspaceModelSheet'
import './AiWorkspaceComposer.css'

const MAX_INPUT_LENGTH = 10_000
const COMPACT_TEXTAREA_ROWS = { minRows: 1, maxRows: 1 }
const TEXTAREA_ROWS = { minRows: 1, maxRows: 4 }
const SWIPE_CANCEL_DISTANCE = 56

type VoiceState = ReturnType<typeof useVoiceInput>['state']
type VoiceFeedback = 'idle' | 'requesting' | 'recording' | 'canceling' | 'finishing'
type HoldKey = ' ' | 'Enter'
type Gesture =
  | { type: 'pointer'; id: number; startY: number; canceling: boolean }
  | { type: 'keyboard'; key: HoldKey }

type CaptureAttempt = {
  id: number
  sessionKey: string | null
  gesture: Gesture
  phase: 'requesting' | 'recording' | 'finishing'
  stop: () => void
  finalizedText: string
  partialText: string
}

type VoiceCaptureHandle = {
  start: () => Promise<void>
  stop: () => void
  supported: boolean
}

type VoiceCaptureProps = {
  id: number
  onResult: (id: number, text: string, isFinal: boolean) => void
  onError: (id: number, error: Error) => void
  onStateChange: (id: number, state: VoiceState) => void
}

// 每个手势使用独立的采集实例，权限弹窗和连接清理的迟到回调不能影响下一轮。
const VoiceCapture = forwardRef<VoiceCaptureHandle, VoiceCaptureProps>(function VoiceCapture({
  id,
  onResult,
  onError,
  onStateChange,
}, ref) {
  const handleResult = useCallback((text: string, isFinal: boolean) => onResult(id, text, isFinal), [id, onResult])
  const handleError = useCallback((error: Error) => onError(id, error), [id, onError])
  const handleStateChange = useCallback((state: VoiceState) => onStateChange(id, state), [id, onStateChange])
  const { startRecording, stopRecording, isSupported } = useVoiceInput({
    onResult: handleResult,
    onError: handleError,
    onStateChange: handleStateChange,
  })

  useImperativeHandle(ref, () => ({ start: startRecording, stop: stopRecording, supported: isSupported }), [
    isSupported, startRecording, stopRecording,
  ])

  return null
})

function isCanceling(gesture: Gesture) {
  return gesture.type === 'pointer' && gesture.canceling
}

function isHoldKey(key: string): key is HoldKey {
  return key === ' ' || key === 'Enter'
}

export interface AiWorkspaceComposerProps {
  active: boolean
  canRecord: boolean
  canSubmit: boolean
  className?: string
  isResponding: boolean
  isStopping: boolean
  note?: string
  placeholder: string
  plusExpanded?: boolean
  sessionKey: string | null
  textExpanded: boolean
  value: string
  voiceMode: boolean
  onChange: (value: string) => void
  onPlusClick: () => void
  onStop: () => void | Promise<void>
  onSubmit: (promptOverride?: string) => void | Promise<void>
  onTextEditingChange: (editing: boolean) => void
  onVoiceModeChange: (voiceMode: boolean) => void
}

type VoiceCaptureContext = Pick<AiWorkspaceComposerProps, 'sessionKey' | 'onSubmit'> & { canCapture: boolean }

function useComposerVoiceCapture(context: VoiceCaptureContext) {
  const { canCapture, sessionKey, onSubmit } = context
  const contextRef = useRef(context)
  const attemptRef = useRef<CaptureAttempt | null>(null)
  const captureRef = useRef<VoiceCaptureHandle>(null)
  const captureIdRef = useRef(0)
  const [captureId, setCaptureId] = useState(0)
  const [feedback, setFeedback] = useState<VoiceFeedback>('idle')

  const clearCapture = useCallback(() => {
    attemptRef.current = null
    captureIdRef.current += 1
    setCaptureId(captureIdRef.current)
    setFeedback('idle')
  }, [])

  const cancelCapture = useCallback(() => {
    const attempt = attemptRef.current
    if (!attempt) return

    // 先把本轮标为无效：权限申请期间停止可能立即触发 idle 回调。
    clearCapture()
    if (attempt.phase !== 'finishing') attempt.stop()
  }, [clearCapture])

  useLayoutEffect(() => {
    contextRef.current = { canCapture, sessionKey, onSubmit }
    const attempt = attemptRef.current
    if (attempt && (!canCapture || attempt.sessionKey !== sessionKey)) cancelCapture()
  }, [canCapture, cancelCapture, onSubmit, sessionKey])

  useLayoutEffect(() => () => {
    const attempt = attemptRef.current
    attemptRef.current = null
    if (attempt && attempt.phase !== 'finishing') attempt.stop()
  }, [])

  const startCapture = (gesture: Gesture) => {
    const capture = captureRef.current
    if (!contextRef.current.canCapture || document.hidden || attemptRef.current || !capture || captureId !== captureIdRef.current) {
      return false
    }

    if (!capture.supported) {
      Toast.show({ content: '当前设备暂不支持语音输入' })
      return false
    }

    attemptRef.current = {
      id: captureId,
      sessionKey: contextRef.current.sessionKey,
      gesture,
      phase: 'requesting',
      stop: capture.stop,
      finalizedText: '',
      partialText: '',
    }
    setFeedback('requesting')
    // 从按下事件直接请求麦克风，挂载或切到语音模式都不会自动开麦。
    void capture.start()
    return true
  }

  const finishGesture = useCallback(() => {
    const attempt = attemptRef.current
    if (!attempt || attempt.phase === 'finishing') return

    if (isCanceling(attempt.gesture)) {
      cancelCapture()
      return
    }

    attempt.phase = 'finishing'
    setFeedback('finishing')
    attempt.stop()
  }, [cancelCapture])

  const handleResult = useCallback((id: number, text: string, isFinal: boolean) => {
    const attempt = attemptRef.current
    if (!attempt || attempt.id !== id || !text) return

    // 最终片段会替换当前的临时片段；只追加已经确认的片段。
    if (isFinal) {
      attempt.finalizedText += text
      attempt.partialText = ''
    } else {
      attempt.partialText = text
    }
  }, [])

  const handleError = useCallback((id: number, error: Error) => {
    if (attemptRef.current?.id !== id) return

    clearCapture()
    Toast.show({ content: error.message || '语音输入失败' })
  }, [clearCapture])

  const handleStateChange = useCallback((id: number, state: VoiceState) => {
    const attempt = attemptRef.current
    if (!attempt || attempt.id !== id) return

    if (state === 'recording' && attempt.phase === 'requesting') {
      attempt.phase = 'recording'
      if (!isCanceling(attempt.gesture)) setFeedback('recording')
    }

    if (state !== 'idle') return

    // 等采集停止流程结束再读识别结果，允许松手后到达的最后一段文字。
    clearCapture()
    const latest = contextRef.current
    if (attempt.phase !== 'finishing' || !latest.canCapture || latest.sessionKey !== attempt.sessionKey || document.hidden) return

    const text = (attempt.finalizedText + attempt.partialText).trim()
    if (text) {
      void latest.onSubmit(text)
    } else {
      Toast.show({ content: '未识别到文字' })
    }
  }, [clearCapture])

  const handleLostPointerCapture = (event: PointerEvent<HTMLButtonElement>) => {
    const attempt = attemptRef.current
    if (attempt && attempt.phase !== 'finishing' && attempt.gesture.type === 'pointer' && attempt.gesture.id === event.pointerId) {
      cancelCapture()
    }
  }

  const handleHoldBlur = () => {
    const attempt = attemptRef.current
    if (attempt?.gesture.type === 'keyboard' && attempt.phase !== 'finishing') cancelCapture()
  }

  useEffect(() => {
    function getPointerAttempt(id: number) {
      const attempt = attemptRef.current
      if (attempt && attempt.phase !== 'finishing' && attempt.gesture.type === 'pointer' && attempt.gesture.id === id) {
        return { attempt, gesture: attempt.gesture }
      }
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const held = getPointerAttempt(event.pointerId)
      if (!held) return

      const canceling = held.gesture.startY - event.clientY >= SWIPE_CANCEL_DISTANCE
      if (canceling === held.gesture.canceling) return

      held.gesture.canceling = canceling
      setFeedback(canceling ? 'canceling' : held.attempt.phase)
    }

    function handlePointerUp(event: globalThis.PointerEvent) {
      const held = getPointerAttempt(event.pointerId)
      if (!held) return

      held.gesture.canceling = held.gesture.startY - event.clientY >= SWIPE_CANCEL_DISTANCE
      finishGesture()
    }

    function handlePointerCancel(event: globalThis.PointerEvent) {
      if (getPointerAttempt(event.pointerId)) cancelCapture()
    }

    function handleKeyUp(event: globalThis.KeyboardEvent) {
      const gesture = attemptRef.current?.gesture
      if (gesture?.type === 'keyboard' && gesture.key === event.key) finishGesture()
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') cancelCapture()
    }

    function handleVisibilityChange() {
      if (document.hidden) cancelCapture()
    }

    // 监听窗口，确保手指移出按钮、指针被系统中断时也能结束本轮。
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('blur', cancelCapture)
    window.addEventListener('pagehide', cancelCapture)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('blur', cancelCapture)
      window.removeEventListener('pagehide', cancelCapture)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [cancelCapture, finishGesture])

  return {
    cancelCapture,
    capture: (
      <VoiceCapture
        id={captureId}
        key={captureId}
        ref={captureRef}
        onError={handleError}
        onResult={handleResult}
        onStateChange={handleStateChange}
      />
    ),
    feedback,
    handleHoldBlur,
    handleLostPointerCapture,
    startCapture,
  }
}

function KeyboardIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="21" stroke="currentColor" strokeLinecap="round" strokeWidth="1.65" viewBox="0 0 24 24" width="21">
      <rect height="13" rx="2.5" width="19" x="2.5" y="5.5" />
      <path d="M6.5 9.5h.1m3.6 0h.1m3.6 0h.1m3.6 0h.1M6.5 13h.1m3.6 0h.1m3.6 0h.1m3.6 0h.1M9 15.5h6" />
    </svg>
  )
}

function VoiceModeIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="21" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24" width="21">
      <circle cx="4.5" cy="12" fill="currentColor" r="1.35" stroke="none" />
      <path d="M8.5 8.7a4.65 4.65 0 0 1 0 6.6m4-10a9.45 9.45 0 0 1 0 13.4m4-16.5a13.85 13.85 0 0 1 0 19.6" />
    </svg>
  )
}

const WAVE_BARS = Array.from({ length: 29 }, (_, index) => index)

const FEEDBACK_LABELS = {
  requesting: ['正在准备录音', '上滑取消'],
  recording: ['正在录音', '松开发送，上滑取消'],
  canceling: ['松开取消', '下滑回到发送'],
  finishing: ['正在识别语音', '识别后自动发送'],
} as const

export function AiWorkspaceComposer({
  active,
  canRecord,
  canSubmit,
  className,
  isResponding,
  isStopping,
  note,
  placeholder,
  plusExpanded,
  sessionKey,
  textExpanded,
  value,
  voiceMode,
  onChange,
  onPlusClick,
  onStop,
  onSubmit,
  onTextEditingChange,
  onVoiceModeChange,
}: AiWorkspaceComposerProps) {
  const fieldId = useId()
  const composerRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<TextAreaRef>(null)
  const focusTextRef = useRef(false)
  const [showModelSheet, setShowModelSheet] = useState(false)
  const expanded = !voiceMode && textExpanded
  const modelSheetOpen = active && expanded && !plusExpanded && showModelSheet
  const canCapture = active && canRecord && voiceMode && !isResponding && !isStopping
  const { cancelCapture, capture, feedback, handleHoldBlur, handleLostPointerCapture, startCapture } = useComposerVoiceCapture({
    canCapture, onSubmit, sessionKey,
  })

  useLayoutEffect(() => {
    if (!voiceMode && focusTextRef.current) {
      focusTextRef.current = false
      fieldRef.current?.focus()
    }
  }, [voiceMode])

  useLayoutEffect(() => {
    if (!active) onTextEditingChange(false)
    if (showModelSheet && !modelSheetOpen) setShowModelSheet(false)
  }, [active, modelSheetOpen, onTextEditingChange, showModelSheet])

  useEffect(() => {
    if (!active || !expanded || modelSheetOpen || plusExpanded) return

    // 点空白处不一定触发失焦；离开编辑后，由页面根据是否有草稿决定收不收起。
    const handleOutsidePointer = (event: globalThis.PointerEvent) => {
      const composer = composerRef.current
      if (composer && event.target instanceof Node && !composer.contains(event.target)) {
        onTextEditingChange(false)
        fieldRef.current?.blur()
      }
    }
    document.addEventListener('pointerdown', handleOutsidePointer, true)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true)
  }, [active, expanded, modelSheetOpen, plusExpanded, value, onTextEditingChange])

  const handleModeClick = () => {
    cancelCapture()
    if (!voiceMode) onTextEditingChange(false)
    focusTextRef.current = voiceMode
    onVoiceModeChange(!voiceMode)
  }

  const handlePress = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || event.isPrimary === false) return
    if (startCapture({ type: 'pointer', id: event.pointerId, startY: event.clientY, canceling: false })) {
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId)
      } catch {
        // 无法捕获指针时，窗口仍负责收尾，不把它当成语音服务失败。
      }
    }
  }

  const handleHoldKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isHoldKey(event.key)) return

    event.preventDefault()
    if (!event.repeat) startCapture({ type: 'keyboard', key: event.key })
  }

  const showSend = !voiceMode && Boolean(value.trim())
  const actionDisabled = !active || isStopping || (!isResponding && (!canSubmit || !showSend))

  const handleAction = () => {
    if (actionDisabled) return
    if (isResponding) {
      void onStop()
    } else {
      void onSubmit()
    }
  }

  const handleTextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return

    event.preventDefault()
    if (!event.repeat) handleAction()
  }

  const labels = feedback === 'idle' ? null : FEEDBACK_LABELS[feedback]
  const holdLabel = feedback === 'canceling' ? '松开取消'
    : feedback === 'recording' ? null
      : feedback === 'finishing' ? '正在识别'
        : feedback === 'requesting' ? '正在准备录音' : '按住说话'
  const voiceHintId = `${fieldId}-voice-hint`

  return (
    <div
      className={['ai-workspace-composer', className].filter(Boolean).join(' ')}
      ref={composerRef}
      onBlur={(event) => {
        if (!modelSheetOpen && !plusExpanded && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          onTextEditingChange(false)
        }
      }}
    >
      {capture}
      {voiceMode && (
        <>
          <span className="ai-workspace-composer-visually-hidden" id={voiceHintId}>
            松开发送，上滑取消。使用键盘时长按空格或回车，按 Esc 取消。
          </span>
          <div className="ai-workspace-composer-feedback" data-stage={feedback} role="status">
            {labels && (
              <>
                {feedback === 'recording' && (
                  <span aria-hidden="true" className="ai-workspace-composer-wave">
                    {WAVE_BARS.map((bar) => <span key={bar} />)}
                  </span>
                )}
                <span className={feedback === 'recording' ? 'ai-workspace-composer-visually-hidden' : 'ai-workspace-composer-feedback-title'}>
                  {labels[0]}
                </span>
                <span className="ai-workspace-composer-feedback-hint">{labels[1]}</span>
              </>
            )}
          </div>
        </>
      )}
      <div className="ai-workspace-composer-row" data-expanded={expanded} data-stage={feedback}>
        {!voiceMode && (
          <div className="ai-workspace-composer-field">
            <label className="ai-workspace-composer-visually-hidden" htmlFor={fieldId}>提问输入框</label>
            <TextArea
              autoSize={expanded ? TEXTAREA_ROWS : COMPACT_TEXTAREA_ROWS}
              disabled={!active}
              enterKeyHint="send"
              id={fieldId}
              maxLength={MAX_INPUT_LENGTH}
              placeholder={expanded ? '发消息…' : placeholder}
              ref={fieldRef}
              rows={1}
              value={value}
              onChange={onChange}
              onClick={() => onTextEditingChange(true)}
              onFocus={() => onTextEditingChange(true)}
              onKeyDown={handleTextKeyDown}
            />
          </div>
        )}
        <button
          aria-label={voiceMode ? '切换到文字输入' : '切换到语音输入'}
          className="ai-workspace-composer-icon ai-workspace-composer-mode"
          disabled={!active}
          type="button"
          onClick={handleModeClick}
        >
          {voiceMode ? <KeyboardIcon /> : <VoiceModeIcon />}
        </button>
        {voiceMode && (
          <button
            aria-describedby={voiceHintId}
            aria-disabled={!canCapture || feedback === 'finishing'}
            aria-label="按住说话"
            className="ai-workspace-composer-hold"
            data-stage={feedback}
            type="button"
            onBlur={handleHoldBlur}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={handleHoldKeyDown}
            onLostPointerCapture={handleLostPointerCapture}
            onPointerDown={handlePress}
          >
            {holdLabel}
          </button>
        )}
        {expanded && (
          <button
            aria-expanded={modelSheetOpen}
            aria-haspopup="dialog"
            aria-label="选择模型：Auto"
            className="ai-workspace-composer-model"
            disabled={!active}
            type="button"
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true })
              setShowModelSheet(true)
            }}
          >
            <span aria-hidden="true" className="ai-workspace-composer-model-icon">A</span>
            Auto
            <DownOutline aria-hidden="true" width={12} height={12} />
          </button>
        )}
        <button
          aria-expanded={plusExpanded}
          aria-haspopup="dialog"
          aria-label="打开更多操作"
          className="ai-workspace-composer-icon ai-workspace-composer-plus"
          disabled={!active}
          type="button"
          onClick={() => {
            cancelCapture()
            onPlusClick()
          }}
        >
          <AddOutline aria-hidden="true" fontSize={23} />
        </button>
        {(expanded || isResponding) && (
          <button
            aria-label={isResponding ? '停止回答' : '发送消息'}
            className="ai-workspace-composer-icon ai-workspace-composer-action"
            disabled={actionDisabled}
            type="button"
            onClick={handleAction}
          >
            {isResponding ? <StopOutline aria-hidden="true" style={{ fontSize: 18 }} /> : <UpOutline aria-hidden="true" style={{ fontSize: 18 }} />}
          </button>
        )}
      </div>
      {note && <p className="ai-workspace-composer-note">{note}</p>}
      {modelSheetOpen && <AiWorkspaceModelSheet onClose={() => setShowModelSheet(false)} />}
    </div>
  )
}
