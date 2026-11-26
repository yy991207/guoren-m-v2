import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { APP_ROUTE_PATHS } from '../../../routes'
import { buildChatAttachmentPayload } from '../../../services/chat/attachments'
import {
  buildArtifactPreviewUrl,
  buildResumeChatStreamRequest,
  buildStartChatStreamRequest,
  createChatSession,
  resumeChatMessageStream,
  stopChatMessageStream,
  streamChatMessage,
} from '../../../services/chat/api'
import { createChatStreamBridge, type ChatStreamBridge } from '../../../services/chat/bridge'
import { resolveChatEntrySubmitOptions } from '../../../services/chat/entryState'
import {
  appendErrorToAssistantMessage,
  completeAssistantMessage,
} from '../../../services/chat/messageState'
import { readSseStream } from '../../../services/chat/sse'
import {
  applyChatModelStartToSnapshot,
  applyEventIdToSnapshot,
  applyReasoningDeltaToSnapshot,
  applyReferencesToSnapshot,
  applySkillOutputToSnapshot,
  applyTextDeltaToSnapshot,
  applyToolCallToSnapshot,
} from '../../../services/chat/streamState'
import {
  clearChatStreamSnapshot,
  loadChatStreamSnapshot,
  persistChatStreamSnapshot,
} from '../../../services/chat/snapshot'
import {
  deleteChatSession,
  fetchChatSessions,
  findLatestEmptySession,
  getChatSession,
  getSessionDisplayName,
} from '../../../services/chat/session'
import type {
  ChatArtifactItem,
  ChatAttachment,
  ChatEntryState,
  ChatMessage,
  ChatSession,
  ChatSessionDetail,
  ChatStreamSnapshot,
} from '../../../services/chat/types'
import { resolveSubmitSessionId } from './resolveSubmitSessionId'
import { useWorkspaceChatModels } from './useWorkspaceChatModels'

function buildTimestamp(): string {
  return new Date().toISOString()
}

function buildUserMessage(
  sessionId: string | null,
  content: string,
  attachments: ChatAttachment[],
): ChatMessage {
  return {
    id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role: 'user',
    content,
    createdAt: buildTimestamp(),
    sessionId,
    loading: false,
    reasoningContent: null,
    reasoningTimestamp: null,
    toolCalls: [],
    processingSteps: [],
    references: [],
    skillOutput: [],
    attachments,
  }
}

function buildAssistantPlaceholder(sessionId: string | null): ChatMessage {
  return {
    id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role: 'assistant',
    content: '',
    createdAt: buildTimestamp(),
    sessionId,
    loading: true,
    reasoningContent: null,
    reasoningTimestamp: null,
    toolCalls: [],
    processingSteps: [],
    references: [],
    skillOutput: [],
    attachments: [],
  }
}

function normalizeSkillOutput(rawValue: unknown): ChatArtifactItem[] {
  if (!Array.isArray(rawValue)) {
    return []
  }

  return rawValue.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return []
    }

    const rawItem = item as Record<string, unknown>

    if (typeof rawItem.url !== 'string' || typeof rawItem.filename !== 'string' || typeof rawItem.type !== 'string') {
      return []
    }

    return [{
      url: rawItem.url,
      filename: rawItem.filename,
      type: rawItem.type,
      skill_name: typeof rawItem.skill_name === 'string' ? rawItem.skill_name : undefined,
      size: typeof rawItem.size === 'number' ? rawItem.size : undefined,
    }]
  })
}

function normalizeAttachments(
  rawAttachments: ChatSessionDetail['messages'][number]['attachments'] = [],
): ChatAttachment[] {
  if (!Array.isArray(rawAttachments)) {
    return []
  }

  return rawAttachments.flatMap((attachment) => {
    if (!attachment?.resource_id || !attachment.file_name) {
      return []
    }

    return [{
      id: `server-${attachment.resource_id}`,
      kind: 'uploaded' as const,
      name: attachment.file_name,
      status: 'completed' as const,
      resourceId: attachment.resource_id,
      url: attachment.url,
    }]
  })
}

function mapServerMessage(message: ChatSessionDetail['messages'][number]): ChatMessage {
  return {
    id: message.message_id,
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
    sessionId: null,
    loading: false,
    reasoningContent: message.reasoning_content ?? null,
    reasoningTimestamp: message.reasoning_content ? message.created_at : null,
    toolCalls: Array.isArray(message.tool_calls)
      ? message.tool_calls.map((toolCall) => ({
          name: toolCall.name,
          runId: toolCall.call_id,
          status: toolCall.status === 'completed' ? 'completed' : 'running',
          input: toolCall.input ?? {},
          output: toolCall.output,
          timestamp: toolCall.timestamp,
          toolDisplay: toolCall.tool_display,
        }))
      : [],
    processingSteps: [],
    references: Array.isArray(message.references) ? message.references : [],
    skillOutput: normalizeSkillOutput(message.skill_output),
    attachments: normalizeAttachments(message.attachments),
  }
}

export type SelectedArtifact = {
  sessionId: string | null
  createdAt: string
  artifact: ChatArtifactItem
}

export type ActiveAgentContext = {
  agentId: string
  agentName: string
  description: string
}

export function useAiChatRuntime() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const routeSessionId = searchParams.get('sessionId')
  const { controls: modelControls, restoreHistory, restorePreference } = useWorkspaceChatModels()
  const { model, thinkingLevel } = modelControls
  const [modelSessionId, setModelSessionId] = useState<string | null>(null)
  const restoringModel = !!routeSessionId && modelSessionId !== routeSessionId
  const [preparingPrompt, setPreparingPrompt] = useState(false)
  const preparingPromptRef = useRef(false)

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [restoredHeader, setRestoredHeader] = useState<Pick<ChatSession, 'session_id' | 'session_name' | 'agent_id' | 'agent_info'> | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [draftAttachments, setDraftAttachments] = useState<ChatAttachment[]>([])
  const [requestError, setRequestError] = useState('')
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isResponding, setIsResponding] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [activeToolType, setActiveToolType] = useState<string | null>(null)
  const [activeAgent, setActiveAgent] = useState<ActiveAgentContext | null>(null)
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact | null>(null)

  const bridgeRef = useRef<ChatStreamBridge | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const abortReasonRef = useRef<'user-stop' | 'session-change' | null>(null)
  const currentSessionIdRef = useRef<string | null>(routeSessionId)
  const processedEntryIdRef = useRef<string | null>(null)
  const skipRestoreSessionIdRef = useRef<string | null>(null)
  const messagesRef = useRef<ChatMessage[]>(messages)
  const sessionsVersion = useRef(0)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    currentSessionIdRef.current = routeSessionId
  }, [routeSessionId])

  const canSend = useMemo(() => {
    const hasPendingAttachment = draftAttachments.some((attachment) => attachment.status !== 'completed')
    return Boolean(inputValue.trim()) && !restoringModel && !preparingPrompt && !isResponding && !isStopping && !hasPendingAttachment
  }, [draftAttachments, inputValue, isResponding, isStopping, preparingPrompt, restoringModel])

  const applyStreamSnapshot = useCallback((snapshot: ChatStreamSnapshot) => {
    if (snapshot.sessionId !== currentSessionIdRef.current) {
      return
    }

    setMessages(snapshot.messages)
    setIsResponding(snapshot.status === 'streaming')
    setIsStopping(false)
    setRequestError(snapshot.status === 'error' ? (snapshot.error ?? '请求失败，请稍后重试。') : '')
  }, [])

  const refreshSessions = useCallback(async (signal?: AbortSignal) => {
    const version = ++sessionsVersion.current
    setIsLoadingSessions(true)

    try {
      const next = await fetchChatSessions(signal)
      if (!signal?.aborted && version === sessionsVersion.current) setSessions(next)
      return true
    } catch (error) {
      if (!signal?.aborted) console.warn('[ai-chat] 刷新会话列表失败：', error)
      return false
    } finally {
      if (version === sessionsVersion.current) setIsLoadingSessions(false)
    }
  }, [])

  const consumeStreamOnMainThread = useCallback(async (
    initialSnapshot: ChatStreamSnapshot,
    createStream: (signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>,
  ) => {
    let nextSnapshot = initialSnapshot
    const controller = new AbortController()

    abortControllerRef.current = controller
    abortReasonRef.current = null
    persistChatStreamSnapshot(initialSnapshot)
    applyStreamSnapshot(initialSnapshot)

    const syncSnapshot = (snapshot: ChatStreamSnapshot, keepSnapshot = true) => {
      nextSnapshot = snapshot

      if (keepSnapshot) {
        persistChatStreamSnapshot(snapshot)
      } else {
        clearChatStreamSnapshot(snapshot.sessionId)
      }

      applyStreamSnapshot(snapshot)
    }

    try {
      const stream = await createStream(controller.signal)

      await readSseStream(stream, {
        onEventId(eventId) {
          syncSnapshot(applyEventIdToSnapshot(nextSnapshot, Number(eventId)))
        },
        onChatModelStart() {
          syncSnapshot(applyChatModelStartToSnapshot(nextSnapshot, buildTimestamp()))
        },
        onTextDelta(chunk) {
          syncSnapshot(applyTextDeltaToSnapshot(nextSnapshot, chunk, buildTimestamp()))
        },
        onReasoningDelta(chunk) {
          syncSnapshot(applyReasoningDeltaToSnapshot(nextSnapshot, chunk, buildTimestamp()))
        },
        onToolStart(toolCall) {
          syncSnapshot(applyToolCallToSnapshot(nextSnapshot, toolCall, buildTimestamp()))
        },
        onToolEnd(toolCall) {
          syncSnapshot(applyToolCallToSnapshot(nextSnapshot, toolCall, buildTimestamp()))
        },
        onReferences(references) {
          syncSnapshot(applyReferencesToSnapshot(nextSnapshot, references))
        },
        onSkillOutput(skillOutput) {
          syncSnapshot(applySkillOutputToSnapshot(nextSnapshot, skillOutput))
        },
      })

      const completedSnapshot: ChatStreamSnapshot = {
        ...nextSnapshot,
        status: 'completed',
        error: null,
        messages: nextSnapshot.activeMessageId
          ? completeAssistantMessage(nextSnapshot.messages, nextSnapshot.activeMessageId)
          : nextSnapshot.messages,
      }

      syncSnapshot(completedSnapshot, false)
      await refreshSessions()
    } catch (error) {
      if (controller.signal.aborted && abortReasonRef.current === 'session-change') {
        return
      }

      if (controller.signal.aborted && abortReasonRef.current === 'user-stop') {
        const abortedSnapshot: ChatStreamSnapshot = {
          ...nextSnapshot,
          status: 'aborted',
          error: null,
          messages: nextSnapshot.activeMessageId
            ? completeAssistantMessage(nextSnapshot.messages, nextSnapshot.activeMessageId)
            : nextSnapshot.messages,
        }

        syncSnapshot(abortedSnapshot, false)
        return
      }

      const errorSnapshot: ChatStreamSnapshot = {
        ...nextSnapshot,
        status: 'error',
        error: error instanceof Error ? error.message : '流式响应失败',
        messages: nextSnapshot.activeMessageId
          ? appendErrorToAssistantMessage(
              nextSnapshot.messages,
              nextSnapshot.activeMessageId,
              '流式响应失败，请稍后重试。',
            )
          : nextSnapshot.messages,
      }

      syncSnapshot(errorSnapshot)
    } finally {
      abortControllerRef.current = null
      setIsStopping(false)
    }
  }, [applyStreamSnapshot, refreshSessions])

  const restoreSession = useCallback(async (sessionId: string, detail: Promise<ChatSessionDetail>, signal: AbortSignal) => {
    const cachedSnapshot = loadChatStreamSnapshot(sessionId)

    if (cachedSnapshot) {
      applyStreamSnapshot(cachedSnapshot)
    }

    const bridge = bridgeRef.current

    if (bridge) {
      const workerSnapshot = await bridge.subscribe(sessionId)
      if (signal.aborted) return

      if (workerSnapshot) {
        applyStreamSnapshot(workerSnapshot)
        return
      }

      if (cachedSnapshot?.status === 'streaming') {
        const { streamRequest, stopRequest } = await buildResumeChatStreamRequest(
          sessionId,
          cachedSnapshot.lastEventSequence,
        )
        if (signal.aborted) return

        bridge.resumeStream({
          sessionId,
          streamRequest,
          stopRequest,
          snapshot: cachedSnapshot,
        })
        return
      }
    } else if (cachedSnapshot?.status === 'streaming') {
      await consumeStreamOnMainThread(
        cachedSnapshot,
        (signal) => resumeChatMessageStream(sessionId, cachedSnapshot.lastEventSequence, signal),
      )
      return
    }

    const session = await detail
    // 切换或删除当前会话后，旧详情不能再恢复消息。
    if (signal.aborted || currentSessionIdRef.current !== sessionId) return
    const restoredAgentName = session.agent_info?.agent_name?.trim() || ''

    // 刷新后从会话详情恢复智能体上下文，供后续继续对话。
    if (session.agent_id && restoredAgentName) {
      setActiveAgent({
        agentId: session.agent_id,
        agentName: restoredAgentName,
        description: '',
      })
    } else {
      setActiveAgent(null)
    }

    const nextMessages = session.messages.map(mapServerMessage)

    if (!session.has_running_stream) {
      setMessages(nextMessages)
      setIsResponding(false)
      setIsStopping(false)
      setRequestError('')
      return
    }

    const placeholder = buildAssistantPlaceholder(sessionId)
    const resumeSnapshot: ChatStreamSnapshot = {
      sessionId,
      messages: [...nextMessages, placeholder],
      status: 'streaming',
      error: null,
      activeMessageId: placeholder.id,
      lastEventSequence: 0,
    }

    persistChatStreamSnapshot(resumeSnapshot)
    applyStreamSnapshot(resumeSnapshot)

    if (bridge) {
      const { streamRequest, stopRequest } = await buildResumeChatStreamRequest(sessionId, 0)
      if (signal.aborted) return
      bridge.resumeStream({
        sessionId,
        streamRequest,
        stopRequest,
        snapshot: resumeSnapshot,
      })
      return
    }

    await consumeStreamOnMainThread(
      resumeSnapshot,
      (signal) => resumeChatMessageStream(sessionId, 0, signal),
    )
  }, [applyStreamSnapshot, consumeStreamOnMainThread])

  const submitPrompt = useCallback(async (
    promptOverride?: string,
    nextToolType?: string | null,
    attachmentOverride?: ChatAttachment[],
    submitOptions?: { enableWebSearch?: boolean; forceNewSession?: boolean; preserveInput?: boolean },
  ) => {
    const prompt = (promptOverride ?? inputValue).trim()

    if (!prompt || restoringModel || preparingPromptRef.current || isResponding || isStopping) {
      return
    }

    const attachments = attachmentOverride ?? draftAttachments
    const attachmentPayload = buildChatAttachmentPayload(attachments)
    const hasPendingAttachment = attachments.some((attachment) => attachment.status !== 'completed')

    if (hasPendingAttachment) {
      return
    }

    setRequestError('')
    setSelectedArtifact(null)
    setIsStopping(false)
    preparingPromptRef.current = true
    setPreparingPrompt(true)

    try {
      const resolvedToolType = nextToolType ?? activeToolType
      const activeAgentId = activeAgent?.agentId ?? null
      const sessionId = await resolveSubmitSessionId({
        currentSessionId: currentSessionIdRef.current,
        activeAgentId,
        forceNewSession: submitOptions?.forceNewSession ?? false,
        findLatestEmptySession,
        createChatSession,
      })

      if (currentSessionIdRef.current !== sessionId) {
        skipRestoreSessionIdRef.current = sessionId
        setModelSessionId(sessionId)
        setSearchParams({ sessionId })
      }

      currentSessionIdRef.current = sessionId

      const userMessage = buildUserMessage(sessionId, prompt, attachmentPayload.completedFiles)
      const assistantMessage = buildAssistantPlaceholder(sessionId)
      const initialSnapshot: ChatStreamSnapshot = {
        sessionId,
        messages: [...messagesRef.current, userMessage, assistantMessage],
        status: 'streaming',
        error: null,
        activeMessageId: assistantMessage.id,
        lastEventSequence: 0,
      }

      setMessages(initialSnapshot.messages)
      setIsResponding(true)
      preparingPromptRef.current = false
      setPreparingPrompt(false)
      // 录音单独发送识别结果，不能清掉切到语音前留下的文字草稿。
      if (!submitOptions?.preserveInput) {
        setInputValue('')
      }
      setDraftAttachments([])
      setActiveToolType(resolvedToolType ?? null)

      // 一轮发送固定同一份选择，后台发送和页面直连都使用这份请求体。
      const payload = {
        model,
        thinkingLevel,
        enableWebSearch: submitOptions?.enableWebSearch ?? false,
        message: prompt,
        skillName: resolvedToolType ?? undefined,
        uploadedFiles: attachmentPayload.uploadedFiles,
        resourceIds: attachmentPayload.resourceIds,
      }
      const bridge = bridgeRef.current

      if (bridge) {
        const { streamRequest, stopRequest } = await buildStartChatStreamRequest(sessionId, payload)
        persistChatStreamSnapshot(initialSnapshot)
        applyStreamSnapshot(initialSnapshot)
        bridge.startStream({
          sessionId,
          streamRequest,
          stopRequest,
          snapshot: initialSnapshot,
        })
      } else {
        await consumeStreamOnMainThread(
          initialSnapshot,
          (signal) => streamChatMessage(sessionId, payload, signal),
        )
      }

      await refreshSessions()
    } catch (error) {
      preparingPromptRef.current = false
      setPreparingPrompt(false)
      const errorMessage = error instanceof Error ? error.message : '发送失败，请稍后重试'
      setRequestError(errorMessage)
      setIsResponding(false)
      setIsStopping(false)
    }
  }, [
    applyStreamSnapshot,
    consumeStreamOnMainThread,
    draftAttachments,
    inputValue,
    activeAgent,
    activeToolType,
    isResponding,
    isStopping,
    restoringModel,
    model,
    thinkingLevel,
    refreshSessions,
    setSearchParams,
  ])

  const stopResponding = useCallback(async () => {
    const sessionId = currentSessionIdRef.current

    if (!sessionId || !isResponding || isStopping) {
      return
    }

    setIsStopping(true)
    abortReasonRef.current = 'user-stop'

    try {
      if (bridgeRef.current) {
        await bridgeRef.current.stopStream(sessionId)
      } else {
        abortControllerRef.current?.abort()
        abortControllerRef.current = null
        await stopChatMessageStream(sessionId)
      }

      clearChatStreamSnapshot(sessionId)
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '停止失败，请稍后重试')
    } finally {
      setIsStopping(false)
      setIsResponding(false)
    }
  }, [isResponding, isStopping])

  const openSession = useCallback((sessionId: string) => {
    setActiveAgent(null)
    setActiveToolType(null)
    setSearchParams({ sessionId })
  }, [setSearchParams])

  const removeSessionFromList = useCallback(async (sessionId: string, signal?: AbortSignal) => {
    await deleteChatSession(sessionId, signal)
    if (signal?.aborted) return
    // 后端确认后才移除；在删除前发出的列表响应不能把这一行加回去。
    ++sessionsVersion.current
    setIsLoadingSessions(false)
    setSessions((current) => current.filter((item) => item.session_id !== sessionId))
    if (currentSessionIdRef.current === sessionId) {
      currentSessionIdRef.current = null
      setSearchParams({})
      setMessages([])
      setRequestError('')
      clearChatStreamSnapshot(sessionId)
    }
  }, [setSearchParams])

  const removeSession = useCallback(async (sessionId: string) => {
    await removeSessionFromList(sessionId)
    await refreshSessions()
  }, [removeSessionFromList, refreshSessions])

  const startNewChat = useCallback((options?: { keepAgent?: boolean }) => {
    currentSessionIdRef.current = null
    skipRestoreSessionIdRef.current = null
    setSearchParams({})
    setMessages([])
    setInputValue('')
    setDraftAttachments([])
    setRequestError('')
    setIsResponding(false)
    setIsStopping(false)
    setSelectedArtifact(null)
    setActiveToolType(null)
    if (!options?.keepAgent) {
      setActiveAgent(null)
    }
  }, [setSearchParams])

  const activateAgent = useCallback((agent: ActiveAgentContext) => {
    setActiveAgent(agent)
    setActiveToolType(null)
    setRequestError('')
  }, [])

  const clearActiveAgent = useCallback(() => {
    setActiveAgent(null)
  }, [])

  const removeDraftAttachment = useCallback((attachmentId: string) => {
    setDraftAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
  }, [])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    const bridge = createChatStreamBridge((snapshot) => {
      if (snapshot.status === 'streaming' || snapshot.status === 'error') {
        persistChatStreamSnapshot(snapshot)
      } else {
        clearChatStreamSnapshot(snapshot.sessionId)
      }

      applyStreamSnapshot(snapshot)

      if (snapshot.status === 'completed') {
        void refreshSessions()
      }
    })

    bridgeRef.current = bridge

    return () => {
      bridgeRef.current?.destroy()
      bridgeRef.current = null
    }
  }, [applyStreamSnapshot, refreshSessions])

  useEffect(() => {
    if (!routeSessionId) {
      setModelSessionId(null)
      restorePreference()
      setMessages([])
      setIsResponding(false)
      setIsStopping(false)
      setRequestError('')
      return
    }

    if (skipRestoreSessionIdRef.current === routeSessionId) {
      skipRestoreSessionIdRef.current = null
      return
    }

    setModelSessionId(null)
    restoreHistory()
    const controller = new AbortController()
    const { signal } = controller
    // 即使消息可从快照恢复，模型配置仍来自同一次会话详情查询。
    const detail = getChatSession(routeSessionId, signal)
    const settings = detail.then((session) => {
      if (signal.aborted || currentSessionIdRef.current !== routeSessionId) return
      restoreHistory(session.model, session.thinking_level)
      // 即使历史项不在列表、消息由后台复原，页头也使用同一份会话详情。
      const { session_id, session_name, agent_id, agent_info } = session
      setRestoredHeader({ session_id, session_name, agent_id, agent_info })
    }).finally(() => { if (!signal.aborted) setModelSessionId(routeSessionId) })
    void Promise.all([restoreSession(routeSessionId, detail, signal), settings]).catch((error) => {
      if (!signal.aborted) setRequestError(error instanceof Error ? error.message : '恢复会话失败')
    })

    return () => {
      controller.abort()
      bridgeRef.current?.unsubscribe(routeSessionId)

      if (abortControllerRef.current) {
        abortReasonRef.current = 'session-change'
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [restoreHistory, restorePreference, restoreSession, routeSessionId])

  useEffect(() => {
    const state = location.state as ChatEntryState | null

    if (restoringModel || !state?.entryId || processedEntryIdRef.current === state.entryId) {
      return
    }

    processedEntryIdRef.current = state.entryId
    setActiveToolType(state.toolType ?? null)
    setDraftAttachments(state.attachments ?? [])

    if (state.autoSend) {
      void submitPrompt(
        state.initialPrompt,
        state.toolType ?? null,
        state.attachments ?? [],
        resolveChatEntrySubmitOptions(state),
      )
    } else {
      setInputValue((current) => current || state.initialPrompt)
    }

    navigate(
      {
        pathname: APP_ROUTE_PATHS.ai,
        search: location.search,
      },
      {
        replace: true,
        state: null,
      },
    )
  }, [location.search, location.state, navigate, restoringModel, submitPrompt])

  const activeSessionTitle = useMemo(() => {
    const activeSession = sessions.find((session) => session.session_id === routeSessionId)
    return activeSession ? getSessionDisplayName(activeSession) : '新对话'
  }, [routeSessionId, sessions])

  return {
    activeAgent,
    activeSessionTitle,
    activeToolType,
    activateAgent,
    canSend,
    clearActiveAgent,
    draftAttachments,
    inputValue,
    isLoadingSessions,
    isResponding,
    isStopping,
    modelControls,
    modelBusy: restoringModel || preparingPrompt,
    messages,
    requestError,
    restoredSessionHeader: restoredHeader?.session_id === routeSessionId ? restoredHeader : null,
    routeSessionId,
    selectedArtifact,
    sessions,
    setDraftAttachments,
    setInputValue,
    setActiveToolType,
    setSelectedArtifact,
    startNewChat,
    submitPrompt,
    stopResponding,
    openSession,
    refreshSessions,
    removeDraftAttachment,
    removeSession,
    removeSessionFromList,
  }
}

export function resolveArtifactPreviewUrl(sessionId: string | null, artifact: ChatArtifactItem): string {
  if (artifact.url.startsWith('http')) {
    return artifact.url
  }

  if (!sessionId) {
    return artifact.url
  }

  return buildArtifactPreviewUrl(sessionId, artifact.url)
}
