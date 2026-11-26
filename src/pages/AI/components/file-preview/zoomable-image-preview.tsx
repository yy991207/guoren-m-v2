import { ImageViewer } from 'antd-mobile'
import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import styles from './file-preview.module.css'

type ZoomableImagePreviewProps = {
  src: string
  name: string
  thumbnail?: {
    buttonClassName: string
    imageClassName: string
    onImageError?: () => void
  }
}

export function ZoomableImagePreview({ src, name, thumbnail }: ZoomableImagePreviewProps) {
  const [expanded, setExpanded] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeOnClickRef = useRef(false)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!expanded || !dialog) return
    // 原生弹层覆盖底栏并管理焦点；缩放手势仅在大图内生效。
    closeOnClickRef.current = false
    dialog.showModal()
    return () => dialog.close()
  }, [expanded])

  const closeFromClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    closeOnClickRef.current = false
    setExpanded(false)
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label={`查看大图：${name}`}
        className={thumbnail?.buttonClassName ?? styles.previewImageWrap}
        type="button"
        onClick={() => setExpanded(true)}
      >
        <img
          alt={name}
          className={thumbnail?.imageClassName ?? styles.previewImage}
          decoding="async"
          draggable={thumbnail ? false : undefined}
          loading={thumbnail ? 'lazy' : undefined}
          src={src}
          onError={thumbnail?.onImageError}
        />
        {!thumbnail && <span className={styles.imageHint}>点开大图 · 双指缩放</span>}
      </button>
      {expanded && (
        <dialog
          aria-label={`大图：${name}`}
          className={styles.imageDialog}
          ref={dialogRef}
          onCancel={(event) => { event.preventDefault(); setExpanded(false) }}
          onPointerDownCapture={() => { closeOnClickRef.current = false }}
          onClickCapture={(event) => {
            if (closeOnClickRef.current) closeFromClick(event)
          }}
        >
          <ImageViewer
            image={src}
            imageRender={(url, { ref }) => <img alt={name} draggable={false} ref={ref} src={url} />}
            onClose={() => {
              // 手势抬起只标记单击，等浏览器的 click 在弹层内被消费后再关闭，防止点到下层页面。
              closeOnClickRef.current = true
            }}
            visible
          />
          <button autoFocus className={styles.closeImage} type="button" onClick={closeFromClick}>关闭大图</button>
        </dialog>
      )}
    </>
  )
}
