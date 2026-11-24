import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, userInfo: null, logout: vi.fn() }),
}))
vi.mock('./pages/IM', () => ({ default: () => <h1>消息</h1> }))
vi.mock('./pages/Home', () => ({ default: () => <h1>首页内容</h1> }))

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

async function openMore() {
  await screen.findByRole('heading', { name: '消息' })
  fireEvent.click(screen.getByText('更多'))
  return screen.findByRole('dialog', { name: '更多' })
}

describe('更多面板', () => {
  it.each([
    ['任务', '我负责的'],
    ['日历', '功能开发中…'],
  ])('点击%s关闭面板并打开现有页面', async (entry, pageText) => {
    renderAt('/im')
    const drawer = await openMore()

    expect(within(drawer).getByText('发现')).toBeVisible()
    expect(within(drawer).queryByText('最近使用')).not.toBeInTheDocument()
    expect(within(drawer).queryByText('飞书 aily')).not.toBeInTheDocument()
    expect(within(drawer).queryByText('工作台')).not.toBeInTheDocument()

    fireEvent.click(within(drawer).getByRole('button', { name: entry }))

    expect(await screen.findByText(pageText)).toBeVisible()
    expect(screen.queryByRole('dialog', { name: '更多' })).not.toBeInTheDocument()
  })

  it.each([
    ['/task', '我负责的'],
    ['/calendar', '功能开发中…'],
  ])('直接打开 %s 不会被切回首页', async (path, pageText) => {
    renderAt(path)
    expect(await screen.findByText(pageText)).toBeVisible()
    expect(screen.queryByRole('heading', { name: '首页内容' })).not.toBeInTheDocument()
  })
})
