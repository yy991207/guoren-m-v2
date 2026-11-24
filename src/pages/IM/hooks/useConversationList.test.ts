import { renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useConversationList } from './useConversationList';

vi.mock('@tencentcloud/lite-chat', () => ({
  default: { EVENT: { CONVERSATION_LIST_UPDATED: 'conversation-list-updated' } },
}));
vi.mock('./useIMLogin', () => ({
  getChatInstance: () => ({
    getLoginUser: () => '1002_42',
    getConversationList: async () => ({
      data: {
        conversationList: [
          { conversationID: 'C2C1002_84', unreadCount: 3 },
          { conversationID: 'C2C1002_42', userProfile: { nick: '仅聊天 SDK 返回' } },
        ],
      },
    }),
    on: vi.fn(),
    off: vi.fn(),
  }),
}));
vi.mock('../utils/displayNameStore', () => ({ ensureDisplayNamesLoaded: vi.fn() }));
vi.mock('../api/messagingApi', () => ({
  fetchConversations: async () => ({
    items: [
      {
        conversation_id: '1002_42:1002_84',
        type: 'c2c',
        participants: ['42', '84'],
        title: '镜像会话标题',
      },
      {
        conversation_id: '1002_42:1002_42',
        type: 'c2c',
        participants: ['1002_42'],
        title: '仅含自己的镜像会话',
      },
    ],
  }),
}));

it('用实际登录账号合并同一会话，且不把镜像过滤规则用于 SDK 列表', async () => {
  const { result } = renderHook(() => useConversationList());
  await waitFor(() => expect(result.current.status).toBe('success'));

  expect(result.current.conversations).toMatchObject([
    { conversation_id: 'C2C1002_84', title: '镜像会话标题', unread_count: 3 },
    { conversation_id: 'C2C1002_42', title: '仅聊天 SDK 返回' },
  ]);
});
