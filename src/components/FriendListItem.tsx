import type { Friend } from '../types'

interface Props {
  friend: Friend
  onRemove: (friendshipId: string) => void
}

/** Presence dot: green = online, blue = in-round. For now all friends show grey (offline) until presence store is wired in Phase 3. */
function PresenceDot({ status }: { status?: 'online' | 'in_round' | 'offline' }) {
  if (status === 'online') {
    return <span className="w-2.5 h-2.5 rounded-full bg-[#2d5a27] flex-shrink-0" aria-label="Online" />
  }
  if (status === 'in_round') {
    return <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" aria-label="In round" />
  }
  return <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" aria-label="Offline" />
}

export function FriendListItem({ friend, onRemove }: Props) {
  const initials = friend.displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-[#e5e1d8]">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-[#2d5a27] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
        {initials}
      </div>

      {/* Name + username */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1a1a1a] truncate">{friend.displayName}</p>
        <p className="text-xs text-[#6b6b6b] truncate">@{friend.username}</p>
      </div>

      {/* Presence dot */}
      <PresenceDot />

      {/* Remove button */}
      <button
        onClick={() => onRemove(friend.friendshipId)}
        className="text-xs text-[#6b6b6b] border border-[#e5e1d8] rounded-lg px-2 py-1 active:scale-95 transition-transform"
        aria-label={`Remove ${friend.displayName}`}
      >
        Remove
      </button>
    </div>
  )
}
