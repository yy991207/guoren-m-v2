import { useId, useMemo } from 'react'
import { groupPresetQuestions, type AiAgentPresetQuestion } from '../utils/agentPresetQuestions'
import './AiAgentPresetQuestionGroups.css'

type Props = {
  questions: AiAgentPresetQuestion[]
  onSelect?: (prompt: string) => void
}

export function AiAgentPresetQuestionGroups({ questions, onSelect }: Props) {
  const titleId = useId()
  const groups = useMemo(() => groupPresetQuestions(questions.filter(item => item.question.trim())), [questions])
  if (!groups.size) return null

  return (
    <section aria-labelledby={titleId} className="ai-preset-questions">
      <h2 className="ai-preset-questions-title" id={titleId}>推荐问题</h2>
      {[...groups].map(([category, items]) => (
        <section aria-label={category} className="ai-preset-questions-group" key={category}>
          <h3>{category}</h3>
          <ul className="ai-preset-questions-list">
            {items.map(item => (
              <li key={item.id}>
                {onSelect ? (
                  <button className="ai-preset-question" type="button" onClick={() => onSelect(item.instruction || item.question)}>
                    {item.question}
                  </button>
                ) : <span className="ai-preset-question">{item.question}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
