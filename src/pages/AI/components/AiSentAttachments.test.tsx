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

function renderThread(attachments: ChatAttachment[], content = '介绍', showSentAttachmentCards = true) {
  const message: ChatMessage = {
    id: 'message', role: 'user', sessionId: 'fixture', createdAt: '2026-11-25T05:00:00Z', content,
    toolCalls: [], references: [], skillOutput: [], attachments,
  }
  return render(<AiConversationThread messages={[message]} routeSessionId="fixture" scrollRef={{ current: null }}
    onSelectArtifact={vi.fn()} showSentAttachmentCards={showSentAttachmentCards} />)
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
  expect(within(attachments).getAllByRole('listitem').map(card => card.title)).toEqual([photo.name, pdf.name, photo.name, photo.name])
  expect(container.querySelector('.ai-chat-bubble')).toBeNull()
})

it('图片打不开或没有可用地址时，按普通文件显示', () => {
  const localOnly = { ...photo, id: 'local-only', name: '没有地址.png', url: undefined }
  renderThread([photo, localOnly])
  expect(screen.getByText(localOnly.name)).toBeVisible()
  fireEvent.error(screen.getByRole('img', { name: photo.name }))
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByText(photo.name)).toBeVisible()
})

it('其他对话入口不启用新样式时保留原附件条', () => {
  const { container } = renderThread([photo], '介绍', false)
  expect(screen.queryByRole('list', { name: '已发送附件' })).not.toBeInTheDocument()
  expect(container.querySelector('.ai-chat-bubble')).toContainElement(screen.getByText(photo.name))
})
