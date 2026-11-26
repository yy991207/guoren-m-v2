import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchClassroomGenerateStatus } from '../../../services/classroom'
import { fetchCourseReviewResult } from '../../../services/courseReview'
import { fetchLibraryFileDetail, fetchLibraryPreviewContent, type LibraryFileDetail } from '../../../services/library'
import AiLibraryFilePreview from './AiLibraryFilePreview'

vi.mock('../../../services/library', () => ({ fetchLibraryFileDetail: vi.fn(), fetchLibraryPreviewContent: vi.fn() }))
vi.mock('../../../services/classroom', async (load) => ({ ...await load<typeof import('../../../services/classroom')>(), fetchClassroomGenerateStatus: vi.fn() }))
vi.mock('../../../services/courseReview', async (load) => ({ ...await load<typeof import('../../../services/courseReview')>(), fetchCourseReviewResult: vi.fn() }))

const detail: LibraryFileDetail = {
  fileId: 'f1', fileName: '讲义.MARKDOWN', fileType: 'document', fileUrl: '/files/lecture', filePath: 'lecture',
  agentId: null, agentName: '助手', skillName: null, sessionId: 's1', createdAt: '', sizeBytes: null,
}

function openArtifact(changes: Partial<LibraryFileDetail> = {}) {
  const file = { ...detail, ...changes }
  return render(<AiLibraryFilePreview selectedFile={file} initialDetail={file} showOpenSessionLink={false} onOpenSession={vi.fn()} onBack={vi.fn()} />)
}

beforeEach(() => { vi.resetAllMocks() })

describe('AI 文件预览入口', () => {
  it('从库按 ID 取详情，使用移动端导航，Markdown 表格正常呈现', async () => {
    vi.mocked(fetchLibraryFileDetail).mockResolvedValue(detail)
    vi.mocked(fetchLibraryPreviewContent).mockResolvedValue('|章节|\n|---|\n|绪论|')
    const onOpenSession = vi.fn()
    const onBack = vi.fn()
    render(<AiLibraryFilePreview selectedFile={detail} onOpenSession={onOpenSession} onBack={onBack} />)
    expect(await screen.findByRole('table')).toHaveTextContent('绪论')
    expect(fetchLibraryFileDetail).toHaveBeenCalledWith('f1', expect.any(AbortSignal))
    expect(screen.getAllByRole('button')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '查看对话' }))
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(onOpenSession).toHaveBeenCalledWith('s1')
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('对话使用已有详情；等待正文时有提示，切换文件取消旧请求', async () => {
    let finish!: (value: string) => void
    vi.mocked(fetchLibraryPreviewContent).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const { rerender } = openArtifact()
    expect(screen.getByRole('status')).toHaveClass('ai-loading')
    expect(screen.getByRole('status')).toHaveTextContent('正在加载文件内容，请稍候')
    expect(screen.queryByRole('button', { name: '查看对话' })).not.toBeInTheDocument()
    const signal = vi.mocked(fetchLibraryPreviewContent).mock.calls[0][1]
    const image = { ...detail, fileId: 'f2', fileName: '配图.png', fileUrl: '/images/chart.png' }
    rerender(<AiLibraryFilePreview selectedFile={image} initialDetail={image} onOpenSession={vi.fn()} onBack={vi.fn()} />)
    expect(await screen.findByRole('img', { name: '配图.png' })).toHaveAttribute('src', image.fileUrl)
    expect(signal?.aborted).toBe(true)
    await act(async () => { finish('旧文件的内容') })
    expect(screen.queryByText('旧文件的内容')).not.toBeInTheDocument()
    expect(fetchLibraryFileDetail).not.toHaveBeenCalled()
    expect(fetchLibraryPreviewContent).toHaveBeenCalledOnce()
  })

  it.each(['notes.pdf', 'notes.docx', 'notes.xlsx', 'notes.pptx', 'notes.mp4'])('%s 不作为文本下载', async (fileName) => {
    openArtifact({ fileName })
    expect(await screen.findByText('无法预览此文件类型')).toBeVisible()
    expect(fetchLibraryPreviewContent).not.toHaveBeenCalled()
  })

  it('已识别的文件缺少地址时仅展示空提示', async () => {
    openArtifact({ fileUrl: '' })
    expect(await screen.findByText('当前文件暂无可预览内容。')).toBeVisible()
    expect(screen.queryByText('无法预览此文件类型')).not.toBeInTheDocument()
    expect(fetchLibraryPreviewContent).not.toHaveBeenCalled()
  })

  it('只展示实际的请求错误', async () => {
    vi.mocked(fetchLibraryPreviewContent).mockRejectedValue(new Error('预览请求失败'))
    openArtifact()
    expect(await screen.findByRole('alert')).toHaveTextContent('预览请求失败')
    expect(screen.queryByText('无法预览此文件类型')).not.toBeInTheDocument()
  })

  it('课程表 JSON 展示课程卡片', async () => {
    vi.mocked(fetchLibraryPreviewContent).mockResolvedValue(JSON.stringify({
      type: 'course_table', query: '物理', total_duration: 25, courses: [{ resource_id: 'lesson1', title: '光的折射', duration: 25 }],
    }))
    openArtifact({ fileName: '课表.JSON' })
    expect(await screen.findByRole('heading', { name: '物理主题课程安排' })).toBeVisible()
    expect(screen.getByRole('article')).toHaveTextContent('光的折射')
  })

  it.each([
    ['课程.json', '{"type":"course_table"}'], ['说明.json', '{"title":'], ['demo.ts', 'const n = 1'], ['notes.txt', '普通正文'],
  ])('%s 按原文而不是课程卡片展示', async (fileName, content) => {
    vi.mocked(fetchLibraryPreviewContent).mockResolvedValue(content)
    openArtifact({ fileName })
    expect((await screen.findByText(content)).closest('pre')).not.toBeNull()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('普通 HTML 不获脚本权限', async () => {
    vi.mocked(fetchLibraryPreviewContent).mockResolvedValue('<h1>教学报告</h1>')
    openArtifact({ fileName: '教学报告.htm' })
    const frame = await screen.findByTitle('教学报告.htm')
    expect(frame).toHaveAttribute('srcdoc', '<h1>教学报告</h1>')
    expect(frame).toHaveAttribute('sandbox', '')
  })

  it('交互课堂沿用状态接口取结果，嵌入时与主页面隔离', async () => {
    vi.mocked(fetchClassroomGenerateStatus).mockResolvedValue({ status: 'completed', result: { classroom_url: '/class/42' } })
    vi.mocked(fetchLibraryPreviewContent).mockResolvedValue('<main>课堂</main>')
    openArtifact({ fileType: 'classroom', fileName: '课堂', filePath: 'task42' })
    expect(await screen.findByTitle('课堂')).toHaveAttribute('sandbox', 'allow-scripts allow-forms')
    expect(fetchClassroomGenerateStatus).toHaveBeenCalledWith('task42', expect.any(AbortSignal))
    expect(fetchLibraryPreviewContent).toHaveBeenCalledWith('/class/42', expect.any(AbortSignal))
  })

  it.each([['processing', '生成中'], ['failed', '生成失败']])('课堂 %s 沿用专用状态卡', async (status, label) => {
    vi.mocked(fetchClassroomGenerateStatus).mockResolvedValue({ status, progress: 10 })
    openArtifact({ fileType: 'classroom' })
    expect(await screen.findByText(label)).toBeVisible()
    expect(fetchLibraryPreviewContent).not.toHaveBeenCalled()
  })

  it('评课生成中不请求正文', async () => {
    vi.mocked(fetchCourseReviewResult).mockResolvedValue({ status: 'pending', message: '正在评课' })
    openArtifact({ fileType: 'review' })
    expect(await screen.findByText('正在评课')).toBeVisible()
    expect(fetchLibraryPreviewContent).not.toHaveBeenCalled()
  })

  it('就绪的评课使用接口的内容语言，而不是文件后缀', async () => {
    vi.mocked(fetchCourseReviewResult).mockResolvedValue({ report_markdown: '# 听课反馈' })
    openArtifact({ fileType: 'review', fileName: '评课报告' })
    expect(await screen.findByRole('heading', { name: '听课反馈' })).toBeVisible()
    expect(fetchLibraryPreviewContent).not.toHaveBeenCalled()
  })
})
