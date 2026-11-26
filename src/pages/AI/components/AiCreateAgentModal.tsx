import { useEffect, useRef, useState } from 'react'

import {
  fetchAgentTemplateDetail,
  fetchAgentTemplateTask,
  fetchAgentTemplates,
  generateAgentTemplate,
  type AgentTemplateItem,
} from '../../../services/agentTemplates'
import { AiBottomSheet } from './AiBottomSheet'
import { AiLoading } from './AiLoading'

type AiCreateAgentModalProps = {
  visible: boolean
  onClose: () => void
  onUseTemplate?: (template: {
    agentName: string
    description: string
    instruction: string
    presetQuestions: Array<{
      id: string
      category?: string
      question: string
      instruction: string
    }>
  }) => void
}

const HEADER_ILLUSTRATION_URL = 'https://guoren-skills-hb-test.oss-cn-beijing.aliyuncs.com/system/images/banner/97503344fc8b44759e89945b4da68833.png'
const POLL_INTERVAL = 2000
const MAX_POLL_TIME = 120000

const FEATURE_CARDS = [
  {
    title: '团队协作更顺手',
    description: '一位数字助手服务整个团队，对话与记忆按人和按群隔离。',
  },
  {
    title: '能力丰富更专业',
    description: '深度操作企业系统，灵活定制技能与工具。',
  },
  {
    title: '先测试，再发布',
    description: '发布前先试聊几轮，根据回复效果调整配置。',
  },
]

export function AiCreateAgentModal({
  visible,
  onClose,
  onUseTemplate,
}: AiCreateAgentModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [statusText, setStatusText] = useState('')
  const [templates, setTemplates] = useState<AgentTemplateItem[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateClicking, setTemplateClicking] = useState('')
  const templateDetailAbortRef = useRef<AbortController | null>(null)
  const generationAbortRef = useRef<AbortController | null>(null)
  const pollingTimeoutRef = useRef<number | null>(null)
  const generationStartTimeRef = useRef<number | null>(null)

  const clearGenerationTask = () => {
    generationAbortRef.current?.abort()
    generationAbortRef.current = null

    if (pollingTimeoutRef.current !== null) {
      window.clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }

    generationStartTimeRef.current = null
  }

  const handleGenerationError = (message: string) => {
    setIsSubmitting(false)
    setStatusText('')
    setErrorText(message)
    clearGenerationTask()
  }

  const pollTaskStatus = async (taskId: string) => {
    if (generationStartTimeRef.current && Date.now() - generationStartTimeRef.current > MAX_POLL_TIME) {
      handleGenerationError('生成超时，请重试')
      return
    }

    const controller = new AbortController()
    generationAbortRef.current = controller

    try {
      const taskState = await fetchAgentTemplateTask(taskId, controller.signal)

      if (controller.signal.aborted) {
        return
      }

      if (taskState.status === 'failed') {
        handleGenerationError(taskState.message)
        return
      }

      setStatusText(taskState.message)
      if (taskState.status === 'completed') {
        setIsSubmitting(false)
        clearGenerationTask()
        return
      }

      generationAbortRef.current = null
      pollingTimeoutRef.current = window.setTimeout(() => {
        void pollTaskStatus(taskId)
      }, POLL_INTERVAL)
    } catch (error) {
      if (!controller.signal.aborted) {
        handleGenerationError(error instanceof Error ? error.message : '生成失败，请重试')
      }
    }
  }

  const startGeneration = async () => {
    const trimmedInput = inputValue.trim()

    if (!trimmedInput || isSubmitting) {
      return
    }

    clearGenerationTask()
    generationStartTimeRef.current = Date.now()
    setIsSubmitting(true)
    setErrorText('')
    setStatusText('')

    const controller = new AbortController()
    generationAbortRef.current = controller

    try {
      const submission = await generateAgentTemplate(trimmedInput, controller.signal)

      if (controller.signal.aborted) {
        return
      }

      await pollTaskStatus(submission.taskId)
    } catch (error) {
      if (!controller.signal.aborted) {
        handleGenerationError(error instanceof Error ? error.message : '生成失败，请重试')
      }
    }
  }

  useEffect(() => {
    if (!visible) {
      setInputValue('')
      setIsSubmitting(false)
      setErrorText('')
      setStatusText('')
      clearGenerationTask()
      return
    }

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    return () => {
      templateDetailAbortRef.current?.abort()
      templateDetailAbortRef.current = null
      clearGenerationTask()
      document.body.style.overflow = previousOverflow
    }
  }, [visible])

  useEffect(() => {
    if (!visible) {
      setTemplates([])
      setTemplatesLoading(false)
      setTemplateClicking('')
      templateDetailAbortRef.current?.abort()
      templateDetailAbortRef.current = null
      return
    }

    const controller = new AbortController()

    async function loadTemplates() {
      setTemplatesLoading(true)

      try {
        const items = await fetchAgentTemplates(controller.signal)

        if (!controller.signal.aborted) {
          setTemplates(items)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setTemplates([])
          console.error('加载智能体模板失败:', error)
        }
      } finally {
        if (!controller.signal.aborted) {
          setTemplatesLoading(false)
        }
      }
    }

    void loadTemplates()

    return () => {
      controller.abort()
    }
  }, [visible])

  const handleUseTemplate = async (template: AgentTemplateItem) => {
    setTemplateClicking(template.templateId)
    templateDetailAbortRef.current?.abort()
    const controller = new AbortController()
    templateDetailAbortRef.current = controller

    try {
      const detail = await fetchAgentTemplateDetail(template.templateId, controller.signal)

      if (controller.signal.aborted) {
        return
      }

      onUseTemplate?.({
        agentName: detail.templateName,
        description: detail.description,
        instruction: detail.agentPrompt,
        presetQuestions: detail.presetQuestions.map((item, index) => ({
          id: `template-${detail.templateId}-question-${index}`,
          question: item.question,
          instruction: item.instruction,
        })),
      })
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('获取智能体模板详情失败:', error)
      }
    } finally {
      if (!controller.signal.aborted) {
        setTemplateClicking('')
      }

      if (templateDetailAbortRef.current === controller) {
        templateDetailAbortRef.current = null
      }
    }
  }

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return
    }

    if (event.key === 'Enter' && !event.shiftKey && !isSubmitting) {
      event.preventDefault()
      void startGeneration()
    }
  }

  if (!visible) {
    return null
  }

  return (
    <AiBottomSheet className="ai-create-agent-modal" label="创建智能体" onClose={onClose}>
      <button aria-label="关闭创建智能体弹窗" className="ai-create-agent-modal-close" type="button" onClick={onClose}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6L18 18" />
          <path d="M18 6L6 18" />
        </svg>
      </button>

      <div className="ai-create-agent-modal-hero">
        <img alt="" className="ai-create-agent-modal-hero-image" src={HEADER_ILLUSTRATION_URL} />
      </div>

      <div className="ai-create-agent-modal-content">
        <h2 className="ai-create-agent-modal-title">即刻创建你的助手</h2>

        <div className="ai-create-agent-modal-features">
          {FEATURE_CARDS.map((item, index) => (
            <div className="ai-create-agent-modal-feature" key={item.title}>
              <span className="ai-create-agent-modal-feature-icon">{index + 1}</span>
              <span className="ai-create-agent-modal-feature-copy">
                <span className="ai-create-agent-modal-feature-title">{item.title}</span>
                <span className="ai-create-agent-modal-feature-desc">{item.description}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="ai-create-agent-modal-input-wrap">
          <textarea
            className="ai-create-agent-modal-textarea"
            disabled={isSubmitting}
            maxLength={500}
            placeholder="比如：我想要一个学习助手，能根据我的学习目标制定专属计划，梳理知识脉络和重点难点，用通俗易懂的方式讲解复杂概念，帮我高效掌握新知识。"
            value={inputValue}
            onKeyDown={handleTextareaKeyDown}
            onChange={(event) => setInputValue(event.target.value)}
          />
          <button
            aria-label="发送创建请求"
            className={`ai-create-agent-modal-send${inputValue.trim() && !isSubmitting ? ' is-active' : ''}${isSubmitting ? ' is-loading' : ''}`}
            disabled={!inputValue.trim() || isSubmitting}
            type="button"
            onClick={() => {
              void startGeneration()
            }}
          >
            {isSubmitting ? (
              <span aria-hidden="true" className="ai-create-agent-modal-send-spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>

        {isSubmitting || statusText ? (
          <div className="ai-create-agent-modal-loading-text" role="status">{statusText || '正在努力生成中...'}</div>
        ) : null}

        {errorText ? (
          <div className="ai-create-agent-modal-error-wrap" role="alert">
            <div className="ai-create-agent-modal-error-text">{errorText}</div>
            <button
              className="ai-create-agent-modal-retry-btn"
              type="button"
              onClick={() => {
                void startGeneration()
              }}
            >
              重试
            </button>
          </div>
        ) : null}

        {!isSubmitting ? (
          <>
            <div className="ai-create-agent-modal-templates-title">没有灵感？试试已经做好的智能体～</div>
            <div className="ai-create-agent-modal-templates">
              {templatesLoading ? (
                <AiLoading fill message="模板加载中…" />
              ) : templates.length === 0 ? (
                <div className="ai-create-agent-modal-templates-state">暂无模板</div>
              ) : (
                templates.map((template) => (
                  <button
                    className={`ai-create-agent-modal-template${templateClicking === template.templateId ? ' is-loading' : ''}`}
                    disabled={templateClicking === template.templateId}
                    key={template.templateId}
                    title={template.description}
                    type="button"
                    onClick={() => {
                      void handleUseTemplate(template)
                    }}
                  >
                    {templateClicking === template.templateId ? '加载中...' : template.templateName}
                  </button>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>
    </AiBottomSheet>
  )
}
