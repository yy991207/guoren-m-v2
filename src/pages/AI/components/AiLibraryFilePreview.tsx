import { useEffect, useMemo, useState } from 'react'
import { FilePreviewRenderer } from './file-preview/file-preview-renderer'
import { resolvePreviewLanguage, type PreviewLanguage } from './file-preview/preview-language'
import { fetchClassroomGenerateStatus, resolveClassroomPreviewState, type ClassroomPreviewState } from '../../../services/classroom'
import { fetchCourseReviewResult, resolveCourseReviewPreviewPayload, type CourseReviewPreviewPayload } from '../../../services/courseReview'
import {
  fetchLibraryFileDetail,
  fetchLibraryPreviewContent,
  type LibraryFileDetail,
  type LibraryPageFileItem,
} from '../../../services/library'
import './AiSidebarLibraryPage.css'

type AiLibraryFilePreviewProps = {
  selectedFile: LibraryPageFileItem
  initialDetail?: LibraryFileDetail | null
  showOpenSessionLink?: boolean
  onBack: () => void
  onOpenSession: (sessionId: string) => void
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function isImageFile(detail: LibraryFileDetail): boolean {
  if (detail.fileType === 'image') {
    return true
  }

  const ext = detail.fileName.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)
}

function isImSession(sessionId: string): boolean {
  return sessionId.includes('_im_')
}

export default function AiLibraryFilePreview({
  selectedFile,
  initialDetail = null,
  showOpenSessionLink = true,
  onBack,
  onOpenSession,
}: AiLibraryFilePreviewProps) {
  const [previewDetail, setPreviewDetail] = useState<LibraryFileDetail | null>(null)
  const [previewContent, setPreviewContent] = useState('')
  const [previewLanguage, setPreviewLanguage] = useState<PreviewLanguage | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState('')
  const [classroomPreview, setClassroomPreview] = useState<ClassroomPreviewState | null>(null)
  const [reviewPreview, setReviewPreview] = useState<CourseReviewPreviewPayload | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      setPreviewLoading(true)
      setPreviewError('')
      setPreviewContent('')
      setPreviewLanguage(null)
      setPreviewDetail(initialDetail)
      setClassroomPreview(null)
      setReviewPreview(null)

      try {
        const detail = initialDetail ?? await fetchLibraryFileDetail(selectedFile.fileId, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setPreviewDetail(detail)

        // 对齐 PC：课堂和评课先走各自的结果接口，普通文档再走通用预览接口。
        if (detail.fileType === 'classroom') {
          const classroomResult = await fetchClassroomGenerateStatus(detail.filePath, controller.signal)
          const resolvedClassroomPreview = resolveClassroomPreviewState(classroomResult)

          if (!controller.signal.aborted) {
            setClassroomPreview(resolvedClassroomPreview)
          }

          if (resolvedClassroomPreview.tone !== 'ready' || !resolvedClassroomPreview.classroomUrl) {
            return
          }

          const nextContent = await fetchLibraryPreviewContent(resolvedClassroomPreview.classroomUrl, controller.signal)

          if (!controller.signal.aborted) {
            setPreviewContent(nextContent)
            setPreviewLanguage('html')
          }

          return
        }

        if (detail.fileType === 'review') {
          const reviewResult = await fetchCourseReviewResult(detail.filePath, controller.signal)

          if (controller.signal.aborted) {
            return
          }

          const resolvedReviewPreview = resolveCourseReviewPreviewPayload(reviewResult)
          setReviewPreview(resolvedReviewPreview)

          if (resolvedReviewPreview.pendingMessage) {
            return
          }

          if (resolvedReviewPreview.externalUrl) {
            const nextContent = await fetchLibraryPreviewContent(resolvedReviewPreview.externalUrl, controller.signal)

            if (!controller.signal.aborted) {
              setPreviewContent(nextContent)
              setPreviewLanguage(resolvedReviewPreview.language)
            }

            return
          }

          setPreviewContent(resolvedReviewPreview.content)
          setPreviewLanguage(resolvedReviewPreview.language)
          return
        }

        if (isImageFile(detail) || detail.fileType === 'video' || detail.fileType === 'audio') {
          return
        }

        const language = resolvePreviewLanguage(detail.fileName)
        setPreviewLanguage(language)
        if (!language || !detail.fileUrl) return

        const nextContent = await fetchLibraryPreviewContent(detail.fileUrl, controller.signal)
        if (!controller.signal.aborted) setPreviewContent(nextContent)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setPreviewError(loadError instanceof Error ? loadError.message : '文件详情加载失败')
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [initialDetail, selectedFile.fileId])

  const previewFile = previewDetail ?? null
  const previewName = previewFile?.fileName || selectedFile.fileName
  const canViewSession = useMemo(() => {
    return showOpenSessionLink && Boolean(selectedFile.sessionId) && !isImSession(selectedFile.sessionId)
  }, [selectedFile.sessionId, showOpenSessionLink])
  const isImage = previewFile !== null && isImageFile(previewFile)
  const showBusinessStatus = !previewLoading && !previewError

  return (
    <div className="ai-library-hub-page">
      <div className="ai-library-hub-preview-topbar">
        <button aria-label="返回" className="ai-library-hub-header-btn" type="button" onClick={onBack}>
          <BackIcon />
        </button>
        <div className="ai-library-hub-preview-title">{previewName}</div>
        {canViewSession ? (
          <button
            className="ai-library-hub-link-btn"
            type="button"
            onClick={() => onOpenSession(selectedFile.sessionId)}
          >
            查看对话
          </button>
        ) : (
          <div className="ai-library-hub-header-spacer" />
        )}
      </div>

      <div className="ai-library-hub-preview-body">
        {showBusinessStatus && classroomPreview && classroomPreview.tone !== 'ready' ? (
          <div className="ai-library-hub-status-card" role="status">
            <div className={`ai-library-hub-status-badge is-${classroomPreview.tone}`}>{classroomPreview.statusLabel}</div>
            <div className="ai-library-hub-status-desc">{classroomPreview.detail}</div>
          </div>
        ) : showBusinessStatus && reviewPreview?.pendingMessage ? (
          <div className="ai-library-hub-empty" role="status">{reviewPreview.pendingMessage}</div>
        ) : (
          <FilePreviewRenderer
            allowHtmlScripts={previewFile?.fileType === 'classroom'}
            content={previewContent}
            emptyMessage={previewLanguage || isImage ? '当前文件暂无可预览内容。' : undefined}
            errorMessage={previewError}
            fileName={previewName}
            imageUrl={isImage ? previewFile.fileUrl : undefined}
            language={previewLanguage}
            loading={previewLoading}
          />
        )}
      </div>
    </div>
  )
}
