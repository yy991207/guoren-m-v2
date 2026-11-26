import './AiLoading.css'

type AiLoadingProps = {
  message: string
  variant?: 'page' | 'inline'
}

export function AiLoadingRing() {
  return <span aria-hidden="true" className="ai-loading-ring" />
}

export function AiLoading({ message, variant = 'inline' }: AiLoadingProps) {
  return (
    <div className="ai-loading" data-variant={variant} role="status">
      <AiLoadingRing />
      <span className="ai-loading-message">{message}</span>
    </div>
  )
}
