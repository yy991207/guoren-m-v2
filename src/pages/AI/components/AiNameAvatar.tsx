import { useState, type CSSProperties } from 'react'

export type AiNameAvatarTone = 'white' | 'blue' | 'green' | 'orange' | 'detail'

type AiNameAvatarProps = {
  name?: string
  avatarUrl?: string | null
  fallbackOnError?: boolean
  tone: AiNameAvatarTone
  className: string
  imageClassName: string
  ariaLabel?: string
}

const AI_NAME_AVATAR_FALLBACK_STYLES: Record<AiNameAvatarTone, CSSProperties> = {
  white: {
    background: '#ffffff',
    color: '#1f2329',
    border: '1px solid #e5e7eb',
    boxShadow: 'none',
  },
  blue: {
    background: '#2795F5',
    color: '#ffffff',
    border: 'none',
    boxShadow: 'none',
  },
  green: {
    background: '#43C473',
    color: '#ffffff',
    border: 'none',
    boxShadow: 'none',
  },
  orange: {
    background: '#F56C27',
    color: '#ffffff',
    border: 'none',
    boxShadow: 'none',
  },
  detail: {
    background: '#fff3ea',
    color: '#1f2329',
    border: 'none',
    boxShadow: 'none',
  },
}

export function getAiNameAvatarLetter(name?: string): string {
  return name?.trim().charAt(0).toUpperCase() || '智'
}

export function normalizeAiAvatarUrl(avatarUrl?: string | null): string | null {
  const trimmedAvatarUrl = avatarUrl?.trim()

  if (!trimmedAvatarUrl) {
    return null
  }

  if (trimmedAvatarUrl.toLowerCase() === 'example') {
    return null
  }

  if (
    trimmedAvatarUrl.toLowerCase() === 'example.com'
    || trimmedAvatarUrl.toLowerCase().startsWith('example.com/')
  ) {
    return null
  }

  try {
    const parsedUrl = new URL(trimmedAvatarUrl)
    const hostname = parsedUrl.hostname.toLowerCase()

    if (hostname === 'example.com' || hostname.endsWith('.example.com')) {
      return null
    }
  } catch {
    return trimmedAvatarUrl
  }

  return trimmedAvatarUrl
}

export function AiNameAvatar({
  name,
  avatarUrl,
  fallbackOnError,
  tone,
  className,
  imageClassName,
  ariaLabel,
}: AiNameAvatarProps) {
  // 只记住失败的地址，换成新地址后仍让浏览器加载图片。
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null)
  const normalizedAvatarUrl = normalizeAiAvatarUrl(avatarUrl)
  const imageUrl = fallbackOnError && normalizedAvatarUrl === failedAvatarUrl ? null : normalizedAvatarUrl
  const resolvedAriaLabel = ariaLabel || `${name || '智能体'}头像`

  return (
    <div
      aria-label={resolvedAriaLabel}
      className={className}
      data-tone={tone}
      role="img"
      style={imageUrl ? undefined : AI_NAME_AVATAR_FALLBACK_STYLES[tone]}
    >
      {imageUrl ? (
        <img alt="" className={imageClassName} key={imageUrl} src={imageUrl} onError={fallbackOnError ? () => setFailedAvatarUrl(imageUrl) : undefined} />
      ) : (
        <span>{getAiNameAvatarLetter(name)}</span>
      )}
    </div>
  )
}
