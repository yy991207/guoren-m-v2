import './AiLoading.css'

type AiLoadingProps = {
  message: string
  variant?: 'page' | 'inline'
}

export function AiLoading({ message, variant = 'inline' }: AiLoadingProps) {
  return (
    <div className="ai-loading" data-variant={variant} role="status">
      <span aria-hidden="true" className="ai-loading-ring" />
      <span className="ai-loading-message">{message}</span>
    </div>
  )
}
