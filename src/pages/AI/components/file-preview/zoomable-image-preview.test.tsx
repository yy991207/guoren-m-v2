import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FilePreviewRenderer } from './file-preview-renderer'

const methods = ['showModal', 'close'] as const
const original = methods.map((method) => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, method))
const imageProps = { content: '', loading: false, language: null, fileName: '配图.png', imageUrl: '/images/chart.png' }

beforeEach(() => {
  // jsdom 不提供原生对话框方法；浏览器手势不在这里模拟。
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
})

afterEach(() => {
  cleanup()
  methods.forEach((method, i) => {
    if (original[i]) Object.defineProperty(HTMLDialogElement.prototype, method, original[i])
    else Reflect.deleteProperty(HTMLDialogElement.prototype, method)
  })
})

describe('独立图片大图查看', () => {
  it('点图打开，可关闭并重新打开；取消操作只关闭大图', () => {
    render(<FilePreviewRenderer {...imageProps} />)
    const trigger = screen.getByRole('button', { name: '查看大图：配图.png' })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '大图：配图.png' })).toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: '关闭大图' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(trigger)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toBeVisible()
  })

  it('切换图片不保留上一张的大图状态', () => {
    const { rerender } = render(<FilePreviewRenderer {...imageProps} />)
    fireEvent.click(screen.getByRole('button', { name: '查看大图：配图.png' }))
    rerender(<FilePreviewRenderer {...imageProps} fileName="下一张.jpg" imageUrl="/images/next.jpg" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '下一张.jpg' })).toHaveAttribute('src', '/images/next.jpg')
  })

  it('HTML 原样交给网页渲染，不为内嵌图添加手势或按钮', () => {
    const html = '<figure><img src="/chart.png" alt="插图"></figure>'
    render(<FilePreviewRenderer loading={false} fileName="课件.html" language="html" content={html} />)
    expect(screen.getByTitle('课件.html')).toHaveAttribute('srcdoc', html)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
