import { useEffect, useState } from 'react'
import { CloseOutline, FileOutline } from 'antd-mobile-icons'
import type { ChatAttachment } from '../../../services/chat/types'
import './AiDraftAttachments.css'

type AiDraftAttachmentsProps = {
  attachments: readonly ChatAttachment[]
  imageFiles: ReadonlyMap<string, File>
  onRemove: (id: string) => void
}

function AiDraftAttachment({ attachment, imageFile, onRemove }: {
  attachment: ChatAttachment
  imageFile?: File
  onRemove: AiDraftAttachmentsProps['onRemove']
}) {
  const [previewUrl, setPreviewUrl] = useState<string>()

  useEffect(() => {
    if (!imageFile) return
    // 缩略图只读本地文件，不使用上传地址；附件移除或界面卸载时释放临时地址。
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const thumbnail = imageFile && previewUrl
  const status = attachment.status === 'uploading' ? '上传中'
    : attachment.status === 'parsing' ? '解析中'
      : attachment.kind === 'resource' ? '资料库' : null

  return (
    <li className="ai-draft-attachment" data-thumbnail={Boolean(thumbnail)} title={attachment.name}>
      {thumbnail ? (
        <img alt={attachment.name} className="ai-draft-attachment__thumbnail" decoding="async" draggable={false}
          loading="lazy" src={thumbnail} onError={() => setPreviewUrl(undefined)} />
      ) : (
        <>
          <span aria-hidden="true" className="ai-draft-attachment__file-icon"><FileOutline width={19} height={19} /></span>
          <span className="ai-draft-attachment__name">{attachment.name}</span>
        </>
      )}
      {status && <span className="ai-draft-attachment__status">{status}</span>}
      <button aria-label={`${attachment.name} 删除附件`} className="ai-draft-attachment__remove" type="button"
        onClick={() => onRemove(attachment.id)}>
        <span><CloseOutline aria-hidden="true" width={10} height={10} /></span>
      </button>
    </li>
  )
}

export function AiDraftAttachments({ attachments, imageFiles, onRemove }: AiDraftAttachmentsProps) {
  return (
    <ul aria-label="待发送附件" className="ai-draft-attachments" role="list" tabIndex={0}>
      {attachments.map(attachment => (
        <AiDraftAttachment key={attachment.id} attachment={attachment}
          imageFile={imageFiles.get(attachment.id)} onRemove={onRemove} />
      ))}
    </ul>
  )
}
