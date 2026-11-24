import { afterEach, describe, expect, it, vi } from 'vitest';

function setLogin(userId: string, tenantId: string) {
  localStorage.setItem('SUPERSONIC_TOKEN', 'test-auth');
  localStorage.setItem('userInfo', JSON.stringify({ id: userId, loginTenantId: tenantId }));
}

async function loadMessagingApi(host: string, useProxy: boolean) {
  vi.resetModules();
  vi.stubEnv('VITE_IM_MESSAGING_BASE_URL', `https://${host}/api/v1/messaging`);
  vi.stubEnv('LOCAL_API_PROXY', String(useProxy));
  return import('./messagingApi');
}

function mockMessagingResponse() {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
    new Response(JSON.stringify({ code: 0, data: { items: [], next_cursor: null } })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  localStorage.removeItem('SUPERSONIC_TOKEN');
  localStorage.removeItem('userInfo');
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('消息接口的租户用户标识', () => {
  it.each([
    { mode: '本地开发', host: 'ai.tongda365.com.cn', useProxy: true },
    { mode: '测试直连', host: 'ai.tongda365.com.cn', useProxy: false },
    { mode: '生产直连', host: 'ai.tongda365.com', useProxy: false },
  ])('$mode 使用当前租户的用户标识', async ({ host, useProxy }) => {
    setLogin('12345678901234567890', '1002');
    const { fetchConversations } = await loadMessagingApi(host, useProxy);
    const fetchMock = mockMessagingResponse();

    await fetchConversations('next', 100);

    const [input, options] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.origin).toBe(useProxy ? location.origin : `https://${host}`);
    expect(url.pathname).toBe(`${useProxy ? '/__im_proxy' : ''}/api/v1/messaging/conversations`);
    expect(url.searchParams.getAll('user_id')).toEqual(['1002_12345678901234567890']);
    expect(url.searchParams.get('limit')).toBe('100');
    expect(url.searchParams.get('cursor')).toBe('next');
    expect(new Headers(options?.headers).get('X-Tenant-Id')).toBe('1002');
  });

  it.each(['1002_12345', '1000_1001_12345'])('历史消息请求去掉已有前缀：%s', async (userId) => {
    setLogin(userId, '1002');
    const { fetchMessages } = await loadMessagingApi('ai.tongda365.com', false);
    const fetchMock = mockMessagingResponse();

    await fetchMessages('C2C#example', '42');

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/v1/messaging/conversations/C2C%23example/messages');
    expect(url.searchParams.get('user_id')).toBe('1002_12345');
    expect(url.searchParams.get('before')).toBe('42');
  });

  it.each([
    { userId: '12345', tenantId: '' },
    { userId: '12345', tenantId: 'invalid' },
    { userId: '1002_', tenantId: '1002' },
  ])('租户或业务用户标识无效时不发送请求', async ({ userId, tenantId }) => {
    setLogin(userId, tenantId);
    const { fetchConversations } = await loadMessagingApi('ai.tongda365.com.cn', true);
    const fetchMock = mockMessagingResponse();

    await expect(fetchConversations()).rejects.toThrow('请重新登录');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
