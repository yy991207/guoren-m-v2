export type PreviewLanguage = 'html' | 'markdown' | 'text' | 'code' | 'json'

// 对齐 Web 的文本与源码格式。Office、媒体和其他二进制文件不能走文本预览接口。
const textExtensions = new Set(['txt', 'text', 'log', 'csv', 'conf', 'config', 'properties', 'props', 'rst'])
const codeExtensions = new Set((
  'js jsx ts tsx mjs cjs mts cts css scss sass less vue svelte astro py pyi pyw java kt kts scala groovy ' +
  'c h cpp cc cxx hpp hh cs go rs rb php sh bash zsh fish jsonc json5 yaml yml toml xml ini env mdx sql swift ' +
  'dart lua r matlab julia elm haskell hs elixir ex clojure clj cljs dockerfile docker tf tfvars hcl makefile ' +
  'cmake gradle gitignore gitattributes graphql gql proto prisma zig v'
).split(' '))

export function resolvePreviewLanguage(fileName: string): PreviewLanguage | null {
  const extension = fileName.split('/').pop()?.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'html' || extension === 'htm') return 'html'
  if (extension === 'md' || extension === 'markdown') return 'markdown'
  if (extension === 'json') return 'json'
  if (textExtensions.has(extension)) return 'text'
  if (codeExtensions.has(extension)) return 'code'
  return null
}
