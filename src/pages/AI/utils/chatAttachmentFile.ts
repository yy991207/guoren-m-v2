import type { ChatAttachment } from '../../../services/chat/types'
import type { LibraryPageFileItem } from '../../../services/library'
import { resolvePreviewLanguage } from '../components/file-preview/preview-language'

const IMAGE_NAME = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i

export function isChatAttachmentImage(name: string): boolean {
  return IMAGE_NAME.test(name)
}

export function getChatAttachmentFileType(name: string): LibraryPageFileItem['fileType'] {
  if (isChatAttachmentImage(name)) return 'image'
  if (/\.(?:avi|mkv|mov|mp4|webm)$/i.test(name)) return 'video'
  if (/\.(?:aac|flac|m4a|mp3|ogg|wav)$/i.test(name)) return 'audio'
  if (/\.(?:pdf|docx?|pptx?|xlsx?)$/i.test(name) || resolvePreviewLanguage(name)) return 'document'
  return 'other'
}

export function getChatAttachmentPreviewUrl(attachment: ChatAttachment): string | undefined {
  if (attachment.status !== 'completed' || isChatAttachmentImage(attachment.name)) return undefined
  // 附件未必是库文件，不能把资源编号当库文件编号查询。只使用已上传的文件地址。
  const url = attachment.url?.trim()
  return url && /^https?:\/\//.test(url) ? url : undefined
}

function formatFileSize(sizeBytes: number | undefined): string | undefined {
  if (sizeBytes === undefined || !Number.isFinite(sizeBytes) || sizeBytes < 0) return undefined
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 ** 2) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / 1024 ** 2).toFixed(1)} MB`
}

export function getChatAttachmentMeta(attachment: ChatAttachment): string {
  const extension = attachment.name.match(/\.([^./]+)$/)?.[1]?.toUpperCase()
  return [extension, formatFileSize(attachment.sizeBytes)].filter(Boolean).join(' · ') || '文件'
}
