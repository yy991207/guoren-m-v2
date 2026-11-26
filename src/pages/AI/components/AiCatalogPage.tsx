import { LeftOutline } from 'antd-mobile-icons'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { AiSearchField } from './AiSearchField'
import { AiSectionTabs } from './AiSectionTabs'
import './AiCatalogPage.css'

type AiCatalogPageProps<Key extends string> = {
  title: string
  backLabel?: string
  onBack: () => void
  search: { value: string; placeholder: string; onChange: (value: string) => void }
  action?: ReactNode
  beforeCategories?: ReactNode
  categoryLabel: string
  categories: ReadonlyArray<{ key: Key; label: string; content: ReactNode }>
  category: NoInfer<Key>
  onCategoryChange: (key: NoInfer<Key>) => void
}

export function AiCatalogPage<Key extends string>({
  title, backLabel = '返回任务', onBack, search, action, beforeCategories,
  categoryLabel, categories, category, onCategoryChange,
}: AiCatalogPageProps<Key>) {
  const pageRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const introRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const page = pageRef.current
    const scroller = scrollRef.current
    const intro = introRef.current
    if (!page || !scroller || !intro) return

    const updateDock = () => {
      // 用搜索和收藏区的下沿做判定，不受分类栏切换定位的影响。
      const docked = scroller.scrollTop > 0 && intro.getBoundingClientRect().bottom <= scroller.getBoundingClientRect().top
      page.toggleAttribute('data-tabs-docked', docked)
    }
    updateDock()
    scroller.addEventListener('scroll', updateDock, { passive: true })
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateDock) : null
    observer?.observe(intro)
    observer?.observe(scroller)
    return () => {
      scroller.removeEventListener('scroll', updateDock)
      observer?.disconnect()
    }
  }, [])

  const selectCategory = (next: Key) => {
    if (next === category) return
    const scroller = scrollRef.current
    const intro = introRef.current
    if (scroller && intro) {
      const offset = intro.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top
      // 吸顶后切换分类时，从新列表第一项开始，不沿用旧列表的滚动深度。
      if (offset < 0) scroller.scrollTop += offset
    }
    onCategoryChange(next)
  }

  return (
    <div className="ai-catalog-page" ref={pageRef}>
      <header className="ai-catalog-header">
        <button aria-label={backLabel} className="ai-catalog-back" type="button" onClick={onBack}>
          <LeftOutline aria-hidden="true" width={20} height={20} />
        </button>
        <h1>{title}</h1>
      </header>
      <div className="ai-catalog-content" ref={scrollRef}>
        <div className="ai-catalog-intro" ref={introRef}>
          <div className="ai-catalog-tools">
            <AiSearchField className="ai-catalog-search" {...search} />
            {action}
          </div>
          {beforeCategories}
        </div>
        <div aria-hidden="true" className="ai-catalog-dock-spacer" />
        <AiSectionTabs label={categoryLabel} tabs={categories} value={category} variant="chips" onChange={selectCategory} />
      </div>
    </div>
  )
}

export function AiCatalogCreateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button aria-label={label} className="ai-catalog-create" type="button" onClick={onClick}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}

export function AiCatalogGrid({ children }: { children: ReactNode }) {
  return <div className="ai-catalog-grid">{children}</div>
}
