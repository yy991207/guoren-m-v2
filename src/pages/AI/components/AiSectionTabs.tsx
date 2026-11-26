import { useId, type KeyboardEvent, type ReactNode } from 'react'
import './AiSectionTabs.css'

type AiSectionTabsProps<Key extends string> = {
  label: string
  variant?: 'segmented' | 'chips'
  tabs: ReadonlyArray<{ key: Key; label: string; content: ReactNode }>
  value: NoInfer<Key>
  onChange: (value: NoInfer<Key>) => void
}

export function AiSectionTabs<Key extends string>({ label, variant = 'segmented', tabs, value, onChange }: AiSectionTabsProps<Key>) {
  const id = useId()

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number
    switch (event.key) {
      case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break
      case 'ArrowRight': next = (index + 1) % tabs.length; break
      case 'Home': next = 0; break
      case 'End': next = tabs.length - 1; break
      default: return
    }
    event.preventDefault()
    onChange(tabs[next].key)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <>
      <div aria-label={label} className="ai-section-tabs" data-variant={variant} role="tablist">
        {tabs.map((tab, index) => (
          <button
            aria-controls={`${id}-panel-${tab.key}`}
            aria-selected={tab.key === value}
            className="ai-section-tabs-button"
            id={`${id}-tab-${tab.key}`}
            key={tab.key}
            role="tab"
            tabIndex={tab.key === value ? 0 : -1}
            type="button"
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >{tab.label}</button>
        ))}
      </div>
      {tabs.map(tab => (
        <div
          aria-labelledby={`${id}-tab-${tab.key}`}
          hidden={tab.key !== value}
          id={`${id}-panel-${tab.key}`}
          key={tab.key}
          role="tabpanel"
          tabIndex={tab.key === value ? 0 : undefined}
        >
          {tab.key === value ? tab.content : null}
        </div>
      ))}
    </>
  )
}
