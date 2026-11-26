import { useId, useMemo, useState } from 'react'
import { groupPresetQuestions, type AiAgentPresetQuestion } from '../utils/agentPresetQuestions'
import { AiSectionTabs } from './AiSectionTabs'
import './AiAgentPresetQuestionGroups.css'

type Props = {
  questions: AiAgentPresetQuestion[]
  onSelect?: (prompt: string) => void
}

function PresetQuestionList({ questions, onSelect }: Props) {
  return (
    <ul className="ai-preset-questions-list">
      {questions.map(item => (
        <li key={item.id}>
          {onSelect ? (
            <button className="ai-preset-question" type="button" onClick={() => onSelect(item.instruction || item.question)}>
              {item.question}
            </button>
          ) : <span className="ai-preset-question">{item.question}</span>}
        </li>
      ))}
    </ul>
  )
}

export function AiAgentPresetQuestionGroups({ questions, onSelect }: Props) {
  const titleId = useId()
  const [selectedCategory, setSelectedCategory] = useState<string>()
  const groups = useMemo(() => groupPresetQuestions(questions.filter(item => item.question.trim())), [questions])
  const activeCategory = selectedCategory !== undefined && groups.has(selectedCategory)
    ? selectedCategory
    : groups.keys().next().value
  if (activeCategory === undefined) return null

  return (
    <section aria-labelledby={titleId} className="ai-preset-questions">
      <h2 className="ai-preset-questions-title" id={titleId}>推荐问题</h2>
      {onSelect ? (
        <div className="ai-preset-questions-tabs">
          <AiSectionTabs
            label="推荐问题分类"
            tabs={[...groups].map(([category, items]) => ({
              key: category,
              label: category,
              content: category === activeCategory ? <PresetQuestionList questions={items} onSelect={onSelect} /> : null,
            }))}
            value={activeCategory}
            onChange={setSelectedCategory}
          />
        </div>
      ) : [...groups].map(([category, items]) => (
        <section aria-label={category} className="ai-preset-questions-group" key={category}>
          <h3>{category}</h3>
          <PresetQuestionList questions={items} />
        </section>
      ))}
    </section>
  )
}
