import { useState } from 'react'
import type { ChatAttachment } from '../../../services/chat/types'
import { isChatAttachmentImage } from '../utils/chatAttachmentFile'
import { AiChatAttachmentFile } from './AiChatAttachmentFile'
import { ZoomableImagePreview } from './file-preview/zoomable-image-preview'
import './AiSentAttachments.css'

const DIRECT_IMAGE_URL = /^(?:https?:\/\/|\/(?!\/|\\))/i

type AiSentAttachmentsProps = {
  attachments: readonly ChatAttachment[]
  onPreview?: (attachment: ChatAttachment) => void
}

function AiSentAttachment({ attachment, onPreview }: { attachment: ChatAttachment; onPreview: AiSentAttachmentsProps['onPreview'] }) {
  const url = attachment.url?.trim()
  const [failedUrl, setFailedUrl] = useState<string>()
  // 只读消息已有的图片地址，失效时保留文件卡片，不额外申请下载地址。
  const imageUrl = url && url !== failedUrl && isChatAttachmentImage(attachment.name) && DIRECT_IMAGE_URL.test(url) ? url : undefined

  return (
    <li className="ai-sent-attachment" data-image={Boolean(imageUrl)} title={attachment.name}>
      {imageUrl ? (
        <ZoomableImagePreview
          key={imageUrl}
          name={attachment.name}
          src={imageUrl}
          thumbnail={{
            buttonClassName: 'ai-sent-attachment__preview',
            imageClassName: 'ai-sent-attachment__photo',
            onImageError: () => setFailedUrl(imageUrl),
          }}
        />
      ) : (
        <AiChatAttachmentFile attachment={attachment} onPreview={onPreview} />
      )}
    </li>
  )
}

export function AiSentAttachments({ attachments, onPreview }: AiSentAttachmentsProps) {
  const hasGallery = attachments.length > 1
  return (
    <ul aria-label="已发送附件" className="ai-sent-attachments" data-gallery={hasGallery}
      role="list" tabIndex={hasGallery ? 0 : undefined}>
      {attachments.map(attachment => <AiSentAttachment attachment={attachment} key={attachment.id} onPreview={onPreview} />)}
    </ul>
  )
}
