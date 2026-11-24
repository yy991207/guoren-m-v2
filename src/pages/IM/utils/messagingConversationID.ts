import type { ConversationItem } from '../api/messagingApi';

const SDK_PREFIX_GROUP = 'GROUP';
const SDK_PREFIX_C2C = 'C2C';

/** 把参考项目的镜像会话 ID 转为聊天 SDK 使用的 ID。 */
export function toSdkConversationID(
  apiConversationID: string,
  type: ConversationItem['type'],
  selfUserID?: string,
): string {
  if (!apiConversationID) return apiConversationID;

  if (type === 'group' || type === 'community') {
    return apiConversationID.startsWith(SDK_PREFIX_GROUP)
      ? apiConversationID
      : `${SDK_PREFIX_GROUP}${apiConversationID}`;
  }

  if (type === 'c2c' || type === 'ai_c2c') {
    if (apiConversationID.startsWith(SDK_PREFIX_C2C)) return apiConversationID;

    // 从镜像的双账号 ID 中去掉自己，不根据 participants 猜测对端账号。
    if (selfUserID && apiConversationID.includes(':')) {
      const peer = apiConversationID.split(':').filter((id) => id && id !== selfUserID).join(':');
      if (peer) return `${SDK_PREFIX_C2C}${peer}`;
    }

    return `${SDK_PREFIX_C2C}${apiConversationID}`;
  }

  return apiConversationID;
}

/** 过滤镜像来源的无效单聊，不处理 SDK 自己返回的会话。 */
export function isValidMirrorConversation(
  { conversation_id: id, type, participants }: Pick<ConversationItem, 'conversation_id' | 'type' | 'participants'>,
  selfUserID?: string,
): boolean {
  if (type !== 'c2c' && type !== 'ai_c2c') return true;
  if (!selfUserID || !id) return false;
  if (participants?.length && !participants.some((member) => member && member !== selfUserID)) {
    return false;
  }

  if (id.includes(':')) {
    // 双账号 ID 不能带 SDK 前缀，且必须恰好包含当前登录账号和一个非空对端。
    if (id.startsWith(SDK_PREFIX_C2C)) return false;
    const parts = id.split(':');
    return parts.length === 2
      && parts.includes(selfUserID)
      && parts.some((part) => part && part !== selfUserID);
  }

  // 和参考项目一致，保留已有的 SDK 格式及裸对端 ID，但不能指向自己。
  const peer = id.startsWith(SDK_PREFIX_C2C) ? id.slice(SDK_PREFIX_C2C.length) : id;
  return Boolean(peer && peer !== selfUserID);
}

/**
 * 把 SDK 会话 ID 转成镜像接口需要的 conversation_id。
 * 群聊去掉 GROUP 前缀，单聊把 peer 和 self 排序后拼成 min:max。
 */
export function toMirrorConversationID(
  sdkConversationID: string,
  selfUserID?: string,
): string {
  if (!sdkConversationID) return sdkConversationID;

  if (sdkConversationID.startsWith(SDK_PREFIX_GROUP)) {
    return sdkConversationID.slice(SDK_PREFIX_GROUP.length);
  }

  if (sdkConversationID.startsWith(SDK_PREFIX_C2C)) {
    const peerID = sdkConversationID.slice(SDK_PREFIX_C2C.length);
    if (!selfUserID) return peerID;
    const ids = [selfUserID, peerID].sort();
    return `${ids[0]}:${ids[1]}`;
  }

  return sdkConversationID;
}
