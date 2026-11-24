import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import type { OrgUserItem } from '../../../services/aiOrgMembers';
import { getChatInstance } from '../hooks/useIMLogin';
import type { MergedConversation } from '../hooks/useConversationList';
import { resolveImScopedUserId } from '../utils/imScopedUserId';
import ContactPickerSheet from './ContactPickerSheet';

interface SingleChatCreateSheetProps {
  visible: boolean;
  onClose: () => void;
  onConversationCreated?: (conversation: MergedConversation) => void;
}

function buildSingleConversation(user: OrgUserItem, imUserID: string): MergedConversation {
  return {
    conversation_id: `C2C${imUserID}`,
    type: 'c2c',
    title: user.realname,
    avatar: user.avatar || null,
    last_msg_preview: '',
    last_msg_time: null,
    last_msg_from: null,
    pinned: false,
    muted: false,
    order_seq: Date.now(),
    unread_count: 0,
    last_read_msg_time: null,
  };
}

const SingleChatCreateSheet: React.FC<SingleChatCreateSheetProps> = ({
  visible,
  onClose,
  onConversationCreated,
}) => {
  const { userInfo } = useAuth();
  const [selectedUsers, setSelectedUsers] = useState<OrgUserItem[]>([]);

  useEffect(() => {
    if (!visible) {
      setSelectedUsers([]);
    }
  }, [visible]);

  const handleConfirm = async (users: OrgUserItem[]) => {
    const targetUser = users[0];
    if (!targetUser) return;

    try {
      const chat = getChatInstance();
      if (!chat) {
        throw new Error('IM 未连接');
      }

      // 通讯录给的是业务用户编号，发起单聊要用参考端的带租户账号。
      const tenantId = String(userInfo?.loginTenantId ?? '').trim();
      const imUserID = resolveImScopedUserId(targetUser.id, tenantId);
      if (!/^\d+$/.test(tenantId) || !imUserID) {
        throw new Error('缺少有效的即时聊天租户或用户标识，请重新登录');
      }
      const nextConversation = buildSingleConversation(targetUser, imUserID);
      // 对齐 PC：发起单聊失败时在组件内收口异常，保留弹窗方便用户重试。
      await chat.getConversationProfile(nextConversation.conversation_id);
      onConversationCreated?.(nextConversation);
      onClose();
    } catch (error) {
      console.error('[IM][SingleChatCreate] start chat failed', {
        targetUserID: targetUser.id,
        error,
      });
    }
  };

  return (
    <ContactPickerSheet
      visible={visible}
      title="新建单聊"
      selectedUsers={selectedUsers}
      multiple={false}
      confirmText="开始聊天"
      onClose={onClose}
      onSelectedUsersChange={setSelectedUsers}
      onConfirm={handleConfirm}
    />
  );
};

export default SingleChatCreateSheet;
