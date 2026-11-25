import { useEffect, useRef, type ReactNode } from 'react'
import { attachScrollIndicators } from './scrollIndicators'
import './AiScrollScope.css'

type Props = { className: string; enabled?: boolean; children: ReactNode }

export function AiScrollScope({ className, enabled = true, children }: Props) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (enabled && root.current) return attachScrollIndicators(root.current)
  }, [enabled])
  return <div className={className} data-ai-scroll-scope={enabled ? '' : undefined} ref={root}>{children}</div>
}
