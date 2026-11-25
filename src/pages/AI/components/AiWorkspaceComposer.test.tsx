import { StrictMode, useRef, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Toast } from 'antd-mobile'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useVoiceInput } from '../../../hooks/useVoiceInput'
import { AiWorkspaceComposer } from './AiWorkspaceComposer'
import type { AiWorkspaceComposerProps } from './AiWorkspaceComposer'
import { makeModelControls } from '../../../test/fixtures/chatModels'

vi.mock('../../../hooks/useVoiceInput', () => ({ useVoiceInput: vi.fn() }))
vi.mock('./AiWorkspaceModelSheet', () => ({
  AiWorkspaceModelSheet: ({ onClose }: { onClose: () => void }) => (
    <div aria-label="选择模型" role="dialog">
      <button type="button" onClick={onClose}>关闭选择模型</button>
    </div>
  ),
}))
vi.mock('antd-mobile', async (importOriginal) => ({
  ...await importOriginal<typeof import('antd-mobile')>(),
  Toast: { show: vi.fn() },
}))

type VoiceOptions = Parameters<typeof useVoiceInput>[0]
type VoiceState = ReturnType<typeof useVoiceInput>['state']

function createMockCapture(options: VoiceOptions) {
  let state: VoiceState = 'idle'
  function emitState(next: VoiceState) {
    state = next
    options.onStateChange?.(next)
  }

  const instance = {
    result: options.onResult,
    error: (error: Error) => {
      emitState('error')
      options.onError?.(error)
    },
    state: emitState,
    start: vi.fn(async () => {
      starts.push(instance)
      emitState('requesting')
    }),
    stop: vi.fn(() => {
      if (state === 'requesting') emitState('idle')
      if (state === 'recording') emitState('stopping')
    }),
  }

  return instance
}

const starts: ReturnType<typeof createMockCapture>[] = []

beforeEach(() => {
  starts.length = 0
  vi.clearAllMocks()
  vi.mocked(useVoiceInput).mockImplementation((options) => {
    const captureRef = useRef<ReturnType<typeof createMockCapture> | null>(null)
    if (!captureRef.current) captureRef.current = createMockCapture(options)
    const capture = captureRef.current
    return { state: 'idle', isSupported: true, startRecording: capture.start, stopRecording: capture.stop }
  })
})

type TestComposerProps = Omit<AiWorkspaceComposerProps, 'textExpanded' | 'onTextEditingChange' | 'onVoiceModeChange'>

function TestComposer(props: TestComposerProps) {
  const [voiceMode, setVoiceMode] = useState(props.voiceMode)
  const [editing, setEditing] = useState(false)
  return (
    <>
      <button type="button">输入区之外</button>
      <AiWorkspaceComposer
        {...props}
        textExpanded={!voiceMode && (editing || Boolean(props.value.trim()))}
        voiceMode={voiceMode}
        onTextEditingChange={setEditing}
        onVoiceModeChange={setVoiceMode}
      />
    </>
  )
}

function renderComposer(overrides: Partial<TestComposerProps> = {}) {
  let props = {
    active: true,
    modelControls: makeModelControls(),
    modelBusy: false,
    canRecord: true,
    canSubmit: true,
    isResponding: false,
    isStopping: false,
    note: 'AI 生成内容可能有误，请核实重要信息',
    placeholder: '提个问题，或让我创作、分析任意内容',
    sessionKey: 'session-one',
    value: '没发出的文字草稿',
    voiceMode: false,
    ...overrides,
    onChange: vi.fn<(value: string) => void>(),
    onPlusClick: vi.fn<() => void>(),
    onStop: vi.fn<() => void>(),
    onSubmit: vi.fn<(override?: string) => void>(),
  }
  const view = render(<StrictMode><TestComposer {...props} /></StrictMode>)
  return {
    get props() { return props },
    unmount: view.unmount,
    update(next: Partial<AiWorkspaceComposerProps>) {
      props = { ...props, ...next } as typeof props
      view.rerender(<StrictMode><TestComposer {...props} /></StrictMode>)
    },
  }
}

function pressHold(pointerId = 1) {
  const button = screen.getByRole('button', { name: '按住说话' })
  fireEvent.pointerDown(button, { button: 0, pointerId, pointerType: 'touch', isPrimary: true, clientY: 200 })
  return button
}

function releaseHold(pointerId = 1, clientY = 200) {
  fireEvent.pointerUp(window, { pointerId, pointerType: 'touch', clientY })
}

function beginRecording(pointerId = 1) {
  const button = pressHold(pointerId)
  const capture = starts[starts.length - 1]
  act(() => capture.state('recording'))
  return { button, capture }
}

describe('AI 工作区对话输入', () => {
  it('附件放在白色输入区内部，清空附件不再留下附件行', () => {
    const { update } = renderComposer({ attachmentTray: <div>待发送附件</div> })
    const textbox = screen.getByRole('textbox', { name: '提问输入框' })
    const row = textbox.closest('.ai-workspace-composer-row')
    expect(row).toContainElement(screen.getByText('待发送附件'))
    expect(row).toHaveAttribute('data-has-attachments', 'true')

    update({ attachmentTray: undefined })
    expect(row).toHaveAttribute('data-has-attachments', 'false')
    expect(screen.queryByText('待发送附件')).not.toBeInTheDocument()
  })

  it('空输入从单行展开，点外面后收起同一个输入框', () => {
    const { props } = renderComposer({ canSubmit: false, value: '' })
    const textbox = screen.getByRole('textbox', { name: '提问输入框' })
    const row = textbox.closest('.ai-workspace-composer-row')
    expect(row).toHaveAttribute('data-expanded', 'false')
    expect(textbox).toHaveAttribute('placeholder', props.placeholder)
    expect(screen.queryByRole('button', { name: '发送消息' })).not.toBeInTheDocument()

    act(() => textbox.focus())
    expect(row).toHaveAttribute('data-expanded', 'true')
    expect(textbox).toHaveFocus()
    expect(textbox).toHaveAttribute('placeholder', '发消息…')
    expect(screen.getByRole('button', { name: '发送消息' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '选择模型：Auto' })).toBeVisible()

    fireEvent.pointerDown(screen.getByRole('button', { name: '输入区之外' }))
    expect(row).toHaveAttribute('data-expanded', 'false')
    expect(screen.getByRole('textbox', { name: '提问输入框' })).toBe(textbox)
    expect(textbox).not.toHaveFocus()
  })

  it('点击外部保留有草稿的展开状态，清空后恢复单行', () => {
    const { props, update } = renderComposer()
    const textbox = screen.getByRole('textbox', { name: '提问输入框' })
    const row = textbox.closest('.ai-workspace-composer-row')
    act(() => textbox.focus())
    fireEvent.pointerDown(screen.getByRole('button', { name: '输入区之外' }))
    expect(row).toHaveAttribute('data-expanded', 'true')
    expect(textbox).toHaveValue(props.value)
    expect(textbox).not.toHaveFocus()

    update({ value: '', canSubmit: false })
    expect(row).toHaveAttribute('data-expanded', 'false')
  })

  it('切换为不支持强度的模型时隐藏档位，恢复历史或回复中不能改选择', () => {
    const { update } = renderComposer()
    expect(screen.getByRole('button', { name: '思考强度：高' })).toBeEnabled()
    update({ modelBusy: true })
    expect(screen.getByRole('button', { name: '思考强度：高' })).toBeDisabled()
    update({ modelBusy: false, isResponding: true })
    expect(screen.getByRole('button', { name: '选择模型：Auto' })).toBeDisabled()
    update({ modelControls: makeModelControls({ label: '模型 C', levels: [], thinkingLevel: null }) })
    expect(screen.getByRole('button', { name: '选择模型：模型 C' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /^思考强度/ })).not.toBeInTheDocument()
  })

  it('打开和关闭模型弹层不发送、不清空草稿', () => {
    const { props } = renderComposer()
    const model = screen.getByRole('button', { name: '选择模型：Auto' })
    fireEvent.click(model)
    expect(model).toHaveAttribute('aria-expanded', 'true')
    const dialog = screen.getByRole('dialog', { name: '选择模型' })
    expect(dialog).toBeVisible()
    fireEvent.pointerDown(dialog)
    fireEvent.click(screen.getByRole('button', { name: '关闭选择模型' }))
    expect(model).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue(props.value)
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('切换模式不自动开麦，文字草稿、占位和加号都保留', () => {
    const { props } = renderComposer({ plusExpanded: false })
    expect(screen.getByRole('textbox', { name: '提问输入框' })).toHaveValue(props.value)
    expect(screen.getByPlaceholderText('发消息…')).toBeVisible()
    expect(screen.getByText(String(props.note))).toBeVisible()
    const plus = screen.getByRole('button', { name: '打开更多操作' })
    expect(screen.getAllByRole('button').slice(-2)).toEqual([plus, screen.getByRole('button', { name: '发送消息' })])
    expect(plus).toHaveAttribute('aria-haspopup', 'dialog')
    expect(plus).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(screen.getByRole('button', { name: '切换到语音输入' }))
    expect(screen.getByRole('button', { name: '按住说话' })).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(starts).toHaveLength(0)
    fireEvent.click(plus)
    expect(props.onPlusClick).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '切换到文字输入' }))
    expect(screen.getByRole('textbox', { name: '提问输入框' })).toHaveValue(props.value)
    expect(screen.getByRole('textbox', { name: '提问输入框' })).toHaveFocus()
    expect(props.onChange).not.toHaveBeenCalled()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('普通回车发送文字，组合输入、Shift+Enter 和长按回车不误发', () => {
    const { props, update } = renderComposer()
    const textbox = screen.getByRole('textbox', { name: '提问输入框' })
    expect(fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true })).toBe(true)
    expect(fireEvent.keyDown(textbox, { key: 'Enter', isComposing: true })).toBe(true)
    expect(fireEvent.keyDown(textbox, { key: 'Enter', keyCode: 229 })).toBe(true)
    fireEvent.keyDown(textbox, { key: 'Enter', repeat: true })
    expect(props.onSubmit).not.toHaveBeenCalled()

    fireEvent.change(textbox, { target: { value: '第一行\n第二行' } })
    expect(props.onChange).toHaveBeenCalledWith('第一行\n第二行')
    expect(fireEvent.keyDown(textbox, { key: 'Enter' })).toBe(false)
    expect(props.onSubmit).toHaveBeenNthCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }))
    expect(props.onSubmit).toHaveBeenNthCalledWith(2)
    update({ canSubmit: false })
    expect(screen.getByRole('button', { name: '发送消息' })).toBeDisabled()
  })

  it('手动输入和粘贴限制为一万字', () => {
    const { props } = renderComposer()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '文'.repeat(10_001) } })
    expect(props.onChange).toHaveBeenLastCalledWith('文'.repeat(10_000))
  })

  it.each([false, true])('回答中可以停止，只有停止中的按钮禁用（语音模式：%s）', (voiceMode) => {
    const { props, update } = renderComposer({ voiceMode, isResponding: true })
    const stop = screen.getByRole('button', { name: '停止回答' })
    expect(stop).toBeEnabled()
    if (voiceMode) {
      expect(pressHold()).toHaveAttribute('aria-disabled', 'true')
      expect(starts).toHaveLength(0)
    }
    fireEvent.click(stop)
    expect(props.onStop).toHaveBeenCalledTimes(1)
    expect(props.onSubmit).not.toHaveBeenCalled()
    update({ isStopping: true })
    expect(stop).toBeDisabled()
  })
})

describe('AI 工作区按住说话', () => {
  it('松手后等待采集结束，只把最终识别文字作为发送参数，识别不改草稿', () => {
    const { props } = renderComposer({ voiceMode: true })
    expect(starts).toHaveLength(0)
    const hold = screen.getByRole('button', { name: '按住说话' })
    const { button, capture } = beginRecording()
    expect(button).toBe(hold)
    expect(button.parentElement).toHaveAttribute('data-stage', 'recording')
    expect(starts).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('正在录音')
    expect(screen.getByRole('status')).toHaveTextContent('松开发送，上滑取消')
    act(() => {
      capture.result('今天', true)
      capture.result('天气', false)
    })
    releaseHold()
    expect(capture.stop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('正在识别语音')
    expect(props.onSubmit).not.toHaveBeenCalled()
    act(() => {
      capture.result('天气怎么样', true)
      capture.state('idle')
      capture.result('不应发送的迟到文字', true)
      capture.state('idle')
    })
    expect(props.onSubmit.mock.calls).toEqual([['今天天气怎么样']])
    expect(props.onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('只收到临时识别片段时，使用停止前已有的文字', () => {
    const { props } = renderComposer({ voiceMode: true })
    const { capture } = beginRecording()
    act(() => capture.result('只有临时结果', false))
    releaseHold()
    act(() => capture.state('idle'))
    expect(props.onSubmit.mock.calls).toEqual([['只有临时结果']])
  })

  it('上滑进入取消态，松手后丢弃语音结果，切回文字保留草稿', () => {
    const { props } = renderComposer({ voiceMode: true })
    const { capture } = beginRecording()
    act(() => capture.result('取消前的识别', false))
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 120 })
    expect(screen.getByRole('status')).toHaveTextContent('松开取消')
    releaseHold(1, 120)
    expect(capture.stop).toHaveBeenCalledTimes(1)
    act(() => {
      capture.result('取消后的识别', true)
      capture.state('idle')
    })
    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(Toast.show).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '切换到文字输入' }))
    expect(screen.getByRole('textbox')).toHaveValue(props.value)
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it('其他手指不接管录音，原手指下滑退出取消态后仍可发送', () => {
    const { props } = renderComposer({ voiceMode: true })
    const { button, capture } = beginRecording()
    fireEvent.pointerDown(button, { button: 0, pointerId: 2, pointerType: 'touch', isPrimary: false, clientY: 200 })
    fireEvent.pointerMove(window, { pointerId: 2, clientY: 100 })
    fireEvent.pointerCancel(window, { pointerId: 2 })
    releaseHold(2, 100)
    expect(starts).toHaveLength(1)
    expect(capture.stop).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('正在录音')

    fireEvent.pointerMove(window, { pointerId: 1, clientY: 120 })
    expect(screen.getByRole('status')).toHaveTextContent('松开取消')
    fireEvent.pointerMove(window, { pointerId: 1, clientY: 190 })
    expect(screen.getByRole('status')).toHaveTextContent('正在录音')
    releaseHold(1, 195)
    act(() => {
      capture.result('保留录音', true)
      capture.state('idle')
    })
    expect(props.onSubmit.mock.calls).toEqual([['保留录音']])
  })

  it('权限请求时系统取消，旧实例回调不会提交或污染下一轮', () => {
    const { props } = renderComposer({ voiceMode: true })
    pressHold(1)
    expect(screen.getByRole('status')).toHaveTextContent('正在准备录音')
    const previous = starts[0]
    fireEvent.pointerCancel(window, { pointerId: 1 })
    expect(previous.stop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    const { capture: current } = beginRecording(2)
    act(() => {
      previous.state('recording')
      previous.result('上一轮旧文字', true)
      previous.error(new Error('上一轮的迟到错误'))
      previous.state('idle')
    })
    expect(screen.getByRole('status')).toHaveTextContent('正在录音')
    releaseHold(2)
    act(() => {
      current.result('新一轮文字', true)
      current.state('idle')
    })
    expect(props.onSubmit.mock.calls).toEqual([['新一轮文字']])
    expect(Toast.show).not.toHaveBeenCalled()
  })

  it('权限尚未返回时松手，只提示无识别结果，迟到的权限回调不能补发', () => {
    const { props } = renderComposer({ voiceMode: true })
    pressHold()
    const capture = starts[0]
    releaseHold()
    expect(capture.stop).toHaveBeenCalledTimes(1)
    expect(Toast.show).toHaveBeenCalledWith({ content: '未识别到文字' })
    act(() => {
      capture.state('recording')
      capture.result('意外的迟到结果', true)
      capture.state('idle')
    })
    expect(Toast.show).toHaveBeenCalledTimes(1)
    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it('语音尚未识别完就切回文字，旧结果不会发送或更改草稿', () => {
    const { props } = renderComposer({ voiceMode: true })
    const { capture } = beginRecording()
    releaseHold()
    expect(screen.getByRole('status')).toHaveTextContent('正在识别语音')
    fireEvent.click(screen.getByRole('button', { name: '切换到文字输入' }))
    expect(screen.getByRole('textbox')).toHaveValue(props.value)
    act(() => {
      capture.result('切换后的迟到结果', true)
      capture.state('idle')
    })
    expect(capture.stop).toHaveBeenCalledTimes(1)
    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it.each(['pointercancel', 'lostpointercapture'] as const)('录音中收到 %s 时丢弃结果', (interrupt) => {
    const { props } = renderComposer({ voiceMode: true })
    const { button, capture } = beginRecording()
    act(() => capture.result('系统中断', true))
    const event = { pointerId: 1, pointerType: 'touch' }
    if (interrupt === 'pointercancel') fireEvent.pointerCancel(window, event)
    else fireEvent.lostPointerCapture(button, event)
    releaseHold()
    act(() => capture.state('idle'))
    expect(capture.stop).toHaveBeenCalledTimes(1)
    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it.each([
    { sessionKey: 'session-two' },
    { active: false },
    { canRecord: false },
    { isResponding: true },
  ])('等待结果期间切换上下文 %o 时不会发送', (next) => {
    const { props, update } = renderComposer({ voiceMode: true })
    const { capture } = beginRecording()
    releaseHold()
    update(next)
    act(() => {
      capture.result('切换前的旧结果', true)
      capture.state('idle')
    })
    expect(capture.stop).toHaveBeenCalledTimes(1)
    expect(props.onSubmit).not.toHaveBeenCalled()
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it('系统切页时停止，返回后收到的旧结果也不会发送', () => {
    const { props } = renderComposer({ voiceMode: true })
    const { capture } = beginRecording()
    const visibility = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    try {
      fireEvent(document, new Event('visibilitychange'))
      expect(capture.stop).toHaveBeenCalledTimes(1)
    } finally {
      visibility.mockRestore()
    }
    releaseHold()
    act(() => {
      capture.result('切页前的旧结果', true)
      capture.state('idle')
    })
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('卸载会停止录音，旧结果无效', () => {
    const { props, unmount } = renderComposer({ voiceMode: true })
    const { capture } = beginRecording()
    unmount()
    expect(capture.stop).toHaveBeenCalledTimes(1)
    act(() => {
      capture.result('卸载后的旧结果', true)
      capture.state('idle')
    })
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('松手无识别结果和识别错误使用现有提示，不假发送', () => {
    const { props } = renderComposer({ voiceMode: true })
    const { capture } = beginRecording()
    releaseHold()
    act(() => capture.state('idle'))
    expect(Toast.show).toHaveBeenNthCalledWith(1, { content: '未识别到文字' })

    const { capture: failing } = beginRecording(2)
    act(() => failing.error(new Error('')))
    releaseHold(2)
    expect(Toast.show).toHaveBeenNthCalledWith(2, { content: '语音输入失败' })
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('键盘长按可录音，按 Esc 可取消且键盘松开不会补发', () => {
    const { props } = renderComposer({ voiceMode: true })
    const hold = screen.getByRole('button', { name: '按住说话' })
    hold.focus()
    fireEvent.keyDown(hold, { key: ' ' })
    fireEvent.keyDown(hold, { key: ' ', repeat: true })
    expect(starts).toHaveLength(1)
    const capture = starts[0]
    act(() => {
      capture.state('recording')
      capture.result('键盘取消', true)
    })
    fireEvent.keyDown(hold, { key: 'Escape' })
    fireEvent.keyUp(hold, { key: ' ' })
    act(() => capture.state('idle'))
    expect(capture.stop).toHaveBeenCalledTimes(1)
    expect(props.onSubmit).not.toHaveBeenCalled()

    fireEvent.keyDown(hold, { key: 'Enter' })
    const current = starts[1]
    act(() => current.state('recording'))
    fireEvent.keyUp(hold, { key: 'Enter' })
    act(() => {
      current.result('键盘发送', true)
      current.state('idle')
    })
    expect(props.onSubmit.mock.calls).toEqual([['键盘发送']])
  })
})
