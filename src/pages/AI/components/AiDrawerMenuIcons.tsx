import { AppOutline, AppstoreOutline } from 'antd-mobile-icons'

export type AiDrawerMenuIconKey = 'new' | 'library' | 'skills' | 'discover'

export const AI_DRAWER_MENU_ITEMS: Array<{ key: AiDrawerMenuIconKey; label: string }> = [
  { key: 'new', label: '新建' },
  { key: 'discover', label: '智能体' },
  { key: 'library', label: '库' },
  { key: 'skills', label: '技能' },
]

type AiDrawerMenuIconProps = {
  size?: number
}

export function AiDrawerMenuNewIcon({ size = 18 }: AiDrawerMenuIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

type SelectableIconProps = AiDrawerMenuIconProps & { filled?: boolean }

export function AiDrawerMenuLibraryIcon({ size = 18, filled = false }: SelectableIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path fill={filled ? 'currentColor' : 'none'} d="M4.5 7.5c0-1.1.9-2 2-2h3.1c.54 0 1.05.26 1.36.69l1.03 1.42c.3.42.8.67 1.31.67h4.19c1.1 0 2 .9 2 2v6.22c0 1.1-.9 2-2 2H6.5c-1.1 0-2-.9-2-2z" />
      {filled ? <path d="M5.5 10h13" stroke="var(--ai-workspace-background)" strokeWidth="1.2" /> : <path d="M4.5 9.5h15" />}
    </svg>
  )
}

export function AiDrawerMenuSkillsIcon({ size = 18, filled = false }: SelectableIconProps) {
  if (filled) return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="m13.6 2.45 5.75 3.35A3.3 3.3 0 0 1 21 8.65v6.7a3.3 3.3 0 0 1-1.65 2.85l-5.75 3.35a3.2 3.2 0 0 1-3.2 0L4.65 18.2A3.3 3.3 0 0 1 3 15.35v-6.7A3.3 3.3 0 0 1 4.65 5.8l5.75-3.35a3.2 3.2 0 0 1 3.2 0Z" />
      <path d="m3 10.3 9.1 5.3m-5.6-3.25 11-6.4M11.85 9.2 21 14.5M6.5 18.85l11-6.4" fill="none" stroke="var(--ai-workspace-background)" strokeWidth="1.2" />
    </svg>
  )
  return (
    <AppOutline aria-hidden="true" style={{ fontSize: size }} />
  )
}

export function AiDrawerMenuDiscoverIcon({ size = 18, filled = false }: SelectableIconProps) {
  if (filled) return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="2" width="9" height="9" rx="3" /><rect x="13" y="2" width="9" height="9" rx="3" />
      <rect x="2" y="13" width="9" height="9" rx="3" /><rect x="13" y="13" width="9" height="9" rx="3" />
    </svg>
  )
  return (
    <AppstoreOutline aria-hidden="true" style={{ fontSize: size }} />
  )
}

export function renderAiDrawerMenuIcon(type: AiDrawerMenuIconKey) {
  switch (type) {
    case 'new':
      return <AiDrawerMenuNewIcon />
    case 'library':
      return <AiDrawerMenuLibraryIcon />
    case 'skills':
      return <AiDrawerMenuSkillsIcon />
    case 'discover':
      return <AiDrawerMenuDiscoverIcon />
    default:
      return null
  }
}
