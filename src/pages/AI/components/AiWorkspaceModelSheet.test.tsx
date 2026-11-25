import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiWorkspaceModelSheet } from './AiWorkspaceModelSheet'
import { makeModelControls } from '../../../test/fixtures/chatModels'

const dialogMethods = ['showModal', 'close'] as const
const originalDescriptors = dialogMethods.map((method) => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, method))

beforeEach(() => {
  // 测试环境未实现原生弹层方法，仅模拟开启状态，不代替浏览器处理焦点。
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) { this.setAttribute('open', '') },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) { this.removeAttribute('open') },
    },
  })
})

afterEach(() => {
  cleanup()
  dialogMethods.forEach((method, index) => {
    const descriptor = originalDescriptors[index]
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, method, descriptor)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, method)
  })
})

describe('AI 工作区模型弹层', () => {
  it('显示接口模型、Auto 对应的默认模型和当前选项，选中即收起', () => {
    const onClose = vi.fn()
    const controls = makeModelControls()
    render(<AiWorkspaceModelSheet mode="model" controls={controls} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: '选择模型' })
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('Auto使用 模型 A 模型')
    fireEvent.click(screen.getByRole('option', { name: '模型 B' }))
    expect(controls.selectModel).toHaveBeenCalledWith('model-b')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('加载时不展示旧列表，失败可手动重新加载', () => {
    const controls = makeModelControls({ loading: true })
    const { rerender } = render(<AiWorkspaceModelSheet mode="model" controls={controls} onClose={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('加载中')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    rerender(<AiWorkspaceModelSheet mode="model" controls={{ ...controls, loading: false, error: '目录查询失败' }} onClose={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('目录查询失败')
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    expect(controls.reload).toHaveBeenCalledOnce()
  })

  it('点击直接选择、拖动仅在松手时提交，取消手势不提交', () => {
    const controls = makeModelControls()
    render(<AiWorkspaceModelSheet mode="thinking" controls={controls} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '低' }))
    expect(controls.selectLevel).toHaveBeenCalledWith('low')
    const slider = screen.getByRole('slider', { name: '思考强度' })
    const marks = screen.getByRole('dialog').querySelectorAll('.ai-thinking-marks > span')
    expect(marks).toHaveLength(2)
    expect(marks[1]).toHaveAttribute('data-current', 'true')
    fireEvent.pointerDown(slider, { pointerId: 1, isPrimary: true, button: 0 })
    fireEvent.change(slider, { target: { value: '0' } })
    expect(slider).toHaveAttribute('aria-valuetext', '低')
    expect(marks[0]).toHaveAttribute('data-current', 'true')
    expect(screen.getByRole('button', { name: '高' })).toHaveAttribute('aria-pressed', 'true')
    expect(controls.selectLevel).toHaveBeenCalledTimes(1)
    fireEvent.pointerCancel(slider, { pointerId: 1 })
    expect(slider).toHaveAttribute('aria-valuetext', '高')
    expect(marks[1]).toHaveAttribute('data-current', 'true')
    fireEvent.pointerDown(slider, { pointerId: 1, isPrimary: true, button: 0 })
    fireEvent.change(slider, { target: { value: '0' } })
    fireEvent.pointerUp(slider, { pointerId: 1 })
    expect(controls.selectLevel).toHaveBeenCalledTimes(2)
    expect(controls.selectLevel).toHaveBeenLastCalledWith('low')
  })

  it('单档显示静态胶囊和一个刻度，没有可拖动滑杆或档位按钮', () => {
    render(<AiWorkspaceModelSheet mode="thinking" controls={makeModelControls({ levels: ['medium'], thinkingLevel: 'medium' })} onClose={vi.fn()} />)
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '中等' })).not.toBeInTheDocument()
    const scale = screen.getByRole('dialog').querySelector('.ai-thinking-scale')
    expect(scale).toHaveAttribute('data-single', 'true')
    expect(scale?.querySelectorAll('.ai-thinking-marks > span')).toHaveLength(1)
    expect(screen.getByText('中等', { selector: 'strong' })).toBeVisible()
    expect(screen.getByText('中等', { selector: '.ai-thinking-single' })).toBeVisible()
  })

  it('关闭按钮调起关闭回调', () => {
    const onClose = vi.fn()
    render(<AiWorkspaceModelSheet mode="model" controls={makeModelControls()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '关闭模型选择' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击遮罩调起关闭回调', () => {
    const onClose = vi.fn()
    render(<AiWorkspaceModelSheet mode="model" controls={makeModelControls()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('dialog', { name: '选择模型' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape 触发的取消事件交由父级管理关闭', () => {
    const onClose = vi.fn()
    render(<AiWorkspaceModelSheet mode="model" controls={makeModelControls()} onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: '选择模型' })
    expect(fireEvent(dialog, new Event('cancel', { cancelable: true }))).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('严格模式重复初始化后仍处于开启状态，卸载时关闭原生弹层', () => {
    const { unmount } = render(<StrictMode><AiWorkspaceModelSheet mode="model" controls={makeModelControls()} onClose={vi.fn()} /></StrictMode>)
    const dialog = screen.getByRole('dialog', { name: '选择模型' })
    expect(dialog).toHaveAttribute('open')

    unmount()
    expect(dialog).not.toHaveAttribute('open')
  })
})
