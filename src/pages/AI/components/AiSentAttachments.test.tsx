import { render, screen, within, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { ChatAttachment, ChatMessage } from '../../../services/chat/types'
import { AiConversationThread } from './AiConversationThread'

const photo: ChatAttachment = {
  id: 'photo', kind: 'uploaded', name: '树林.jpg', status: 'completed', url: 'https://example.test/photo.jpg',
}
const pdf: ChatAttachment = {
  id: 'document', kind: 'uploaded', name: '说明.pdf', status: 'completed', url: 'https://example.test/file.pdf',
}

function renderThread(attachments: ChatAttachment[], content = '介绍', showSentAttachmentCards = true,
  onPreviewAttachment?: (file: ChatAttachment) => void) {
  const message: ChatMessage = {
    id: 'message', role: 'user', sessionId: 'fixture', createdAt: '2026-11-25T05:00:00Z', content,
    toolCalls: [], references: [], skillOutput: [], attachments,
  }
  return render(<AiConversationThread messages={[message]} routeSessionId="fixture" scrollRef={{ current: null }}
    onPreviewAttachment={onPreviewAttachment} onSelectArtifact={vi.fn()} showSentAttachmentCards={showSentAttachmentCards} />)
}

it('单张图片在文字气泡上方单独显示，图片地址不改写', () => {
  renderThread([photo])

  const attachments = screen.getByRole('list', { name: '已发送附件' })
  const bubble = screen.getByText('介绍').closest('.ai-chat-bubble')
  expect(attachments).toHaveAttribute('data-gallery', 'false')
  expect(within(attachments).getByRole('img', { name: photo.name })).toHaveAttribute('src', photo.url)
  expect(attachments.nextElementSibling).toBe(bubble)
})

it('多附件保留文件顺序，超过三项可用键盘聚焦横滑；纯附件不留空气泡', () => {
  const { container } = renderThread([photo, pdf, ...[2, 3].map(id => ({ ...photo, id: `photo-${id}` }))], '')
  const attachments = screen.getByRole('list', { name: '已发送附件' })
  expect(attachments).toHaveAttribute('data-gallery', 'true')
  expect(attachments).toHaveAttribute('tabindex', '0')
  expect(attachments.closest('.ai-chat-row')).toHaveAttribute('data-wide-file-strip')
  expect(within(attachments).getAllByRole('listitem').map(card => card.title)).toEqual([photo.name, pdf.name, photo.name, photo.name])
  expect(container.querySelector('.ai-chat-bubble')).toBeNull()
})

it('多图不使用铺满页面宽度的文件横滑区', () => {
  renderThread([photo, { ...photo, id: 'other-photo' }])
  const attachments = screen.getByRole('list', { name: '已发送附件' })
  expect(attachments).toHaveAttribute('data-gallery', 'true')
  expect(attachments.closest('.ai-chat-row')).not.toHaveAttribute('data-wide-file-strip')
})

it('图片打不开或没有可用地址时，按普通文件显示', () => {
  const localOnly = { ...photo, id: 'local-only', name: '没有地址.png', url: undefined }
  renderThread([photo, localOnly])
  expect(screen.getByText(localOnly.name)).toBeVisible()
  fireEvent.error(screen.getByRole('img', { name: photo.name }))
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByText(photo.name)).toBeVisible()
})

it('普通文件沿用资料库类型标识，点选后把原附件交给预览入口', () => {
  const onPreview = vi.fn()
  const missing = { ...pdf, id: 'missing', name: '没有地址.md', url: undefined }
  renderThread([pdf, missing], '介绍', true, onPreview)
  const fileButton = screen.getByRole('button', { name: `预览文件：${pdf.name}` })
  expect(within(fileButton).getByText('DOC')).toHaveClass('ai-file-item-content__badge')
  expect(within(fileButton).getByText('PDF')).toBeVisible()
  expect(screen.queryByRole('button', { name: '预览文件：没有地址.md' })).not.toBeInTheDocument()
  fireEvent.click(fileButton)
  expect(onPreview).toHaveBeenCalledWith(pdf)
})

it('其他对话入口不启用新样式时保留原附件条', () => {
  const { container } = renderThread([photo], '介绍', false)
  expect(screen.queryByRole('list', { name: '已发送附件' })).not.toBeInTheDocument()
  expect(container.querySelector('.ai-chat-bubble')).toContainElement(screen.getByText(photo.name))
})
