import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../ConfirmModal'
import type { TournamentMember } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament tables pending THEA-417
const db = supabase as unknown as any

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

interface Props {
  leagueId: string
  inviteUrl: string
  isCommissioner: boolean
}

export default function LeagueMembersTab({ leagueId, inviteUrl, isCommissioner }: Props) {
  const [members, setMembers] = useState<TournamentMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<TournamentMember | null>(null)
  const [removing, setRemoving] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await db
        .from('tournament_members')
        .select('*, profiles(display_name)')
        .eq('tournament_id', leagueId)
        .order('joined_at', { ascending: true })

      if (err) throw err
      const rows: TournamentMember[] = (data ?? []).map((r: Record<string, unknown>) => ({
        ...(r as Omit<TournamentMember, 'display_name'>),
        display_name:
          (r.guest_name as string | null) ??
          (r.profiles as { display_name?: string } | null)?.display_name ??
          'Unknown',
      }))
      setMembers(rows)
    } catch {
      setError('Could not load members.')
    } finally {
      setLoading(false)
    }
  }, [leagueId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleRemove = useCallback(async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await db
        .from('tournament_members')
        .delete()
        .eq('id', removeTarget.id)
      setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id))
    } catch {
      fetchMembers()
    } finally {
      setRemoving(false)
      setRemoveTarget(null)
    }
  }, [removeTarget, fetchMembers])

  const handleShare = useCallback(async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Join the league', url: inviteUrl })
        return
      } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [inviteUrl])

  const memberCount = members.filter((m) => m.role === 'member' || m.role === 'player').length

  if (loading) {
    return (
      <div className="px-4 py-4 flex flex-col gap-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-[#e5e1d8] rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <p className="text-warm-gray">{error}</p>
        <button onClick={fetchMembers} className="text-sm text-[#2d5a27] underline mt-2">Retry</button>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      {/* Header: count + invite */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-warm-gray font-medium">
          {memberCount} member{memberCount !== 1 ? 's' : ''}
        </p>
        {isCommissioner && (
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#2d5a27] border border-[#2d5a27] rounded-xl px-3 py-1.5 active:scale-95 transition-transform min-h-[36px]"
          >
            {copied ? '✓ Copied' : 'Share Invite'}
          </button>
        )}
      </div>

      {members.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-warm-gray text-sm">No members yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-[#e5e1d8] px-4 py-3 flex items-center justify-between shadow-sm">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{m.display_name}</span>
                  {(m.role === 'commissioner') && (
                    <span className="text-xs bg-[#eaf4e8] text-[#2d5a27] font-semibold px-2 py-0.5 rounded-full">
                      Commissioner
                    </span>
                  )}
                </div>
                <span className="text-xs text-warm-gray">Joined {formatDate(m.joined_at)}</span>
              </div>
              {isCommissioner && m.role !== 'commissioner' && (
                <button
                  onClick={() => setRemoveTarget(m)}
                  className="text-sm text-red-500 font-medium px-2 min-h-[36px]"
                  aria-label={`Remove ${m.display_name}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {removeTarget && (
        <ConfirmModal
          title="Remove Member"
          message={`Remove ${removeTarget.display_name} from the league? Their historical scores will be preserved.`}
          confirmLabel={removing ? 'Removing…' : 'Remove'}
          destructive
          onConfirm={handleRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}
