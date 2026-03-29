import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../ConfirmModal'
import type { TournamentMember } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament tables pending THEA-417
const db = supabase as unknown as any

interface Props {
  tournamentId: string
  fieldSize: number | null
  inviteUrl: string
}

export default function EventField({ tournamentId, fieldSize, inviteUrl }: Props) {
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
        .eq('tournament_id', tournamentId)
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
      setError('Could not load field.')
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

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
      // non-fatal — reload to sync
      fetchMembers()
    } finally {
      setRemoving(false)
      setRemoveTarget(null)
    }
  }, [removeTarget, fetchMembers])

  const handleShare = useCallback(async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Join the tournament', url: inviteUrl })
        return
      } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [inviteUrl])

  const playerCount = members.filter((m) => m.role === 'player' || m.role === 'member').length

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
      </div>
    )
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      {/* Player count + share invite */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-warm-gray font-medium">
          {playerCount}{fieldSize ? ` / ${fieldSize}` : ''} players
        </p>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#2d5a27] border border-[#2d5a27] rounded-xl px-3 py-1.5 active:scale-95 transition-transform min-h-[36px]"
        >
          {copied ? '✓ Copied' : 'Share Invite'}
        </button>
      </div>

      {members.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-warm-gray text-sm">No players have joined yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-[#e5e1d8] px-4 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">{m.display_name}</span>
                {m.guest_name && (
                  <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Guest</span>
                )}
                {(m.role === 'host' || m.role === 'commissioner') && (
                  <span className="text-xs bg-[#eaf4e8] text-[#2d5a27] font-semibold px-2 py-0.5 rounded-full capitalize">{m.role}</span>
                )}
              </div>
              {m.role !== 'host' && m.role !== 'commissioner' && (
                <button
                  onClick={() => setRemoveTarget(m)}
                  className="text-sm text-red-500 font-medium touch-target px-2"
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
          title="Remove Player"
          message={`Remove ${removeTarget.display_name} from the event? They will lose access to the leaderboard.`}
          confirmLabel={removing ? 'Removing…' : 'Remove'}
          destructive
          onConfirm={handleRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}
