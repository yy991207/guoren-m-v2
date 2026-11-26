import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchUserBasicInfo, type UserBasicInfo } from '../../IM/api/userBasicInfo'
import type { OrgUserItem } from '../../../services/aiOrgMembers'

const MEMBER_PROFILE_BATCH_SIZE = 6

export function needsOrgMemberProfile(user: OrgUserItem): boolean {
  const name = user.realname.trim()
  return Boolean(user.id) && (!name || name === user.id)
}

export function useSelectedOrgMemberProfiles(users: OrgUserItem[]) {
  const [profiles, setProfiles] = useState(() => new Map<string, UserBasicInfo>())
  const requests = useRef(new Map<string, Promise<UserBasicInfo | null>>())
  const missingIds = useMemo(() => [...new Set(users.filter(needsOrgMemberProfile).map(user => user.id))], [users])

  useEffect(() => {
    let cancelled = false
    const getProfile = (id: string) => {
      const existing = requests.current.get(id)
      if (existing) return existing
      const profile = fetchUserBasicInfo(id).catch(() => null)
      requests.current.set(id, profile)
      return profile
    }

    async function loadProfiles() {
      for (let i = 0; i < missingIds.length && !cancelled; i += MEMBER_PROFILE_BATCH_SIZE) {
        const ids = missingIds.slice(i, i + MEMBER_PROFILE_BATCH_SIZE)
        await Promise.all(ids.map(async id => {
          const profile = await getProfile(id)
          if (cancelled || !profile) return
          // 资料只用于显示，不会写回成员草稿；已返回的姓名不必等其他查询。
          setProfiles(current => current.get(id) === profile ? current : new Map(current).set(id, profile))
        }))
      }
    }

    void loadProfiles()
    return () => { cancelled = true }
  }, [missingIds])

  return profiles
}
