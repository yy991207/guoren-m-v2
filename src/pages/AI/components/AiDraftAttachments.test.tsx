import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ChatAttachment } from '../../../services/chat/types'
import { AiDraftAttachments } from './AiDraftAttachments'

const picture: ChatAttachment = {
  id: 'picture', name: '照片.jpg', kind: 'uploaded', status: 'completed', url: 'https://example.test/file.jpg',
}
const document: ChatAttachment = { id: 'pdf', name: '材料.pdf', kind: 'uploaded', status: 'parsing' }

function mockLocalPreview() {
  const create = vi.fn(() => 'blob:attachment-fixture')
  const revoke = vi.fn()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = create
    static revokeObjectURL = revoke
  })
  return { create, revoke }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('本地图片显示缩略图，文档保留进度；删除调用原回调并释放缩略图', () => {
  const { create, revoke } = mockLocalPreview()
  const file = new File(['fixture'], '照片.jpg', { type: 'image/jpeg' })
  const imageFiles = new Map([[picture.id, file]])
  const onRemove = vi.fn()
  const { rerender } = render(<AiDraftAttachments attachments={[picture, document]} imageFiles={imageFiles} onRemove={onRemove} />)

  expect(screen.getByRole('list', { name: '待发送附件' })).toHaveAttribute('tabindex', '0')
  expect(screen.getByRole('img', { name: '照片.jpg' })).toHaveAttribute('src', 'blob:attachment-fixture')
  expect(create).toHaveBeenCalledWith(file)
  expect(screen.getByText('材料.pdf')).toBeVisible()
  expect(screen.getByText('解析中')).toBeVisible()
  expect(screen.queryByText('已就绪')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '照片.jpg 删除附件' }))
  expect(onRemove).toHaveBeenCalledWith(picture.id)
  rerender(<AiDraftAttachments attachments={[document]} imageFiles={new Map()} onRemove={onRemove} />)
  expect(revoke).toHaveBeenCalledWith('blob:attachment-fixture')
})

it('完成的普通文件可预览、可删除，解析中的文件只显示进度', () => {
  const uploaded: ChatAttachment = { ...document, id: 'ready', name: '说明.md', status: 'completed', sizeBytes: 1024,
    url: 'https://example.test/readme.md' }
  const onPreview = vi.fn()
  const onRemove = vi.fn()
  render(<AiDraftAttachments attachments={[uploaded, document]} imageFiles={new Map()} onPreview={onPreview} onRemove={onRemove} />)

  expect(screen.getByText('MD · 1.0 KB')).toBeVisible()
  expect(screen.getByText('解析中')).toBeVisible()
  expect(screen.queryByRole('button', { name: '预览文件：材料.pdf' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '预览文件：说明.md' }))
  expect(onPreview).toHaveBeenCalledWith(uploaded)
  fireEvent.click(screen.getByRole('button', { name: '说明.md 删除附件' }))
  expect(onRemove).toHaveBeenCalledWith('ready')
  expect(onPreview).toHaveBeenCalledTimes(1)
})

it('图片无法解码时保留文件名、上传状态和删除入口', () => {
  mockLocalPreview()
  const file = new File(['fixture'], '照片.jpg', { type: 'image/jpeg' })
  render(<AiDraftAttachments attachments={[{ ...picture, status: 'uploading' }]} imageFiles={new Map([[picture.id, file]])} onRemove={vi.fn()} />)

  fireEvent.error(screen.getByRole('img', { name: '照片.jpg' }))
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByText('照片.jpg')).toBeVisible()
  expect(screen.getByText('上传中')).toBeVisible()
  expect(screen.getByRole('button', { name: '照片.jpg 删除附件' })).toBeEnabled()
})
