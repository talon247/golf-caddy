import { useState } from 'react'
import { usePresenceStore } from '../store/presenceStore'
import { useGroupRoundStore } from '../store/groupRoundStore'
import type { FriendRoundInfo } from '../types'
import QuickJoinModal from './QuickJoinModal'

export default function FriendsPlayingCard() {
  const onlineFriends = usePresenceStore(s => s.onlineFriends)
  const myGroupRoundId = useGroupRoundStore(s => s.groupRound?.id ?? null)
  const [selectedFriend, setSelectedFriend] = useState<FriendRoundInfo | null>(null)

  // Collect all friends in active rounds (joinable or full), excluding the user's own round
  const friendsInRounds: Array<{ info: FriendRoundInfo; joinable: boolean }> = []
  for (const [userId, presence] of onlineFriends.entries()) {
    if (presence.status !== 'in_round' || !presence.groupRoundId || !presence.roomCode) continue
    if (presence.groupRoundId === myGroupRoundId) continue

    friendsInRounds.push({
      info: {
        userId,
        displayName: presence.displayName,
        groupRoundId: presence.groupRoundId,
        roomCode: presence.roomCode,
        courseName: presence.courseName,
        currentHole: presence.currentHole,
        playerCount: presence.playerCount ?? 1,
        maxPlayers: presence.maxPlayers,
      },
      joinable: presence.joinable,
    })
  }

  if (friendsInRounds.length === 0) return null

  return (
    <>
      <div className="bg-white border border-cream-dark rounded-2xl p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-widest text-warm-gray mb-3">
          Friends Playing
        </div>
        <div className="flex flex-col gap-3">
          {friendsInRounds.map(({ info, joinable }) => (
            <div key={info.userId} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900 truncate">{info.displayName}</div>
                <div className="text-warm-gray text-xs mt-0.5">
                  {info.courseName ?? 'Active round'}
                  {info.currentHole != null ? ` · Hole ${info.currentHole}` : ''}
                  {' · '}
                  {info.playerCount}/{info.maxPlayers}
                </div>
              </div>
              {joinable ? (
                <button
                  onClick={() => setSelectedFriend(info)}
                  className="flex-shrink-0 bg-forest text-cream text-sm font-bold px-4 py-2 rounded-xl touch-target active:scale-95 transition-transform"
                >
                  Join
                </button>
              ) : (
                <span className="flex-shrink-0 text-warm-gray text-sm font-semibold bg-cream px-4 py-2 rounded-xl">
                  Full
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedFriend && (
        <QuickJoinModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
        />
      )}
    </>
  )
}
