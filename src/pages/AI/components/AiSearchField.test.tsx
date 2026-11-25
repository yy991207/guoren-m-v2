import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { fetchLibraryPageFiles } from '../../../services/library'
import { AiSearchField } from './AiSearchField'
import AiSidebarLibraryPage from './AiSidebarLibraryPage'

vi.mock('../../../services/library', async load => ({
  ...await load<typeof import('../../../services/library')>(),
  fetchLibraryPageFiles: vi.fn(),
}))

it('搜索词由页面控制；原样传递输入和清空，不自行裁剪空格或提交', () => {
  const onChange = vi.fn()
  const props = { label: '搜索我的技能', placeholder: '搜索', onChange }
  const { rerender } = render(<AiSearchField {...props} value="" />)
  const field = screen.getByRole('searchbox', { name: '搜索我的技能' })
  expect(field).toHaveAttribute('maxlength', '200')
  fireEvent.change(field, { target: { value: '  示例' } })
  expect(onChange).toHaveBeenLastCalledWith('  示例')
  rerender(<AiSearchField {...props} value="  示例" />)
  expect(field).toHaveValue('  示例')
  fireEvent.change(field, { target: { value: '' } })
  expect(onChange).toHaveBeenLastCalledWith('')
})

it('库搜索展开后聚焦、关键字按原规则查询，点外部收起后再次展开仍保留输入', async () => {
  vi.mocked(fetchLibraryPageFiles).mockResolvedValue([])
  render(<AiSidebarLibraryPage onBack={vi.fn()} onOpenSession={vi.fn()} />)
  await screen.findByText('当前没有可展示的库文件。')
  const expand = () => fireEvent.click(screen.getByRole('button', { name: '展开搜索' }))
  const input = () => screen.getByRole('searchbox', { name: '搜索库文件' })
  expand()
  expect(input()).toHaveFocus()
  expect(screen.queryByRole('button', { name: /全部来源/ })).not.toBeInTheDocument()
  fireEvent.change(input(), { target: { value: '  教案  ' } })
  await waitFor(() => expect(fetchLibraryPageFiles).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '教案' })))
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /全部来源/ })).toBeVisible()
  expand()
  expect(input()).toHaveValue('  教案  ')
  expect(fetchLibraryPageFiles).toHaveBeenCalledTimes(2)
})
