import { GlobalOutline, RightOutline } from 'antd-mobile-icons'
import { AiBottomSheet } from './AiBottomSheet'
import { AiDrawerMenuLibraryIcon, AiDrawerMenuSkillsIcon } from './AiDrawerMenuIcons'
import './AiWorkspacePlusSheet.css'

type AiWorkspacePlusSheetProps = {
  webSearchEnabled: boolean
  onWebSearchChange: (enabled: boolean) => void
  onTakePhoto: () => void
  onPickFile: () => void
  onOpenLibrary: () => void
  onOpenSkills: () => void
  onClose: () => void
}

export function AiWorkspacePlusSheet({
  webSearchEnabled,
  onWebSearchChange,
  onTakePhoto,
  onPickFile,
  onOpenLibrary,
  onOpenSkills,
  onClose,
}: AiWorkspacePlusSheetProps) {
  return (
    <AiBottomSheet className="ai-workspace-plus-sheet" label="更多操作" nativeModal onClose={onClose}>
      <div className="ai-workspace-plus-sheet__tiles">
        <button type="button" onClick={onTakePhoto}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 7.5h3l1.5-2.5h6l1.5 2.5h3A2.5 2.5 0 0 1 22 10v7a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17v-7a2.5 2.5 0 0 1 2.5-2.5Z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          拍照
        </button>
        <button type="button" onClick={onPickFile}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 7-6.7 6.7a2.2 2.2 0 0 0 3.1 3.1l8-8a3.6 3.6 0 0 0-5.1-5.1l-9 9a5 5 0 0 0 7.1 7.1l7.4-7.4" />
          </svg>
          选取文件
        </button>
        <button type="button" onClick={onOpenLibrary}>
          <span aria-hidden="true"><AiDrawerMenuLibraryIcon size={22} /></span>
          资料库
        </button>
      </div>
      <div className="ai-workspace-plus-sheet__rows">
        <button type="button" onClick={onOpenSkills}>
          <AiDrawerMenuSkillsIcon size={19} />
          技能
          <RightOutline aria-hidden="true" className="ai-workspace-plus-sheet__arrow" width={14} height={14} />
        </button>
        <button
          aria-checked={webSearchEnabled}
          role="switch"
          type="button"
          onClick={() => onWebSearchChange(!webSearchEnabled)}
        >
          <GlobalOutline aria-hidden="true" width={19} height={19} />
          联网
          <span aria-hidden="true" className="ai-workspace-plus-sheet__toggle" />
        </button>
      </div>
    </AiBottomSheet>
  )
}
