import { describe, expect, it } from 'vitest';
import { isValidMirrorConversation, toMirrorConversationID, toSdkConversationID } from './messagingConversationID';

const self = '1002_42';
const peer = '1002_84';
const mirrorID = `${self}:${peer}`;

describe('镜像会话 ID 与聊天 SDK 会话 ID 转换', () => {
  it.each([[self, peer], [peer, self]])('从 %s 登录时，带租户的单聊可以双向转换', (login, other) => {
    expect(isValidMirrorConversation({ conversation_id: mirrorID, type: 'c2c', participants: null }, login)).toBe(true);
    const sdkID = toSdkConversationID(mirrorID, 'c2c', login);
    expect(sdkID).toBe(`C2C${other}`);
    expect(toMirrorConversationID(sdkID, login)).toBe(mirrorID);
  });

  it('机器人单聊保留对端原有账号格式', () => {
    const bot = '@RBT#helper';
    const id = `${self}:${bot}`;
    expect(isValidMirrorConversation({ conversation_id: id, type: 'ai_c2c', participants: [self, bot] }, self)).toBe(true);
    const sdkID = toSdkConversationID(id, 'ai_c2c', self);
    expect(sdkID).toBe(`C2C${bot}`);
    expect(toMirrorConversationID(sdkID, self)).toBe(id);
  });

  it.each([
    ['group', '@TGS#group_1'],
    ['community', '@TGS#community_1'],
  ] as const)('%s 不受单聊过滤影响，且不重复加前缀', (type, id) => {
    expect(isValidMirrorConversation({ conversation_id: id, type, participants: [self] }, self)).toBe(true);
    const sdkID = toSdkConversationID(id, type, self);
    expect(sdkID).toBe(`GROUP${id}`);
    expect(toSdkConversationID(sdkID, type, self)).toBe(sdkID);
    expect(toMirrorConversationID(sdkID, self)).toBe(id);
  });

  it.each([peer, `C2C${peer}`])('兼容参考项目已支持的对端 ID：%s', (id) => {
    expect(isValidMirrorConversation({ conversation_id: id, type: 'c2c', participants: null }, self)).toBe(true);
    expect(toSdkConversationID(id, 'c2c', self)).toBe(`C2C${peer}`);
  });
});

describe('只显示身份可确认的镜像单聊', () => {
  it.each([
    { reason: '成员只有自己', id: mirrorID, participants: [self, self] },
    { reason: '会话 ID 两端都是自己', id: `${self}:${self}`, participants: null },
    { reason: '会话 ID 有三段', id: `${self}:${self}:${peer}`, participants: [self, peer] },
    { reason: '会话 ID 缺完整登录账号', id: `42:${peer}`, participants: [self, peer] },
    { reason: '会话 ID 的对端为空', id: `${self}:`, participants: null },
    { reason: '混用 SDK 前缀和双账号格式', id: `C2C${peer}:${self}`, participants: null },
    { reason: 'SDK 格式指向自己', id: `C2C${self}`, participants: null },
  ])('过滤$reason的单聊和机器人单聊', ({ id, participants }) => {
    expect(isValidMirrorConversation({ conversation_id: id, type: 'c2c', participants }, self)).toBe(false);
    expect(isValidMirrorConversation({ conversation_id: id, type: 'ai_c2c', participants }, self)).toBe(false);
  });

  it('没有实际登录账号时不转换镜像单聊', () => {
    expect(isValidMirrorConversation({ conversation_id: mirrorID, type: 'c2c', participants: [self, peer] }, '')).toBe(false);
  });
});
