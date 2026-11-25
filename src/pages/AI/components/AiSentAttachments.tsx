import { useState } from 'react'
import { FileOutline } from 'antd-mobile-icons'
import type { ChatAttachment } from '../../../services/chat/types'
import { ZoomableImagePreview } from './file-preview/zoomable-image-preview'
import './AiSentAttachments.css'

const IMAGE_NAME = /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i
const DIRECT_IMAGE_URL = /^(?:https?:\/\/|\/(?!\/|\\))/i

function AiSentAttachment({ attachment }: { attachment: ChatAttachment }) {
  const url = attachment.url?.trim()
  const [failedUrl, setFailedUrl] = useState<string>()
  // 只读消息已有的图片地址，失效时保留文件卡片，不额外申请下载地址。
  const imageUrl = url && url !== failedUrl && IMAGE_NAME.test(attachment.name) && DIRECT_IMAGE_URL.test(url) ? url : undefined

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
        <>
          <span aria-hidden="true" className="ai-sent-attachment__icon"><FileOutline width={20} height={20} /></span>
          <span className="ai-sent-attachment__name">{attachment.name}</span>
        </>
      )}
    </li>
  )
}

export function AiSentAttachments({ attachments }: { attachments: readonly ChatAttachment[] }) {
  return (
    <ul aria-label="已发送附件" className="ai-sent-attachments" data-gallery={attachments.length > 1}
      data-overflow={attachments.length > 3} role="list" tabIndex={attachments.length > 3 ? 0 : undefined}>
      {attachments.map(attachment => <AiSentAttachment attachment={attachment} key={attachment.id} />)}
    </ul>
  )
}
