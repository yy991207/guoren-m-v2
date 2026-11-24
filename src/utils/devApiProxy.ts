// 即时聊天路径也在 /api/v1 下，同域时优先命中更具体的路由。
export const DEV_API_PROXY_ROUTES = [
  { prefix: '/__im_proxy', path: '/api/v1/messaging', envKey: 'VITE_IM_MESSAGING_BASE_URL', ws: false },
  { prefix: '/__app_proxy', path: '/jeecg-boot', envKey: 'VITE_API_BASE_URL', ws: false },
  { prefix: '/__ai_proxy', path: '/api/v1', envKey: 'VITE_AI_API_BASE_URL', ws: true },
] as const;
