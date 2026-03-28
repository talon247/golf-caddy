// THEA-136: Offline sync queue — localStorage-backed, online-event-driven
import type { SyncQueueItem } from '../types'
import { syncRoundToSupabase } from './sync'
import { useAppStore } from '../store'

const STORAGE_KEY = 'golf_caddy_sync_queue'
const MAX_RETRIES = 3

// Concurrency lock
let isProcessing = false

// ── Queue persistence helpers ─────────────────────────────────────────────

export function getQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SyncQueueItem[]
  } catch {
    return []
  }
}

function saveQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Silently ignore localStorage errors (private browsing, quota, etc.)
  }
}

export function addToQueue(roundId: string): void {
  const queue = getQueue()
  const existing = queue.find(i => i.roundId === roundId)
  if (existing) return // already queued

  const item: SyncQueueItem = {
    roundId,
    queuedAt: Date.now(),
    retries: 0,
  }
  saveQueue([...queue, item])
}

export function removeFromQueue(roundId: string): void {
  const queue = getQueue().filter(i => i.roundId !== roundId)
  saveQueue(queue)
}

// ── Processing ────────────────────────────────────────────────────────────

export async function processSyncQueue(userId: string): Promise<void> {
  if (isProcessing) return
  if (!navigator.onLine) return

  isProcessing = true

  try {
    const queue = getQueue()
    if (queue.length === 0) return

    const store = useAppStore.getState()

    for (const item of queue) {
      const round = store.rounds.find(r => r.id === item.roundId)
      if (!round) {
        // Round no longer exists — remove from queue
        removeFromQueue(item.roundId)
        continue
      }

      const result = await syncRoundToSupabase(round, userId)

      if (result.success) {
        removeFromQueue(item.roundId)
        store.markRoundSynced(item.roundId)
      } else {
        // Increment retries
        const newRetries = item.retries + 1
        if (newRetries >= MAX_RETRIES) {
          // Give up — mark as error and remove from queue
          removeFromQueue(item.roundId)
          store.markRoundError(item.roundId)
        } else {
          // Update retry count in queue
          const queue = getQueue()
          const updated = queue.map(i =>
            i.roundId === item.roundId ? { ...i, retries: newRetries } : i,
          )
          saveQueue(updated)
        }
      }
    }
  } finally {
    isProcessing = false
  }
}

// ── Listeners ─────────────────────────────────────────────────────────────

export function initSyncQueueListeners(userId: string): () => void {
  const handleOnline = () => {
    void processSyncQueue(userId)
  }

  // Process on mount (in case we came back online mid-session)
  void processSyncQueue(userId)

  window.addEventListener('online', handleOnline)

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline)
  }
}
