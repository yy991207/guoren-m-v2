import { Toast } from 'antd-mobile'
import { LeftOutline } from 'antd-mobile-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchKnowledgeSpaces,
  fetchLibraryFileDownloadUrl,
  fetchLibraryPageFiles,
  saveLibraryFileToOrganizationResource,
  saveLibraryFileToPersonalResource,
  type KnowledgeSpaceOption,
  type LibraryPageFileItem,
  type LibraryPageFileType,
} from '../../../services/library'
import AiLibraryFilePreview from './AiLibraryFilePreview'
import { AiLoading } from './AiLoading'
import { AiBottomSheet } from './AiBottomSheet'
import { AiFilterDropdown } from './AiFilterDropdown'
import { AiFileItemContent } from './AiFileItemContent'
import { AiSearchField, AiSearchTrigger } from './AiSearchField'
import './AiSidebarLibraryPage.css'

type AiSidebarLibraryPageProps = {
  onBack: () => void
  onOpenSession: (sessionId: string) => void
}

type FilterMenuKey = 'source' | 'type'

const LAST_SELECTED_ORG_ID_KEY = 'LAST_SELECTED_ORG_ID'

const FILE_TYPE_FILTERS: Array<{ key: LibraryPageFileType; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'document', label: '文档' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
  { key: 'classroom', label: '课堂' },
  { key: 'review', label: '评课' },
  { key: 'whiteboard', label: '白板' },
  { key: 'other', label: '其他' },
]

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  )
}

function getFileTypeLabel(fileType: Exclude<LibraryPageFileType, 'all'>): string {
  if (fileType === 'document') return '文档'
  if (fileType === 'image') return '图片'
  if (fileType === 'video') return '视频'
  if (fileType === 'audio') return '音频'
  if (fileType === 'classroom') return '课堂'
  if (fileType === 'review') return '评课'
  if (fileType === 'whiteboard') return '白板'
  return '其他'
}

function formatDateTime(value: string): string {
  if (!value) {
    return '时间未知'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(/\//g, '-')
}

function isImSession(sessionId: string): boolean {
  return sessionId.includes('_im_')
}

function getSourceDisplayText(item: LibraryPageFileItem): string {
  if (!item.agentName) {
    return '未命名来源'
  }

  // 这里和 PC 端文件库保持一致：IM 产物统一在来源前补 IM-，便于用户区分普通会话和 IM 会话结果。
  return isImSession(item.sessionId) ? `IM-${item.agentName}` : item.agentName
}

function buildListMeta(item: LibraryPageFileItem): string {
  return [
    getSourceDisplayText(item),
    getFileTypeLabel(item.fileType),
    formatDateTime(item.createdAt),
  ].join(' · ')
}

function triggerBrowserDownload(downloadUrl: string, fileName: string) {
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = fileName
  link.rel = 'noreferrer'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function AiSidebarLibraryPage({
  onBack,
  onOpenSession,
}: AiSidebarLibraryPageProps) {
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState<LibraryPageFileType>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [openFilterMenu, setOpenFilterMenu] = useState<FilterMenuKey | null>(null)
  const [files, setFiles] = useState<LibraryPageFileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<LibraryPageFileItem | null>(null)
  const [knowledgeSpaces, setKnowledgeSpaces] = useState<KnowledgeSpaceOption[]>([])
  const [actionTargetFile, setActionTargetFile] = useState<LibraryPageFileItem | null>(null)
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const toolbarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim())
    }, 300)

    return () => {
      window.clearTimeout(timer)
    }
  }, [keyword])

  useEffect(() => {
    if (!isSearchOpen) {
      return
    }

    // 搜索框仍在点工具栏外部时收起；筛选菜单由 Ant Design Mobile 处理外部点击。
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (toolbarRef.current?.contains(target)) {
        return
      }

      setIsSearchOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isSearchOpen])

  useEffect(() => {
    const controller = new AbortController()

    void (async () => {
      setLoading(true)
      setError('')

      try {
        // “库”对齐 PC 文件库接口：类型筛选走接口，来源筛选继续在当前结果集里本地收口。
        const nextFiles = await fetchLibraryPageFiles({
          agentType: 'all',
          fileType: fileTypeFilter,
          keyword: debouncedKeyword,
          signal: controller.signal,
        })

        if (controller.signal.aborted) {
          return
        }

        setFiles(nextFiles)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setFiles([])
          setError(loadError instanceof Error ? loadError.message : '库文件加载失败')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [debouncedKeyword, fileTypeFilter])

  const sourceOptions = useMemo(() => {
    return [
      'all',
      ...Array.from(new Set(files.map((item) => getSourceDisplayText(item)).filter(Boolean))),
    ]
  }, [files])

  const sourceMenuOptions = useMemo(() => (
    sourceOptions.map((source) => ({
      value: source,
      label: source === 'all' ? '全部来源' : source,
    }))
  ), [sourceOptions])

  const typeMenuOptions = useMemo(() => (
    FILE_TYPE_FILTERS.map((filter) => ({
      value: filter.key,
      label: filter.label,
    }))
  ), [])

  useEffect(() => {
    if (!sourceOptions.includes(sourceFilter)) {
      setSourceFilter('all')
    }
  }, [sourceFilter, sourceOptions])

  useEffect(() => {
    if (!actionTargetFile && !selectedFile) {
      return
    }

    setOpenFilterMenu(null)
  }, [actionTargetFile, selectedFile])

  const visibleFiles = useMemo(() => {
    if (sourceFilter === 'all') {
      return files
    }

    return files.filter((item) => getSourceDisplayText(item) === sourceFilter)
  }, [files, sourceFilter])

  const loadKnowledgeSpaceOptions = async (): Promise<KnowledgeSpaceOption[]> => {
    const nextSpaces = await fetchKnowledgeSpaces()
    setKnowledgeSpaces(nextSpaces)
    return nextSpaces
  }

  const resolveOrganizationOwnerId = async (): Promise<string> => {
    let savedOrgId = ''

    try {
      savedOrgId = localStorage.getItem(LAST_SELECTED_ORG_ID_KEY)?.trim() || ''
    } catch {
      savedOrgId = ''
    }

    if (savedOrgId) {
      return savedOrgId
    }

    if (knowledgeSpaces[0]?.id) {
      return knowledgeSpaces[0].id
    }

    const nextSpaces = await loadKnowledgeSpaceOptions()
    return nextSpaces[0]?.id?.trim() || ''
  }

  const changeFilterVisibility = (menu: FilterMenuKey, visible: boolean) => {
    // 切到另一项时，旧菜单的外部关闭事件不能把新菜单一起关掉。
    setOpenFilterMenu(current => visible ? menu : current === menu ? null : current)
  }

  const closeActionSheet = () => {
    if (actionLoadingKey) {
      return
    }

    setActionTargetFile(null)
  }

  const handleViewSession = (item: LibraryPageFileItem) => {
    if (!item.sessionId || isImSession(item.sessionId)) {
      return
    }

    setActionTargetFile(null)
    onOpenSession(item.sessionId)
  }

  const handleOpenLibraryFile = async (item: LibraryPageFileItem) => {
    setSelectedFile(item)
  }

  const handleDownloadFile = async (item: LibraryPageFileItem) => {
    if (!item.filePath.trim()) {
      Toast.show({ content: '缺少文件路径，暂时无法下载' })
      return
    }

    try {
      setActionLoadingKey('download')
      const downloadUrl = await fetchLibraryFileDownloadUrl(item.filePath)
      triggerBrowserDownload(downloadUrl, item.fileName)
      setActionTargetFile(null)
      Toast.show({ content: '已开始下载' })
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : '下载失败，请稍后重试' })
    } finally {
      setActionLoadingKey(null)
    }
  }

  const handleSaveToPersonalLibrary = async (item: LibraryPageFileItem) => {
    try {
      setActionLoadingKey('save-personal')
      await saveLibraryFileToPersonalResource(item.fileId, item.fileName)
      setActionTargetFile(null)
      Toast.show({ content: '添加到个人资料库成功' })
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : '添加到个人资料库失败' })
    } finally {
      setActionLoadingKey(null)
    }
  }

  const handleSaveToOrganizationLibrary = async (item: LibraryPageFileItem) => {
    try {
      setActionLoadingKey('save-organization')
      const knowledgeSpaceOwnerId = await resolveOrganizationOwnerId()

      if (!knowledgeSpaceOwnerId) {
        throw new Error('缺少组织知识空间ID，无法添加到组织资料库')
      }

      await saveLibraryFileToOrganizationResource(item.fileId, knowledgeSpaceOwnerId, item.fileName)
      setActionTargetFile(null)
      Toast.show({ content: '添加到组织资料库成功' })
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : '添加到组织资料库失败' })
    } finally {
      setActionLoadingKey(null)
    }
  }

  if (selectedFile) {
    return (
      <AiLibraryFilePreview
        onBack={() => setSelectedFile(null)}
        onOpenSession={onOpenSession}
        selectedFile={selectedFile}
      />
    )
  }

  return (
    <div className="ai-library-hub-page">
      <div className="ai-library-hub-header">
        <button aria-label="返回任务" className="ai-library-hub-header-btn" type="button" onClick={onBack}>
          <LeftOutline aria-hidden="true" width={20} height={20} />
        </button>
        <div className="ai-library-hub-title">库</div>
        <div className="ai-library-hub-header-spacer" />
      </div>

      <div className={`ai-library-hub-toolbar ${isSearchOpen ? 'is-searching' : ''}`} ref={toolbarRef}>
        <div className={`ai-library-hub-search-shell ${isSearchOpen ? 'is-open' : ''}`}>
          {isSearchOpen ? (
            <AiSearchField
              autoFocus
              placeholder="搜索库文件"
              value={keyword}
              onChange={setKeyword}
            />
          ) : (
            <AiSearchTrigger
              label="展开搜索"
              onClick={() => {
                setIsSearchOpen(true)
                setOpenFilterMenu(null)
              }}
            />
          )}
        </div>

        {!isSearchOpen ? (
          <div className="ai-library-hub-select-row">
            <AiFilterDropdown
              label="来源"
              options={sourceMenuOptions}
              value={sourceFilter}
              visible={openFilterMenu === 'source'}
              onChange={setSourceFilter}
              onVisibleChange={visible => changeFilterVisibility('source', visible)}
            />
            <AiFilterDropdown<LibraryPageFileType>
              label="类型"
              options={typeMenuOptions}
              placement="bottom-end"
              value={fileTypeFilter}
              visible={openFilterMenu === 'type'}
              onChange={setFileTypeFilter}
              onVisibleChange={visible => changeFilterVisibility('type', visible)}
            />
          </div>
        ) : null}
      </div>

      <div className="ai-library-hub-list">
        {loading ? <AiLoading message="库文件加载中…" variant="page" /> : null}
        {!loading && error ? <div className="ai-library-hub-empty">{error}</div> : null}
        {!loading && !error && visibleFiles.length === 0 ? <div className="ai-library-hub-empty">当前没有可展示的库文件。</div> : null}
        {!loading && !error && visibleFiles.map((item) => (
          <div className="ai-library-hub-item-row" key={item.fileId}>
            <button
              className="ai-library-hub-item ai-library-hub-item-main"
              type="button"
              onClick={() => void handleOpenLibraryFile(item)}
            >
              <AiFileItemContent fileType={item.fileType} name={item.fileName} meta={buildListMeta(item)} />
            </button>
            <button
              aria-label="更多操作"
              className="ai-library-hub-item-more"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setActionTargetFile(item)
              }}
            >
              <MoreIcon />
            </button>
          </div>
        ))}
      </div>

      {actionTargetFile ? (
        <AiBottomSheet className="ai-library-hub-action-sheet" label="库文件更多操作" onClose={closeActionSheet}>
          <div className="ai-library-hub-action-sheet-title">{actionTargetFile.fileName || '更多操作'}</div>
          <div className="ai-library-hub-action-sheet-meta">{buildListMeta(actionTargetFile)}</div>

          {isImSession(actionTargetFile.sessionId) ? null : (
            <button
              className="ai-library-hub-action-btn"
              disabled={Boolean(actionLoadingKey)}
              type="button"
              onClick={() => handleViewSession(actionTargetFile)}
            >
              查看对话
            </button>
          )}

          {actionTargetFile.fileType === 'document' ? (
            <button
              className="ai-library-hub-action-btn"
              disabled={Boolean(actionLoadingKey)}
              type="button"
              onClick={() => {
                void handleDownloadFile(actionTargetFile)
              }}
            >
              {actionLoadingKey === 'download' ? '下载中...' : '下载'}
            </button>
          ) : null}

          <button
            className="ai-library-hub-action-btn"
            disabled={Boolean(actionLoadingKey)}
            type="button"
            onClick={() => {
              void handleSaveToPersonalLibrary(actionTargetFile)
            }}
          >
            {actionLoadingKey === 'save-personal' ? '处理中...' : '添加到个人资料库'}
          </button>

          <button
            className="ai-library-hub-action-btn"
            disabled={Boolean(actionLoadingKey)}
            type="button"
            onClick={() => {
              void handleSaveToOrganizationLibrary(actionTargetFile)
            }}
          >
            {actionLoadingKey === 'save-organization' ? '处理中...' : '添加到组织资料库'}
          </button>

          <button
            className="ai-library-hub-action-btn is-cancel"
            disabled={Boolean(actionLoadingKey)}
            type="button"
            onClick={closeActionSheet}
          >
            取消
          </button>
        </AiBottomSheet>
      ) : null}
    </div>
  )
}

export default AiSidebarLibraryPage
