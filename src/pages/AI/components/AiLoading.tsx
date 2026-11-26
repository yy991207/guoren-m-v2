import './AiLoading.css'

type AiLoadingProps = {
  message: string
  variant?: 'page' | 'inline'
  fill?: boolean
}

export function AiLoadingRing() {
  return <span aria-hidden="true" className="ai-loading-ring" />
}

export function AiLoading({ message, variant = 'inline', fill = false }: AiLoadingProps) {
  return (
    <div className="ai-loading" data-fill={fill || undefined} data-variant={variant} role="status">
      <AiLoadingRing />
      <span className="ai-loading-message">{message}</span>
    </div>
  )
}
