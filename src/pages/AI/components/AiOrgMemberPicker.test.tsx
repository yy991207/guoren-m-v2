import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { searchDepartAndUser } from '../../../services/aiOrgMembers'
import { fetchUserBasicInfo, type UserBasicInfo } from '../../IM/api/userBasicInfo'
import { AiOrgMemberPicker } from './AiOrgMemberPicker'

vi.mock('../../../services/aiOrgMembers', async (load) => ({
  ...await load<typeof import('../../../services/aiOrgMembers')>(), searchDepartAndUser: vi.fn(),
}))
vi.mock('../../IM/api/userBasicInfo', () => ({ fetchUserBasicInfo: vi.fn() }))

const missing = { id: 'member-1', realname: 'member-1' }
const unavailable = { id: 'member-2', realname: 'member-2' }
const known = { id: 'member-3', realname: '目录里的谢老师', avatar: '/existing-avatar.png' }
const profile = { userID: missing.id, displayName: '周老师', avatar: '/profile-avatar.png' }
const lookup = vi.mocked(fetchUserBasicInfo)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(searchDepartAndUser).mockResolvedValue({ departs: [], users: [] })
})

it('只查询以 ID 代替姓名的已选成员，资料不回写草稿，查不到的成员可移除', async () => {
  const onChange = vi.fn()
  lookup.mockImplementation(async id => id === missing.id ? profile : null)
  const view = render(<AiOrgMemberPicker selectedUsers={[missing, unavailable, known]} onChange={onChange} />)
  await screen.findByText('周老师')
  const selected = view.container.querySelector('.ai-org-member-picker-selected-list') as HTMLElement
  expect(within(selected).getByText(known.realname)).toBeVisible()
  expect(selected.querySelector('img[src="/profile-avatar.png"]')).toBeInTheDocument()
  expect(selected.querySelector('img[src="/existing-avatar.png"]')).toBeInTheDocument()
  expect(lookup.mock.calls.map(([id]) => id)).toEqual([missing.id, unavailable.id])
  expect(within(selected).getByText(unavailable.id)).toBeVisible()
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(within(selected).getByRole('button', { name: `移除${unavailable.id}` }))
  expect(onChange).toHaveBeenCalledWith([missing, known])
})

it('先移除再返回资料时不恢复成员，也不重复查询其他已选项', async () => {
  let resolve!: (data: UserBasicInfo) => void
  lookup.mockReturnValueOnce(new Promise(resolveProfile => { resolve = resolveProfile })).mockResolvedValue(null)
  function Picker() {
    const [selected, setSelected] = useState([missing, unavailable])
    return <AiOrgMemberPicker selectedUsers={selected} onChange={setSelected} />
  }
  render(<Picker />)
  fireEvent.click(screen.getByRole('button', { name: `移除${missing.id}` }))
  await act(async () => resolve(profile))
  expect(screen.queryByText('周老师')).not.toBeInTheDocument()
  expect(screen.getByText('已选 1 人')).toBeVisible()
  expect(lookup.mock.calls.map(([id]) => id)).toEqual([missing.id, unavailable.id])
})
