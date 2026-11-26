import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { AiSectionTabs } from './AiSectionTabs'

const tabs = [
  { key: 'favorite', label: '收藏', content: <p>收藏内容</p> },
  { key: 'subscribed', label: '订阅', content: <p>订阅内容</p> },
] as const

function Example({ label = '收藏和订阅' }: { label?: string }) {
  const [selected, setSelected] = useState<'favorite' | 'subscribed'>('favorite')
  return <AiSectionTabs label={label} tabs={tabs} value={selected} onChange={setSelected} />
}

it('展示当前面板并关联标签；两组标签的 ID 和状态彼此独立', () => {
  render(<><Example label="第一组" /><Example label="第二组" /></>)
  const first = within(screen.getByRole('tablist', { name: '第一组' }))
  const second = within(screen.getByRole('tablist', { name: '第二组' }))
  fireEvent.click(first.getByRole('tab', { name: '订阅' }))
  const panel = screen.getByRole('tabpanel', { name: '订阅' })
  expect(panel).toHaveTextContent('订阅内容')
  expect(first.getByRole('tab', { name: '订阅' })).toHaveAttribute('aria-controls', panel.id)
  expect(first.getByRole('tab', { name: '收藏' })).toHaveAttribute('tabindex', '-1')
  expect(second.getByRole('tab', { name: '收藏' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getAllByText('收藏内容')).toHaveLength(1)
})

it('方向键、Home 和 End 切换内容并移动焦点', () => {
  render(<Example />)
  const favorite = screen.getByRole('tab', { name: '收藏' })
  const subscribed = screen.getByRole('tab', { name: '订阅' })
  favorite.focus()
  fireEvent.keyDown(favorite, { key: 'ArrowLeft' })
  expect(subscribed).toHaveFocus()
  expect(screen.getByRole('tabpanel', { name: '订阅' })).toBeVisible()
  fireEvent.keyDown(subscribed, { key: 'Home' })
  expect(favorite).toHaveFocus()
  fireEvent.keyDown(favorite, { key: 'End' })
  expect(subscribed).toHaveFocus()
  fireEvent.keyDown(subscribed, { key: 'ArrowRight' })
  expect(favorite).toHaveFocus()
  expect(screen.getByRole('tabpanel', { name: '收藏' })).toBeVisible()
})

it('切换由页面控制，组件只通知新的选项', () => {
  const onChange = vi.fn()
  render(<AiSectionTabs label="收藏和订阅" tabs={tabs} value="favorite" onChange={onChange} />)
  fireEvent.click(screen.getByRole('tab', { name: '订阅' }))
  expect(onChange).toHaveBeenCalledWith('subscribed')
  expect(screen.getByRole('tabpanel', { name: '收藏' })).toBeVisible()
})
