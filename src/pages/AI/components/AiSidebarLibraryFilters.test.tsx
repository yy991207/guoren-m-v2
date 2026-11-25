import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { fetchLibraryPageFiles, type LibraryPageFileItem } from '../../../services/library'
import { AiSidebarLibraryPage } from './AiSidebarLibraryPage'

vi.mock('../../../services/library', async load => ({
  ...await load<typeof import('../../../services/library')>(),
  fetchLibraryPageFiles: vi.fn(),
}))

const documentFile: LibraryPageFileItem = {
  fileId: 'document-id',
  fileName: '示例教案.md',
  agentName: '课程智能体',
  fileType: 'document',
  filePath: '示例教案.md',
  createdAt: '',
  sessionId: 'document-session',
  agentId: null,
  skillName: null,
}
const imageFile: LibraryPageFileItem = {
  ...documentFile,
  fileId: 'image-id',
  fileName: '课堂照片.png',
  agentName: '通用智能体',
  fileType: 'image',
}

const sourceButton = () => screen.getByRole('button', { name: /^来源/ })
const typeButton = () => screen.getByRole('button', { name: /^类型/ })
const menu = (label: string) => screen.getByRole('group', { name: `选择${label}` })

beforeEach(() => {
  vi.mocked(fetchLibraryPageFiles).mockReset().mockImplementation(async ({ fileType }) => (
    fileType === 'all' ? [documentFile, imageFile] : [documentFile, imageFile].filter(file => file.fileType === fileType)
  ))
})

it('来源在当前结果中本地筛选，选中立即关闭，重开显示当前选项', async () => {
  render(<AiSidebarLibraryPage onBack={vi.fn()} onOpenSession={vi.fn()} />)
  await screen.findByText('课堂照片.png')

  fireEvent.click(sourceButton())
  expect(within(menu('来源')).getByRole('button', { name: '全部来源', pressed: true })).toBeVisible()
  fireEvent.click(within(menu('来源')).getByRole('button', { name: '课程智能体' }))
  expect(screen.queryByRole('group', { name: '选择来源' })).not.toBeInTheDocument()
  expect(sourceButton()).toHaveTextContent('课程智能体')
  expect(screen.getByText('示例教案.md')).toBeVisible()
  expect(screen.queryByText('课堂照片.png')).not.toBeInTheDocument()
  expect(fetchLibraryPageFiles).toHaveBeenCalledTimes(1)

  fireEvent.click(sourceButton())
  expect(within(menu('来源')).getByRole('button', { name: '课程智能体', pressed: true }).querySelector('svg')).not.toBeNull()
  fireEvent.click(screen.getByText('库', { exact: true }))
  expect(sourceButton()).toHaveAttribute('aria-expanded', 'false')
})

it('切换筛选按钮只打开新菜单，选择类型按原参数请求', async () => {
  render(<AiSidebarLibraryPage onBack={vi.fn()} onOpenSession={vi.fn()} />)
  await screen.findByText('课堂照片.png')

  fireEvent.click(sourceButton())
  fireEvent.click(typeButton())
  expect(sourceButton()).toHaveAttribute('aria-expanded', 'false')
  expect(typeButton()).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(within(menu('类型')).getByRole('button', { name: '文档' }))
  expect(typeButton()).toHaveAttribute('aria-expanded', 'false')
  expect(typeButton()).toHaveTextContent('文档')
  await waitFor(() => expect(fetchLibraryPageFiles).toHaveBeenLastCalledWith(expect.objectContaining({ fileType: 'document', keyword: '' })))
  expect(fetchLibraryPageFiles).toHaveBeenCalledTimes(2)
  expect(await screen.findByText('示例教案.md')).toBeVisible()
  expect(screen.queryByText('课堂照片.png')).not.toBeInTheDocument()
})
