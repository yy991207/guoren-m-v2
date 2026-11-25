import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { authorizedFetch } from '../../utils/request'

vi.mock('../../utils/request', () => ({
  authorizedFetch: vi.fn(),
  buildAiApiUrl: (path: string) => path,
}))
vi.mock('./api', () => ({ getChatUserId: () => 'fixture-user' }))

const signUrl = 'https://sign.example.test/jeecg-boot/open/aliyun/oss/v1/temp/url'
const objectUrl = 'https://bucket.example.test/agent_input/sample.jpg'
const signedUrl = `${objectUrl}?fixture=1`
let upload: typeof import('./upload')
let putStatus: number
const putOpen = vi.fn()
const putHeader = vi.fn()
const putSend = vi.fn()

class FakeUploadRequest {
  status = putStatus
  upload = {}
  onload?: () => void
  open = putOpen
  setRequestHeader = putHeader

  send(file: File) {
    putSend(file)
    this.onload?.()
  }
}

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('VITE_OSS_SIGN_URL', signUrl)
  vi.stubEnv('VITE_OSS_BUCKET_NAME', 'ai-files-fixture')
  vi.stubEnv('VITE_OSS_BUCKET_OTHER', 'im-files-fixture')
  vi.stubGlobal('XMLHttpRequest', FakeUploadRequest)
  putStatus = 200
  vi.mocked(authorizedFetch).mockResolvedValue(new Response(JSON.stringify({ success: true, result: signedUrl })))
  upload = await import('./upload')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('使用 AI 专用配置签名和上传，文件类型头固定为 text/plain，文件内容不变', async () => {
  const file = new File(['fixture'], '中文 图片.jpg', { type: 'image/jpeg' })
  const pending = upload.createPendingChatAttachment(file)

  await expect(upload.uploadPendingChatFile(pending, file)).resolves.toMatchObject({
    name: file.name,
    status: 'completed',
    url: objectUrl,
  })

  expect(authorizedFetch).toHaveBeenCalledTimes(1)
  expect(authorizedFetch).toHaveBeenCalledWith(signUrl, expect.objectContaining({
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucketName: 'ai-files-fixture',
      objectKey: pending.objectKey,
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
    }),
  }))
  expect(putOpen.mock.calls).toEqual([['PUT', signedUrl]])
  expect(putHeader.mock.calls).toEqual([['Content-Type', 'text/plain']])
  expect(putSend).toHaveBeenCalledTimes(1)
  expect(putSend.mock.calls[0]?.[0]).toBe(file)
})

it('直传 403 时保留失败提示，不继续提交文档解析', async () => {
  putStatus = 403
  const file = new File(['fixture'], '测试.pdf', { type: 'application/pdf' })

  await expect(upload.uploadChatFile(file)).rejects.toThrow('文件上传失败（HTTP 403）')
  expect(authorizedFetch).toHaveBeenCalledTimes(1)
})

it('AI 桶缺少配置时提示错误，不回退到即时聊天的桶', async () => {
  vi.stubEnv('VITE_OSS_BUCKET_NAME', '')
  vi.resetModules()
  const { uploadChatFile } = await import('./upload')

  await expect(uploadChatFile(new File(['fixture'], '测试.jpg'))).rejects.toThrow('缺少 AI 附件上传配置')
  expect(authorizedFetch).not.toHaveBeenCalled()
  expect(putOpen).not.toHaveBeenCalled()
})
