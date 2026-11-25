import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHmacAuthHeaders } from './hmacSign';

vi.mock('./hmacSign', () => ({ buildHmacAuthHeaders: vi.fn(async () => ({})) }));

const upstream = 'https://api.example.test';
const ossSignPath = '/jeecg-boot/open/aliyun/oss/v1/temp/url';
const ossSignUrl = `https://sign.example.test${ossSignPath}`;
let request: typeof import('./request');

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('VITE_API_BASE_URL', `${upstream}/jeecg-boot`);
  vi.stubEnv('VITE_AI_API_BASE_URL', upstream);
  vi.stubEnv('VITE_IM_MESSAGING_BASE_URL', `${upstream}/api/v1/messaging`);
  vi.stubEnv('VITE_OSS_SIGN_URL', ossSignUrl);
  request = await import('./request');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('本地接口转发', () => {
  it('仅转换已配置服务的接口，保留路径和查询参数', () => {
    vi.stubEnv('LOCAL_API_PROXY', 'true');
    const cases = [
      ['/jeecg-boot/sys/user/getBasicInfo?id=123', '/__app_proxy'],
      ['/api/v1/asr/realtime', '/__ai_proxy'],
      ['/api/v1/messaging/conversations?cursor=a%2Fb', '/__im_proxy'],
    ];

    for (const [path, prefix] of cases) {
      expect(request.resolveBrowserFetchUrl(`${upstream}${path}`)).toBe(`${location.origin}${prefix}${path}`);
    }
    for (const url of [
      `${upstream}/api/v10/example`,
      `${upstream}/assets/example.png`,
      'https://other.example.test/api/v1/messaging/conversations',
    ]) {
      expect(request.resolveBrowserFetchUrl(url)).toBe(url);
    }
  });

  it('给聊天后台线程生成包含页面来源的绝对地址', () => {
    vi.stubEnv('LOCAL_API_PROXY', 'true');
    expect(request.buildAiBrowserUrl('/api/v1/chat/sessions/example/stream', { cursor: 'a/b' }))
      .toBe(`${location.origin}/__ai_proxy/api/v1/chat/sessions/example/stream?cursor=a%2Fb`);
  });

  it('签名用真实上游地址，浏览器只请求本地地址', async () => {
    vi.stubEnv('LOCAL_API_PROXY', 'true');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await request.signedFetch('/sys/randomImage/123');
    const aiUrl = `${upstream}/api/v1/commands?user_id=123`;
    await request.authorizedFetch(aiUrl, { method: 'GET' });

    expect(buildHmacAuthHeaders).toHaveBeenNthCalledWith(1, `${upstream}/jeecg-boot/sys/randomImage/123`, 'GET');
    expect(fetchMock).toHaveBeenNthCalledWith(1, `${location.origin}/__app_proxy/jeecg-boot/sys/randomImage/123`, expect.anything());
    expect(buildHmacAuthHeaders).toHaveBeenNthCalledWith(2, aiUrl, 'GET');
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${location.origin}/__ai_proxy/api/v1/commands?user_id=123`, expect.anything());
  });

  it('开发环境单独转发 AI 附件签名，不改主后端同路径的请求和对象存储直传', async () => {
    vi.stubEnv('LOCAL_API_PROXY', 'true');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await request.authorizedFetch(ossSignUrl, { method: 'POST' });

    expect(buildHmacAuthHeaders).toHaveBeenCalledWith(ossSignUrl, 'POST');
    expect(fetchMock).toHaveBeenCalledWith(`${location.origin}/__oss_sign_proxy${ossSignPath}`, expect.anything());
    expect(request.resolveBrowserFetchUrl(`${upstream}${ossSignPath}`)).toBe(`${location.origin}/__app_proxy${ossSignPath}`);
    const objectUrl = 'https://bucket.example.test/agent_input/sample.png?fixture=1';
    expect(request.resolveBrowserFetchUrl(objectUrl)).toBe(objectUrl);

    vi.stubEnv('VITE_OSS_SIGN_URL', `${upstream}${ossSignPath}`);
    expect(request.resolveBrowserFetchUrl(`${upstream}${ossSignPath}`)).toBe(`${location.origin}/__app_proxy${ossSignPath}`);
  });

  it('未启用时维持原有直连', () => {
    vi.stubEnv('LOCAL_API_PROXY', 'false');
    const path = '/api/v1/chat/sessions';
    expect(request.buildAiBrowserUrl(path)).toBe(`${upstream}${path}`);
    expect(request.resolveBrowserFetchUrl(`${upstream}/jeecg-boot/sys/login`)).toBe(`${upstream}/jeecg-boot/sys/login`);
    expect(request.resolveBrowserFetchUrl(ossSignUrl)).toBe(ossSignUrl);
  });
});
