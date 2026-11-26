export type AiAgentPresetQuestion = {
  id: string
  category?: string
  question: string
  instruction: string
}

export const MAX_PRESET_QUESTION_CATEGORIES = 5
export const MAX_PRESET_QUESTIONS_PER_CATEGORY = 3
export const MAX_PRESET_CATEGORY_NAME_LENGTH = 8
export const MAX_PRESET_QUESTION_NAME_LENGTH = 8
export const MAX_PRESET_QUESTION_INSTRUCTION_LENGTH = 100

export function getPresetQuestionCategory(category: string | undefined): string {
  return typeof category === 'string' && category.trim() ? category : '分类1'
}

export function groupPresetQuestions<T extends { category?: string }>(questions: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const question of questions) {
    const category = getPresetQuestionCategory(question.category)
    const group = groups.get(category)
    if (group) group.push(question)
    else groups.set(category, [question])
  }
  return groups
}

export function serializePresetQuestions(questions: readonly AiAgentPresetQuestion[]) {
  return questions.map((item) => ({
    category: getPresetQuestionCategory(item.category),
    question: item.question.trim(),
    instruction: item.instruction.trim(),
  }))
}

export function arePresetQuestionsUnchanged(previous: readonly AiAgentPresetQuestion[], current: readonly AiAgentPresetQuestion[]): boolean {
  // 以实际提交内容为准，界面 ID 和无意义的首尾空格不算修改。
  return JSON.stringify(serializePresetQuestions(previous)) === JSON.stringify(serializePresetQuestions(current))
}

export function validatePresetQuestions(questions: readonly AiAgentPresetQuestion[]): string {
  const groups = groupPresetQuestions(questions)
  if (groups.size > MAX_PRESET_QUESTION_CATEGORIES) {
    return `推荐问题最多 ${MAX_PRESET_QUESTION_CATEGORIES} 个分类，请移除多余分类的问题后再发布`
  }

  for (const [category, items] of groups) {
    if (items.length > MAX_PRESET_QUESTIONS_PER_CATEGORY) {
      return `「${category}」最多 ${MAX_PRESET_QUESTIONS_PER_CATEGORY} 个问题，请调整后再发布`
    }
    if (category.length > MAX_PRESET_CATEGORY_NAME_LENGTH) {
      return `分类名称最多 ${MAX_PRESET_CATEGORY_NAME_LENGTH} 字，请缩短「${category}」后再发布`
    }
    for (const item of items) {
      const name = item.question.trim()
      const instruction = item.instruction.trim()
      if (!name || !instruction) {
        return `请填写「${category}」下所有问题的名称和指令后再发布`
      }
      if (name.length > MAX_PRESET_QUESTION_NAME_LENGTH) {
        return `「${category}」下的问题名称最多 ${MAX_PRESET_QUESTION_NAME_LENGTH} 字`
      }
      if (instruction.length > MAX_PRESET_QUESTION_INSTRUCTION_LENGTH) {
        return `「${category}」下的问题指令最多 ${MAX_PRESET_QUESTION_INSTRUCTION_LENGTH} 字`
      }
    }
  }
  return ''
}
