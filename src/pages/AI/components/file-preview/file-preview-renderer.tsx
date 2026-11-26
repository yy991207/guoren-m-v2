import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AiLoading } from '../AiLoading'
import { parseCourseTableArtifact, type CourseTableArtifact } from './course-table'
import type { PreviewLanguage } from './preview-language'
import { ZoomableImagePreview } from './zoomable-image-preview'
import styles from './file-preview.module.css'

type FilePreviewRendererProps = {
  fileName: string
  content: string
  language: PreviewLanguage | null
  loading: boolean
  errorMessage?: string
  emptyMessage?: string
  imageUrl?: string
  allowHtmlScripts?: boolean
}

function formatDuration(duration: number): string {
  return `${duration.toFixed(1)} 分钟`
}

function CourseTablePreview({ courseTable }: { courseTable: CourseTableArtifact }) {
  return (
    <div className={styles.courseTableWrap}>
      <div className={styles.courseTableHero}>
        <div className={styles.courseTableEyebrow}>课程表</div>
        <h2 className={styles.courseTableTitle}>{courseTable.query}主题课程安排</h2>
        <p className={styles.courseTableSummary}>
          共 {courseTable.courses.length} 门课程，总时长 {formatDuration(courseTable.total_duration)}
        </p>
      </div>

      <div className={styles.courseTableStats}>
        <div className={styles.courseTableStatCard}>
          <span className={styles.courseTableStatLabel}>课程数量</span>
          <strong className={styles.courseTableStatValue}>{courseTable.courses.length}</strong>
        </div>
        <div className={styles.courseTableStatCard}>
          <span className={styles.courseTableStatLabel}>总时长</span>
          <strong className={styles.courseTableStatValue}>{formatDuration(courseTable.total_duration)}</strong>
        </div>
      </div>

      <div className={styles.courseTableList}>
        {courseTable.courses.map((course, index) => (
          <article key={course.resource_id} className={styles.courseTableItem}>
            <div className={styles.courseTableItemIndex}>{index + 1}</div>
            <div className={styles.courseTableItemBody}>
              <h3 className={styles.courseTableItemTitle}>{course.title}</h3>
              <div className={styles.courseTableItemMeta}>
                <span>时长：{formatDuration(course.duration)}</span>
                <span>资源 ID：{course.resource_id}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

// 移植自 Web 的 file-preview-renderer：只展示正文，H5 的导航、取数和课堂状态留给外层。
export function FilePreviewRenderer({
  content, language, fileName, loading, errorMessage, emptyMessage, imageUrl, allowHtmlScripts = false,
}: FilePreviewRendererProps) {
  const courseTable = useMemo(() => language === 'json' && content ? parseCourseTableArtifact(content) : null, [content, language])

  if (loading) {
    return <div className={styles.previewLoading}><AiLoading message="正在加载文件内容，请稍候" variant="page" /></div>
  }

  if (errorMessage) {
    return (
      <div className={styles.previewLoading} role="alert">
        <div className={styles.previewLoadingCard}>
          <div className={styles.previewLoadingTitle}>预览失败</div>
          <div className={styles.previewLoadingText}>{errorMessage}</div>
        </div>
      </div>
    )
  }

  if (courseTable) {
    return (
      <div className={styles.previewStructuredWrap}>
        <CourseTablePreview courseTable={courseTable} />
      </div>
    )
  }

  if (language === 'html' && content.trim()) {
    // 交互课堂可以运行脚本，但预览文档不应获得 H5 主页面的同源权限。
    return (
      <div className={styles.previewIframeWrap}>
        <iframe
          className={styles.previewIframe}
          srcDoc={content}
          sandbox={allowHtmlScripts ? 'allow-scripts allow-forms' : ''}
          title={fileName}
        />
      </div>
    )
  }

  if (language === 'markdown' && content.trim()) {
    return (
      <div className={styles.previewMarkdownWrap}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    )
  }

  if (imageUrl) {
    return <ZoomableImagePreview key={imageUrl} name={fileName} src={imageUrl} />
  }

  if (language && content.trim()) {
    return (
      <div className={styles.previewCodeWrap}>
        <pre className={language === 'text' ? `${styles.previewCode} ${styles.previewPlainText}` : styles.previewCode}>
          <code>{content}</code>
        </pre>
      </div>
    )
  }

  return <div className={styles.previewEmpty}>{emptyMessage ?? '无法预览此文件类型'}</div>
}
