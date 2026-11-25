import { LeftOutline } from 'antd-mobile-icons'

type AiDiscoverHeaderProps = {
  onBack: () => void
}

export function AiDiscoverHeader({ onBack }: AiDiscoverHeaderProps) {
  return (
    <div className="ai-discover-header">
      <button aria-label="返回发现入口" className="ai-discover-header-menu" type="button" onClick={onBack}>
        <LeftOutline aria-hidden="true" width={20} height={20} />
      </button>
      <div className="ai-discover-header-title">发现</div>
      <div aria-hidden="true" className="ai-discover-header-spacer" />
    </div>
  )
}
