import { useParams, Link } from 'react-router-dom'
import { useRivalryLeaderboard } from '../hooks/useRivalryLeaderboard'
import { RivalryLeaderboard } from '../components/RivalryLeaderboard'
import { useAppStore } from '../store'

function LoadingState() {
  return (
    <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4">
      <div className="text-4xl animate-pulse">⛳</div>
      <p className="text-gray-500 text-lg font-medium">Loading rivalry…</p>
    </main>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <main className="flex flex-col flex-1 items-center justify-center p-6 pb-20 gap-4 text-center">
      <div className="text-4xl">⚠️</div>
      <p className="text-gray-700 font-medium">{message}</p>
      <Link to="/friends" className="text-[#2d5a27] font-semibold underline">
        Back to Friends
      </Link>
    </main>
  )
}

export default function RemoteRivalry() {
  const { id } = useParams<{ id: string }>()
  const currentUserId = useAppStore((s) => s.userId)
  const { rivalry, isLoading, error } = useRivalryLeaderboard(id ?? '')

  if (!id) {
    return <ErrorState message="Invalid rivalry link." />
  }

  if (isLoading) {
    return <LoadingState />
  }

  if (error === 'not_found') {
    return <ErrorState message="Rivalry not found. It may have expired or been deleted." />
  }

  if (error === 'not_participant') {
    return <ErrorState message="You are not a participant in this rivalry." />
  }

  if (error === 'network') {
    return <ErrorState message="Network error. Please check your connection and try again." />
  }

  if (!rivalry) {
    return <ErrorState message="Could not load rivalry." />
  }

  return (
    <main className="flex flex-col flex-1 p-4 pb-24 gap-4 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1a1a1a]">Remote Rivalry</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {rivalry.holeCount}-hole head-to-head · different courses
          </p>
        </div>
        <Link
          to="/friends"
          className="text-sm text-[#2d5a27] font-semibold underline"
        >
          ← Back
        </Link>
      </div>

      <RivalryLeaderboard rivalry={rivalry} currentUserId={currentUserId ?? null} />

      <p className="text-[11px] text-gray-400 text-center mt-2">
        Scores normalize by course rating &amp; slope (WHS differential formula).
        Live updates via Supabase Realtime.
      </p>
    </main>
  )
}
