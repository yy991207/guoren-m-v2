import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiWorkspaceModelSheet } from './AiWorkspaceModelSheet'

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
  it('只展示当前已选的 Auto，点击选中行不触发操作', () => {
    const onClose = vi.fn()
    render(<AiWorkspaceModelSheet onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: '选择模型' })
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByText('Auto')).toBeVisible()
    expect(screen.getByText('（当前已选）')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toEqual([screen.getByRole('button', { name: '关闭模型选择' })])
    fireEvent.click(screen.getByText('Auto'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('关闭按钮调起关闭回调', () => {
    const onClose = vi.fn()
    render(<AiWorkspaceModelSheet onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '关闭模型选择' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('点击遮罩调起关闭回调', () => {
    const onClose = vi.fn()
    render(<AiWorkspaceModelSheet onClose={onClose} />)

    fireEvent.click(screen.getByRole('dialog', { name: '选择模型' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape 触发的取消事件交由父级管理关闭', () => {
    const onClose = vi.fn()
    render(<AiWorkspaceModelSheet onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: '选择模型' })
    expect(fireEvent(dialog, new Event('cancel', { cancelable: true }))).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('严格模式重复初始化后仍处于开启状态，卸载时关闭原生弹层', () => {
    const { unmount } = render(<StrictMode><AiWorkspaceModelSheet onClose={vi.fn()} /></StrictMode>)
    const dialog = screen.getByRole('dialog', { name: '选择模型' })
    expect(dialog).toHaveAttribute('open')

    unmount()
    expect(dialog).not.toHaveAttribute('open')
  })
})
