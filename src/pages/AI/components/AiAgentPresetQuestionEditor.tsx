import { useId, useState, type FormEvent } from 'react'
import {
  getPresetQuestionCategory,
  groupPresetQuestions,
  MAX_PRESET_CATEGORY_NAME_LENGTH,
  MAX_PRESET_QUESTION_CATEGORIES,
  MAX_PRESET_QUESTION_INSTRUCTION_LENGTH,
  MAX_PRESET_QUESTION_NAME_LENGTH,
  MAX_PRESET_QUESTIONS_PER_CATEGORY,
  type AiAgentPresetQuestion,
} from '../utils/agentPresetQuestions'
import './AiAgentPresetQuestionEditor.css'

type Props = {
  questions: AiAgentPresetQuestion[]
  onChange: (questions: AiAgentPresetQuestion[]) => void
}

type CategoryEdit = { original?: string; name: string; error?: string }

function createQuestion(category: string): AiAgentPresetQuestion {
  return {
    id: `preset-question-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    category,
    question: '',
    instruction: '',
  }
}

export function AiAgentPresetQuestionEditor({ questions, onChange }: Props) {
  const titleId = useId()
  const nameId = useId()
  const [categoryEdit, setCategoryEdit] = useState<CategoryEdit | null>(null)
  const groups = groupPresetQuestions(questions)
  const canAddCategory = groups.size < MAX_PRESET_QUESTION_CATEGORIES

  function saveCategory(event: FormEvent) {
    event.preventDefault()
    if (!categoryEdit) return
    const name = categoryEdit.name.trim()
    const original = categoryEdit.original
    if (categoryEdit.name === original) {
      setCategoryEdit(null)
      return
    }
    const error = !name ? '请输入分类名称'
      : name.length > MAX_PRESET_CATEGORY_NAME_LENGTH ? `分类名称最多 ${MAX_PRESET_CATEGORY_NAME_LENGTH} 字`
      : groups.has(name) ? '该分类已存在' : ''
    if (error) {
      setCategoryEdit({ ...categoryEdit, error })
      return
    }
    if (original === undefined) {
      if (!canAddCategory) return
      onChange([...questions, createQuestion(name)])
    } else {
      onChange(questions.map(item => getPresetQuestionCategory(item.category) === original ? { ...item, category: name } : item))
    }
    setCategoryEdit(null)
  }

  function renderCategoryForm() {
    if (!categoryEdit) return null
    return (
      <form className="ai-preset-category-form" onSubmit={saveCategory}>
        <label className="ai-preset-category-form-field" htmlFor={nameId}>
          <span className="ai-agent-config-field-label">分类名称</span>
          <input
            aria-invalid={Boolean(categoryEdit.error)}
            className="ai-agent-config-input"
            id={nameId}
            maxLength={MAX_PRESET_CATEGORY_NAME_LENGTH}
            type="text"
            value={categoryEdit.name}
            onChange={event => setCategoryEdit({ ...categoryEdit, name: event.target.value, error: undefined })}
          />
        </label>
        <div className="ai-preset-category-form-actions">
          <button className="ai-agent-config-remove-btn" type="button" onClick={() => setCategoryEdit(null)}>取消</button>
          <button className="ai-agent-config-link-btn" type="submit">确定</button>
        </div>
        {categoryEdit.error && <p className="ai-preset-category-error" role="alert">{categoryEdit.error}</p>}
      </form>
    )
  }

  const updateQuestion = (id: string, patch: Partial<Pick<AiAgentPresetQuestion, 'question' | 'instruction'>>) => {
    onChange(questions.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  return (
    <section aria-labelledby={titleId} className="ai-agent-config-card">
      <div className="ai-agent-config-section-head">
        <div className="ai-agent-config-card-title" id={titleId}>对话配置</div>
        <button
          className="ai-agent-config-link-btn ai-preset-category-action"
          disabled={!canAddCategory || categoryEdit !== null}
          type="button"
          onClick={() => setCategoryEdit({ name: '' })}
        >
          添加分类
        </button>
      </div>
      <p className="ai-preset-category-note">
        {groups.size}/{MAX_PRESET_QUESTION_CATEGORIES} 个分类 · 每类最多 {MAX_PRESET_QUESTIONS_PER_CATEGORY} 个问题
      </p>
      {categoryEdit && categoryEdit.original === undefined && renderCategoryForm()}
      {!questions.length && !categoryEdit && <div className="ai-agent-config-empty">暂未配置推荐问题</div>}
      <div className="ai-preset-category-editor">
        {[...groups].map(([category, items]) => (
          <section aria-label={category} className="ai-agent-question-list" key={category}>
            <div className="ai-preset-category-header">
              <h3 className="ai-preset-category-name">{category}</h3>
              <span className="ai-preset-category-count">{items.length}/{MAX_PRESET_QUESTIONS_PER_CATEGORY}</span>
              <button
                aria-label={`重命名分类 ${category}`}
                className="ai-agent-config-remove-btn ai-preset-category-action"
                disabled={categoryEdit !== null}
                type="button"
                onClick={() => setCategoryEdit({ original: category, name: category })}
              >
                重命名
              </button>
              <button
                aria-label={`添加问题到 ${category}`}
                className="ai-agent-config-link-btn ai-preset-category-action"
                disabled={items.length >= MAX_PRESET_QUESTIONS_PER_CATEGORY}
                type="button"
                onClick={() => onChange([...questions, createQuestion(category)])}
              >
                添加问题
              </button>
            </div>
            {categoryEdit?.original === category && renderCategoryForm()}
            {items.map((item, index) => (
              <article className="ai-agent-question-card" key={item.id}>
                <div className="ai-agent-config-field">
                  <div className="ai-agent-question-card-head">
                    <label className="ai-agent-config-field-label" htmlFor={`${nameId}-${item.id}`}>名称</label>
                    <button
                      aria-label={`删除问题${index + 1}`}
                      className="ai-agent-config-remove-btn"
                      type="button"
                      onClick={() => {
                        if (items.length === 1 && categoryEdit?.original === category) setCategoryEdit(null)
                        onChange(questions.filter(question => question.id !== item.id))
                      }}
                    >
                      移除
                    </button>
                  </div>
                  <input
                    className="ai-agent-config-input"
                    id={`${nameId}-${item.id}`}
                    maxLength={MAX_PRESET_QUESTION_NAME_LENGTH}
                    placeholder="请输入推荐问题名称"
                    type="text"
                    value={item.question}
                    onChange={event => updateQuestion(item.id, { question: event.target.value })}
                  />
                </div>
                <label className="ai-agent-config-field">
                  <span className="ai-agent-config-field-label">指令</span>
                  <textarea
                    className="ai-agent-config-textarea is-compact"
                    maxLength={MAX_PRESET_QUESTION_INSTRUCTION_LENGTH}
                    placeholder="请输入点击推荐问题后发送的具体指令"
                    rows={4}
                    value={item.instruction}
                    onChange={event => updateQuestion(item.id, { instruction: event.target.value })}
                  />
                </label>
              </article>
            ))}
          </section>
        ))}
      </div>
    </section>
  )
}
