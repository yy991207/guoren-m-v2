/**
 * IM SDK 登录/登出/生命周期管理 Hook
 *
 * 封装 SDK 初始化、登录、事件监听、登出等完整链路
 * 通过 useRef 持有 SDK 实例，避免重复创建
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import TencentCloudChat from '@tencentcloud/lite-chat';
import { useAuth } from '../../../contexts/AuthContext';
import { handleUnauthorizedResponse, resolveBrowserFetchUrl } from '../../../utils/request';
import { resolveImScopedUserId } from '../utils/imScopedUserId';

// 三个环境共用同一个腾讯云即时聊天应用编号，需与后端签发凭证时使用的编号一致。
const SDKAPPID = 1600144098;

// 登录链路状态
export type LoginStatus = 'idle' | 'loading' | 'success' | 'error';
type ChatInstance = ReturnType<typeof TencentCloudChat.create>;

// SDK 实例引用（模块级，全局唯一）
let globalChatInstance: ChatInstance | null = null;

/**
 * 获取 userSig（从后端签发）
 * @param userID 用户 ID
 * @param token 登录 token
 */
async function getUserSig(userID: string, token: string): Promise<string> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const url = `${baseUrl}/sys/group/im/userSig?userId=${encodeURIComponent(userID)}`;

  const response = await fetch(resolveBrowserFetchUrl(url), {
    headers: {
      'X-Access-Token': token,
      'Accept': 'application/json, text/plain, */*',
    },
  });

  if (handleUnauthorizedResponse(response)) {
    throw new Error('Token失效，请重新登录!');
  }

  const payload = await response.json();
  if (handleUnauthorizedResponse(response, payload)) {
    throw new Error(payload?.message || payload?.msg || 'Token失效，请重新登录!');
  }

  if (!response.ok) {
    throw new Error(`获取 IM userSig 失败 (HTTP ${response.status})`);
  }

  const ok = payload?.success === true || String(payload?.code || '') === '200';
  const sig = ok ? String(payload?.result ?? '').trim() : '';

  if (!ok || !sig) {
    throw new Error('获取 IM userSig 失败，请检查后端签名接口返回');
  }

  return sig;
}

export function useIMLogin() {
  const { token, userInfo, isAuthenticated } = useAuth();
  const tenantId = String(userInfo?.loginTenantId ?? '').trim();
  const imUserID = /^\d+$/.test(tenantId) ? resolveImScopedUserId(userInfo?.id ?? '', tenantId) : '';
  const [loginStatus, setLoginStatus] = useState<LoginStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<ChatInstance | null>(null);

  /**
   * 初始化并登录 SDK
   */
  const doLogin = useCallback(async () => {
    if (!isAuthenticated || !userInfo?.id || !token) {
      setError('用户未登录');
      setLoginStatus('error');
      return;
    }

    if (!imUserID.startsWith(`${tenantId}_`)) {
      setError('缺少有效的即时聊天租户或用户标识，请重新登录');
      setLoginStatus('error');
      return;
    }

    // 切换租户后，不能把旧账号的连接当成本次登录成功。
    if (String(chatRef.current?.getLoginUser?.() ?? '') === imUserID) {
      setLoginStatus('success');
      return;
    }

    setLoginStatus('loading');
    setError(null);

    try {
      const userSig = await getUserSig(imUserID, token);

      // 创建 SDK 实例；切换租户时先退出旧账号，再用与签发一致的账号登录。
      const chat = TencentCloudChat.create({ SDKAppID: SDKAPPID });
      const previousUserID = String(chat.getLoginUser?.() ?? '');
      if (previousUserID && previousUserID !== imUserID) {
        await chat.logout();
      }
      chatRef.current = chat;
      globalChatInstance = chat;

      // 注册全局事件监听
      chat.on(TencentCloudChat.EVENT.SDK_READY, () => {
        console.log('[IM] SDK READY');
      });

      chat.on(TencentCloudChat.EVENT.SDK_NOT_READY, () => {
        console.log('[IM] SDK NOT READY');
      });

      chat.on(TencentCloudChat.EVENT.KICKED_OUT, () => {
        console.warn('[IM] 被踢下线');
        // 被踢下线后重置状态
        setLoginStatus('error');
        setError('账号已在其他设备登录');
      });

      // 签发和登录必须使用同一个带租户前缀的账号。
      await chat.login({ userID: imUserID, userSig });
      setLoginStatus('success');
    } catch (err) {
      console.error('[IM] 登录失败:', err);
      setError(err instanceof Error ? err.message : 'IM 登录失败');
      setLoginStatus('error');
    }
  }, [imUserID, isAuthenticated, tenantId, token, userInfo?.id]);

  /**
   * 登出 SDK
   */
  const doLogout = useCallback(async () => {
    try {
      if (chatRef.current) {
        await chatRef.current.logout();
        chatRef.current = null;
        globalChatInstance = null;
      }
    } catch (err) {
      console.error('[IM] 登出失败:', err);
    } finally {
      setLoginStatus('idle');
      setError(null);
    }
  }, []);

  /**
   * 监听登录态变化，自动登录/登出
   */
  useEffect(() => {
    if (isAuthenticated && userInfo?.id && token) {
      void doLogin();
    } else {
      void doLogout();
    }
  }, [isAuthenticated, userInfo?.id, token, doLogin, doLogout]);

  /**
   * 组件卸载时清理
   */
  useEffect(() => {
    return () => {
      // 页面卸载时不自动登出，保持 WebSocket 连接
      // 真正的登出由 AuthContext 的 logout 触发
    };
  }, []);

  return {
    chat: chatRef.current,
    loginStatus,
    error,
    doLogin,
    doLogout,
  };
}

/**
 * 获取全局 SDK 实例（供外部调用）
 */
export function getChatInstance(): ChatInstance | null {
  return globalChatInstance;
}
