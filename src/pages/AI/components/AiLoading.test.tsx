import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { AiLoading } from './AiLoading'

it('页面和局部共用加载环，只向辅助技术播报加载文字', () => {
  const view = render(<AiLoading message="模型列表加载中…" />)
  const status = screen.getByRole('status')
  expect(status).toHaveAttribute('data-variant', 'inline')
  expect(status).toHaveTextContent('模型列表加载中…')
  expect(status.querySelector('.ai-loading-ring')).toHaveAttribute('aria-hidden', 'true')
  expect(status).not.toHaveAttribute('data-fill')
  view.rerender(<AiLoading fill message="智能体加载中…" variant="page" />)
  expect(status).toHaveAttribute('data-fill', 'true')
  expect(status).toHaveAttribute('data-variant', 'page')
  expect(status).toHaveTextContent('智能体加载中…')
})
