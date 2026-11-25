import { ImageViewer } from 'antd-mobile'
import { useLayoutEffect, useRef, useState } from 'react'
import styles from './file-preview.module.css'

export function ZoomableImagePreview({ src, name }: { src: string; name: string }) {
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
        className={styles.previewImageWrap}
        type="button"
        onClick={() => setExpanded(true)}
      >
        <img className={styles.previewImage} src={src} alt={name} decoding="async" />
        <span className={styles.imageHint}>点开大图 · 双指缩放</span>
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
