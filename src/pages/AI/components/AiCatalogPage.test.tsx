import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AiCatalogPage } from './AiCatalogPage'

it('分类碰到滚动区顶部才拼到页头，往回滚同一组标签恢复原位', () => {
  const onCategoryChange = vi.fn()
  const { container } = render(<AiCatalogPage
    categories={[
      { key: 'all', label: '全部', content: '列表' },
      { key: 'mine', label: '我的', content: '我的列表' },
    ]}
    category="all"
    categoryLabel="分类"
    search={{ value: '', placeholder: '搜索', onChange: vi.fn() }}
    title="列表"
    onBack={vi.fn()}
    onCategoryChange={onCategoryChange}
  />)
  const page = container.querySelector('.ai-catalog-page') as HTMLElement
  const scroller = container.querySelector('.ai-catalog-content') as HTMLElement
  const intro = container.querySelector('.ai-catalog-intro') as HTMLElement
  vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 56, 320, 480))
  vi.spyOn(intro, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 56 - scroller.scrollTop, 320, 100))
  const tabs = screen.getByRole('tablist', { name: '分类' })
  const active = within(tabs).getByRole('tab', { name: '全部' })
  active.focus()

  scroller.scrollTop = 99
  fireEvent.scroll(scroller)
  expect(page).not.toHaveAttribute('data-tabs-docked')
  scroller.scrollTop = 100
  fireEvent.scroll(scroller)
  expect(page).toHaveAttribute('data-tabs-docked')
  expect(screen.getByRole('tablist')).toBe(tabs)
  expect(active).toHaveFocus()

  scroller.scrollTop = 220
  fireEvent.scroll(scroller)
  fireEvent.click(within(tabs).getByRole('tab', { name: '我的' }))
  expect(onCategoryChange).toHaveBeenCalledWith('mine')
  expect(scroller.scrollTop).toBe(100)
  scroller.scrollTop = 99
  fireEvent.scroll(scroller)
  expect(page).not.toHaveAttribute('data-tabs-docked')
  expect(screen.getByRole('tablist')).toBe(tabs)
})
