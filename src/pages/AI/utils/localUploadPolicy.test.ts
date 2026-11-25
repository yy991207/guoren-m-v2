import { expect, it } from 'vitest'
import { planLocalFilesForUpload } from './localUploadPolicy'

const createFiles = (...names: string[]) => names.map(name => new File(['fixture'], name))

it('一批多种类型共用 5 个名额，按选择顺序保留前 5 个', () => {
  const batch = createFiles('照片.png', '文档.md', '截图.jpg', '报告.pdf', '课程.mp4', '笔记.txt', '配图.svg')

  expect(planLocalFilesForUpload(batch)).toEqual({ filesToUpload: batch.slice(0, 5), exceededFileLimit: true })
  expect(batch).toHaveLength(7)
})

it('下一批独立计数，不因为上一批已经选满而拒绝上传', () => {
  const first = createFiles('1.md', '2.txt', '3.md', '4.pdf', '5.png')
  const second = createFiles('6.jpg', '7.pdf', '8.md', '9.txt', '10.png')

  expect(planLocalFilesForUpload(first)).toEqual({ filesToUpload: first, exceededFileLimit: false })
  expect(planLocalFilesForUpload(second)).toEqual({ filesToUpload: second, exceededFileLimit: false })
  expect(planLocalFilesForUpload([])).toEqual({ filesToUpload: [], exceededFileLimit: false })
})
