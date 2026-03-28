import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { supabase } from '../lib/supabase'
import { useGroupRoundStore } from '../store/groupRoundStore'
import type { GroupRoundPlayer } from '../types'

// Generate a random 4-digit room code (zero-padded)
function generateRoomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

function buildJoinUrl(roomCode: string): string {
  return `${window.location.origin}?join=${roomCode}`
}

async function createGroupRoundInDb(
  roomCode: string,
  hostName: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('group_rounds')
    .insert({ room_code: roomCode, host_name: hostName })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function RoomCodeDisplay({ code }: { code: string }) {
  return (
    <div className="flex gap-2 justify-center">
      {code.split('').map((digit, i) => (
        <div
          key={i}
          className="w-16 h-20 flex items-center justify-center bg-white border-2 border-forest rounded-xl text-4xl font-black text-forest shadow-sm"
          aria-label={`Digit ${i + 1}: ${digit}`}
        >
          {digit}
        </div>
      ))}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="flex-1 py-3 rounded-xl border-2 border-forest text-forest font-semibold touch-target"
    >
      Copy Code
    </button>
  )
}

function ShareButton({ title, text, url }: { title: string; text: string; url: string }) {
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  const handleShare = useCallback(async () => {
    try {
      await navigator.share({ title, text, url })
    } catch {
      // User cancelled or share unavailable — silently ignore
    }
  }, [title, text, url])

  if (!canShare) return null

  return (
    <button
      onClick={handleShare}
      className="flex-1 py-3 rounded-xl border-2 border-forest text-forest font-semibold touch-target"
    >
      Share Invite
    </button>
  )
}

function PlayerRow({ player, isHost }: { player: GroupRoundPlayer; isHost?: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-cream-dark rounded-xl px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-forest text-cream flex items-center justify-center text-sm font-bold shrink-0">
        {(player.playerName ?? '').charAt(0).toUpperCase()}
      </div>
      <span className="font-medium text-gray-900">{player.playerName}</span>
      {isHost && (
        <span className="ml-auto text-xs text-warm-gray font-medium">Host</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function GroupRoundHost() {
  const navigate = useNavigate()
  const { groupRound, status, error, setGroupRound, setStatus, setError, setPlayers } =
    useGroupRoundStore()

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const hostName = 'Host' // Placeholder until auth is implemented

  // ── Create the group round ──────────────────────────────────────────────
  useEffect(() => {
    if (groupRound) return // Already created in this session

    let cancelled = false
    setStatus('creating')

    async function create() {
      const roomCode = generateRoomCode()
      try {
        const id = await createGroupRoundInDb(roomCode, hostName)
        if (cancelled) return
        setGroupRound({
          id,
          roomCode,
          hostName,
          players: [],
          status: 'waiting',
          createdAt: Date.now(),
        })
      } catch {
        if (cancelled) return
        // Fall back to local-only mode if Supabase is unavailable
        setGroupRound({
          id: crypto.randomUUID(),
          roomCode,
          hostName,
          players: [],
          status: 'waiting',
          createdAt: Date.now(),
        })
      }
    }

    create()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Subscribe to Realtime presence ─────────────────────────────────────
  useEffect(() => {
    if (!groupRound) return

    const channelName = `group-round-${groupRound.roomCode}`
    const channel = supabase.channel(channelName, {
      config: { presence: { key: 'host' } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string; key: string }>()
        const players: GroupRoundPlayer[] = Object.entries(state).flatMap(
          ([presenceKey, presences]) =>
            presences.map((p) => ({
              id: presenceKey,
              playerName: p.name,
              presenceKey,
              joinedAt: Date.now(),
            })),
        )
        // Exclude the host's own presence entry
        setPlayers(players.filter((p) => p.presenceKey !== 'host'))
      })
      .subscribe(async (subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          await channel.track({ name: hostName, key: 'host' })
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [groupRound, hostName, setPlayers])

  // ── Start the round ─────────────────────────────────────────────────────
  async function handleStartRound() {
    if (!groupRound) return
    setStatus('starting')

    // Signal all players in the channel to start
    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'start',
        payload: { roomCode: groupRound.roomCode },
      })
    }

    // Update DB status if Supabase is available
    try {
      await supabase
        .from('group_rounds')
        .update({ status: 'active' })
        .eq('id', groupRound.id)
    } catch {
      // Non-fatal — continue
    }

    // Group round play screen coming soon (THEA-81)
    // For now show a waiting state - the full play screen is being built
    setStatus('active')
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (status === 'creating') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 gap-4">
        <div className="text-4xl animate-pulse">⛳</div>
        <p className="text-warm-gray text-lg font-medium">Creating room…</p>
      </main>
    )
  }

  if (status === 'active') {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 gap-4">
        <div className="text-5xl">🏌️</div>
        <h2 className="text-2xl font-black text-forest">Round Started!</h2>
        <p className="text-warm-gray text-center">Group round scoring is coming soon. For now, each player can log their score independently using the solo round mode.</p>
        <button
          onClick={() => navigate('/')}
          className="py-3 px-6 bg-forest text-cream rounded-xl font-semibold touch-target"
        >
          Go to Home
        </button>
      </main>
    )
  }

  if (status === 'error' || !groupRound) {
    return (
      <main className="flex flex-col flex-1 items-center justify-center p-6 gap-4">
        <p className="text-red-700 font-semibold text-center">
          {error ?? 'Something went wrong. Please try again.'}
        </p>
        <button
          onClick={() => {
            setError(null)
            navigate('/')
          }}
          className="py-3 px-6 bg-forest text-cream rounded-xl font-semibold touch-target"
        >
          Back to Home
        </button>
      </main>
    )
  }

  const joinUrl = buildJoinUrl(groupRound.roomCode)
  const players = groupRound.players ?? []
  const canStart = players.length >= 1

  return (
    <main className="flex flex-col flex-1 p-6 gap-6 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="text-center pt-2">
        <h1 className="text-2xl font-black text-forest">Group Round</h1>
        <p className="text-warm-gray text-sm mt-0.5">Share this code with your playing partners</p>
      </div>

      {/* Room code */}
      <section className="bg-cream-dark rounded-2xl p-5 flex flex-col gap-4">
        <RoomCodeDisplay code={groupRound.roomCode} />

        {/* Action buttons */}
        <div className="flex gap-3">
          <CopyButton text={groupRound.roomCode} />
          <ShareButton
            title="Join my Golf Caddy round"
            text={`Join my group round! Code: ${groupRound.roomCode}`}
            url={joinUrl}
          />
        </div>

        {/* QR code */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="bg-white p-3 rounded-xl shadow-sm" aria-label="QR code to join this round">
            <QRCode value={joinUrl} size={160} level="M" />
          </div>
          <p className="text-xs text-warm-gray">Scan to join on another device</p>
        </div>
      </section>

      {/* Lobby */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-warm-gray uppercase tracking-wide">
            Players in lobby
          </h2>
          <span className="text-sm text-warm-gray">{players.length + 1} joined</span>
        </div>

        {/* Host row (always shown) */}
        <PlayerRow
          player={{ id: 'host', playerName: hostName, presenceKey: 'host', joinedAt: groupRound.createdAt }}
          isHost
        />

        {/* Guest players */}
        {players.length === 0 ? (
          <div className="text-center py-6 text-warm-gray text-sm">
            Waiting for players to join…
          </div>
        ) : (
          players.map((player) => (
            <PlayerRow key={player.presenceKey} player={player} />
          ))
        )}
      </section>

      {/* Start button */}
      <div className="mt-auto">
        {!canStart && (
          <p className="text-center text-warm-gray text-sm mb-3">
            At least 1 other player must join to start
          </p>
        )}
        <button
          onClick={handleStartRound}
          disabled={!canStart || status === 'starting'}
          className={`w-full py-4 rounded-2xl text-xl font-bold shadow-md touch-target transition-opacity ${
            canStart && status !== 'starting'
              ? 'bg-gold text-white opacity-100'
              : 'bg-gold text-white opacity-40 cursor-not-allowed'
          }`}
        >
          {status === 'starting' ? 'Starting…' : 'Start Round'}
        </button>
      </div>
    </main>
  )
}

