export const MAX_LOCAL_UPLOAD_FILES_PER_BATCH = 5

export function planLocalFilesForUpload(selectedFiles: readonly File[]) {
  // 每次选择单独计数，图片、文档和其他可上传类型共用名额。
  return {
    filesToUpload: selectedFiles.slice(0, MAX_LOCAL_UPLOAD_FILES_PER_BATCH),
    exceededFileLimit: selectedFiles.length > MAX_LOCAL_UPLOAD_FILES_PER_BATCH,
  }
}
