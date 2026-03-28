// THEA-146: Supabase Realtime Presence channel — setup, track, teardown
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { PresenceState } from '../types'

const CHANNEL_NAME = 'presence:global'

let _channel: RealtimeChannel | null = null

type PresenceSyncCallback = (state: Map<string, PresenceState>) => void

/**
 * Subscribe to the global presence channel. Calls `onSync` whenever the
 * presence state changes. Returns the channel (kept as a module-level singleton).
 */
export function setupPresenceChannel(
  userId: string,
  initialPayload: Omit<PresenceState, 'userId' | 'updatedAt'>,
  onSync: PresenceSyncCallback,
): RealtimeChannel {
  if (_channel) {
    teardownPresenceChannel()
  }

  _channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: userId } },
  })

  const syncFromChannel = () => {
    if (!_channel) return
    const raw = _channel.presenceState<PresenceState>()
    const result = new Map<string, PresenceState>()
    for (const [key, entries] of Object.entries(raw)) {
      if (entries[0]) {
        result.set(key, entries[0])
      }
    }
    onSync(result)
  }

  _channel
    .on('presence', { event: 'sync' }, syncFromChannel)
    .on('presence', { event: 'join' }, syncFromChannel)
    .on('presence', { event: 'leave' }, syncFromChannel)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && _channel) {
        await _channel.track({
          ...initialPayload,
          userId,
          updatedAt: new Date().toISOString(),
        })
      }
    })

  return _channel
}

/**
 * Update the current user's tracked presence state.
 */
export async function trackPresence(patch: Partial<PresenceState>): Promise<void> {
  if (!_channel) return
  await _channel.track({ ...patch, updatedAt: new Date().toISOString() })
}

/**
 * Unsubscribe from the presence channel and clean up.
 */
export function teardownPresenceChannel(): void {
  if (_channel) {
    void supabase.removeChannel(_channel)
    _channel = null
  }
}
