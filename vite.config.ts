import type { IncomingMessage } from 'node:http'
import { TLSSocket } from 'node:tls'
import { defineConfig, loadEnv } from 'vite'
import type { ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { DEV_API_PROXY_ROUTES } from './src/utils/devApiProxy'

function getDevOrigin(request: IncomingMessage): string {
  const scheme = request.socket instanceof TLSSocket ? 'https' : 'http'
  return `${scheme}://${request.headers.host}`
}

// https://vite.dev/config/
export default defineConfig(({ command, mode, isPreview }) => {
  const useDevApiProxy = command === 'serve' && mode === 'development' && !isPreview
  const proxy: Record<string, ProxyOptions> = {}
  if (useDevApiProxy) {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    for (const { prefix, path, envKey, ws } of DEV_API_PROXY_ROUTES) {
      // 目标只从环境配置取域名；去掉本地前缀后，保留上游原路径和查询参数。
      proxy[`^${prefix}${path}(?:/|\\?|$)`] = {
        target: new URL(env[envKey]).origin,
        changeOrigin: true,
        ws,
        rewrite: (requestPath) => requestPath.slice(prefix.length),
        bypass(request) {
          // 浏览器只能从开发页自己的来源使用代理，WebSocket 握手也检查。
          const origin = request.headers.origin
          if (origin && origin !== getDevOrigin(request)) return false
        },
        configure(proxyServer) {
          proxyServer.on('proxyReq', (request, incoming) => {
            // 同源请求会带本地 Cookie 和完整 Referer；上游仍按原有跨域规则验签。
            request.removeHeader('cookie')
            const origin = getDevOrigin(incoming)
            if (incoming.headers.origin === origin) request.removeHeader('origin')
            if (incoming.headers.referer?.startsWith(`${origin}/`)) {
              request.setHeader('referer', `${origin}/`)
            }
          })
          proxyServer.on('proxyReqWs', (request) => request.removeHeader('cookie'))
          proxyServer.on('proxyRes', (response) => {
            delete response.headers['set-cookie']
          })
        },
      }
    }
  }

  return {
    define: {
      'import.meta.env.LOCAL_API_PROXY': JSON.stringify(String(useDevApiProxy)),
    },
    server: {
      host: '0.0.0.0',
      proxy,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }

            if (id.includes('react-router')) {
              return 'vendor-router'
            }

            if (
              id.includes('react-markdown')
              || id.includes('remark-gfm')
              || id.includes('micromark')
              || id.includes('mdast')
              || id.includes('hast')
              || id.includes('unified')
              || id.includes('unist')
            ) {
              return 'vendor-markdown'
            }

            if (
              id.includes('/react/')
              || id.includes('/react-dom/')
              || id.includes('/scheduler/')
            ) {
              return 'vendor-react'
            }

            return 'vendor'
          },
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: '果仁',
          short_name: '果仁',
          description: '果仁 - 移动端应用',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
  }
})
