import { expect, it } from 'vitest'
import { arePresetQuestionsUnchanged, groupPresetQuestions, serializePresetQuestions, validatePresetQuestions, type AiAgentPresetQuestion } from './agentPresetQuestions'

const question = (index: number, category?: string): AiAgentPresetQuestion => ({
  id: String(index), question: `问题${index}`, instruction: `指令${index}`, category,
})

it('空白分类并入分类1，已有分类原样回传，保留分类首次出现顺序', () => {
  const items = [question(0, ' 备课 '), question(1), question(2, '  '), question(3, '课堂'), question(4, '分类1')]
  const groups = groupPresetQuestions(items)
  expect([...groups.keys()]).toEqual([' 备课 ', '分类1', '课堂'])
  expect(groups.get('分类1')).toHaveLength(3)
  expect(serializePresetQuestions(items).map(item => item.category)).toEqual([' 备课 ', '分类1', '分类1', '课堂', '分类1'])
})

it('校验5个分类和单类3题，旧数据未修改时可识别，清空列表不等于未修改', () => {
  const full = Array.from({ length: 15 }, (_, i) => question(i, `分组${Math.floor(i / 3) + 1}`))
  expect(validatePresetQuestions(full)).toBe('')
  expect(validatePresetQuestions([...full, question(15, '新分类')])).toContain('最多 5 个分类')
  const legacy = [question(0), question(1, ''), question(2, '  '), question(3, '分类1')]
  expect(validatePresetQuestions(legacy)).toContain('「分类1」最多 3 个问题')
  expect(arePresetQuestionsUnchanged(legacy, legacy.map(item => ({ ...item, category: '分类1' })))).toBe(true)
  expect(arePresetQuestionsUnchanged(legacy, [])).toBe(false)
  expect(validatePresetQuestions([])).toBe('')
})

it('发布前校验分类名称、问题名称和问题指令的长度边界', () => {
  const item = { ...question(0, '类'.repeat(8)), question: '问'.repeat(8), instruction: '答'.repeat(100) }
  expect(validatePresetQuestions([item])).toBe('')
  expect(validatePresetQuestions([{ ...item, category: '类'.repeat(9) }])).toContain('分类名称最多 8 字')
  expect(validatePresetQuestions([{ ...item, question: '问'.repeat(9) }])).toContain('问题名称最多 8 字')
  expect(validatePresetQuestions([{ ...item, instruction: '答'.repeat(101) }])).toContain('问题指令最多 100 字')
})
