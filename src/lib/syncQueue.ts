// THEA-136: Offline sync queue — localStorage-backed, online-event-driven
// THEA-160: Exponential backoff + jitter for retry logic
// THEA-159: QuotaExceededError handling + cleanup of old synced rounds
import type { SyncQueueItem } from '../types'
import { syncRoundToSupabase } from './sync'
import { useAppStore } from '../store'

const STORAGE_KEY = 'golf_caddy_sync_queue'
const MAX_RETRIES = 3

// Backoff delays in ms for retry attempts 1, 2, 3 (index = retries after failure)
const BACKOFF_DELAYS = [2_000, 10_000, 60_000]

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
      // Skip items that are still in their backoff window
      if (item.nextRetryAt !== undefined && item.nextRetryAt > Date.now()) {
        continue
      }

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
        const newRetries = item.retries + 1
        if (newRetries >= MAX_RETRIES) {
          // Give up — mark as error and remove from queue
          removeFromQueue(item.roundId)
          store.markRoundError(item.roundId)
        } else {
          // Exponential backoff with up to 1s of random jitter
          const baseDelay = BACKOFF_DELAYS[newRetries - 1] ?? BACKOFF_DELAYS[BACKOFF_DELAYS.length - 1]
          const jitter = Math.random() * 1_000
          const nextRetryAt = Date.now() + baseDelay + jitter

          const current = getQueue()
          const updated = current.map(i =>
            i.roundId === item.roundId
              ? { ...i, retries: newRetries, nextRetryAt }
              : i,
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
