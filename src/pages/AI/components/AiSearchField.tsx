import './AiSearchField.css'

type AiSearchFieldProps = {
  value: string
  placeholder: string
  onChange: (value: string) => void
  label?: string
  className?: string
  autoFocus?: boolean
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

// 搜索词归页面管理；组件只负责输入外观，不改变页面的筛选或请求时机。
export function AiSearchField({ value, placeholder, onChange, label, className, autoFocus }: AiSearchFieldProps) {
  return (
    <label className={className ? `ai-search-field ${className}` : 'ai-search-field'}>
      <SearchIcon />
      <input
        aria-label={label ?? placeholder}
        autoFocus={autoFocus}
        maxLength={200}
        placeholder={placeholder}
        type="search"
        value={value}
        onChange={event => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

export function AiSearchTrigger({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button aria-label={label} className="ai-search-field ai-search-field--trigger" type="button" onClick={onClick}>
      <SearchIcon />
    </button>
  )
}
