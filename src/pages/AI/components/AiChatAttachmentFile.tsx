import type { ChatAttachment } from '../../../services/chat/types'
import { getChatAttachmentFileType, getChatAttachmentMeta, getChatAttachmentPreviewUrl } from '../utils/chatAttachmentFile'
import { AiFileItemContent } from './AiFileItemContent'
import './AiChatAttachmentFile.css'

type AiChatAttachmentFileProps = {
  attachment: ChatAttachment
  status?: string | null
  onPreview?: (attachment: ChatAttachment) => void
}

export function AiChatAttachmentFile({ attachment, status, onPreview }: AiChatAttachmentFileProps) {
  const content = <AiFileItemContent
    compact
    fileType={getChatAttachmentFileType(attachment.name)}
    name={attachment.name}
    meta={<>{status && <><span>{status}</span>{' · '}</>}{getChatAttachmentMeta(attachment)}</>}
  />

  if (onPreview && getChatAttachmentPreviewUrl(attachment)) {
    return (
      <button aria-label={`预览文件：${attachment.name}`} className="ai-chat-attachment-file" type="button"
        onClick={() => onPreview(attachment)}>
        {content}
      </button>
    )
  }

  return <div className="ai-chat-attachment-file">{content}</div>
}
