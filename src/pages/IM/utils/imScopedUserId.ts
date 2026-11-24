/** 去掉业务用户 ID 上已有的数字租户前缀；腾讯云机器人账号保持原样。 */
export function stripImTenantPrefix(userId: string): string {
  const normalizedUserId = String(userId ?? '').trim();
  if (normalizedUserId.startsWith('@RBT#')) return normalizedUserId;
  return normalizedUserId.replace(/^(?:\d+_)+/, '');
}

/** 与参考端一致：移除旧前缀后，只拼当前租户。 */
export function resolveImScopedUserId(userId: string, tenantId: string): string {
  const bareUserId = stripImTenantPrefix(userId);
  const normalizedTenantId = tenantId.trim();
  if (!bareUserId || !normalizedTenantId || bareUserId.startsWith('@RBT#')) return bareUserId;
  return `${normalizedTenantId}_${bareUserId}`;
}
