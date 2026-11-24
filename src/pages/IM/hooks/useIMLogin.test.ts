import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { auth, chat, createChat } = vi.hoisted(() => {
  const chat = {
    getLoginUser: vi.fn<() => string>(),
    login: vi.fn(async (_options: { userID: string; userSig: string }) => {}),
    logout: vi.fn(async () => {}),
    on: vi.fn(),
  };
  return {
    auth: { isAuthenticated: true, userInfo: { id: '12345', loginTenantId: '1002' }, token: 'test-auth' },
    chat,
    createChat: vi.fn(() => chat),
  };
});

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@tencentcloud/lite-chat', () => ({
  default: {
    create: createChat,
    EVENT: { SDK_READY: 'ready', SDK_NOT_READY: 'not-ready', KICKED_OUT: 'kicked-out' },
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/jeecg-boot');
  vi.stubEnv('LOCAL_API_PROXY', 'false');
  auth.userInfo = { id: '12345', loginTenantId: '1002' };
  chat.getLoginUser.mockReturnValue('');
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubSignatureRequest() {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
    new Response(JSON.stringify({ success: true, result: 'test-sig' })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('即时聊天登录账号', () => {
  it('凭证签发和腾讯云登录使用同一个完整账号', async () => {
    auth.userInfo.id = '1000_1001_12345';
    const fetchMock = stubSignatureRequest();
    const { useIMLogin } = await import('./useIMLogin');
    const { result } = renderHook(useIMLogin);

    await waitFor(() => expect(result.current.loginStatus).toBe('success'));

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/jeecg-boot/sys/group/im/userSig');
    expect(url.searchParams.get('userId')).toBe('1002_12345');
    expect(chat.login).toHaveBeenCalledWith({ userID: '1002_12345', userSig: 'test-sig' });
  });

  it('已有旧账号连接时先登出，不复用成当前租户登录', async () => {
    chat.getLoginUser.mockReturnValue('1000_12345');
    stubSignatureRequest();
    const { useIMLogin } = await import('./useIMLogin');
    const { result } = renderHook(useIMLogin);

    await waitFor(() => expect(result.current.loginStatus).toBe('success'));

    expect(chat.logout).toHaveBeenCalledOnce();
    expect(chat.logout.mock.invocationCallOrder[0]).toBeLessThan(chat.login.mock.invocationCallOrder[0]);
    expect(chat.login).toHaveBeenCalledWith({ userID: '1002_12345', userSig: 'test-sig' });
  });

  it('缺少租户时不申请凭证，也不登录腾讯云', async () => {
    auth.userInfo.loginTenantId = '';
    const fetchMock = stubSignatureRequest();
    const { useIMLogin } = await import('./useIMLogin');
    const { result } = renderHook(useIMLogin);

    await waitFor(() => expect(result.current.loginStatus).toBe('error'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(createChat).not.toHaveBeenCalled();
  });
});
