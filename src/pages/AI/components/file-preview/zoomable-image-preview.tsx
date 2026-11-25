import { ImageViewer } from 'antd-mobile'
import { useLayoutEffect, useRef, useState } from 'react'
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

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!expanded || !dialog) return
    // 原生弹层覆盖底栏并管理焦点；缩放手势仅在大图内生效。
    dialog.showModal()
    return () => dialog.close()
  }, [expanded])

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
        >
          <ImageViewer
            image={src}
            imageRender={(url, { ref }) => <img alt={name} draggable={false} ref={ref} src={url} />}
            onClose={() => setExpanded(false)}
            visible
          />
          <button autoFocus className={styles.closeImage} type="button" onClick={() => setExpanded(false)}>关闭大图</button>
        </dialog>
      )}
    </>
  )
}
