import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { useFriendsStore } from '../store/friendsStore'
import { FriendListItem } from '../components/FriendListItem'
import { UsernameSetup } from '../components/UsernameSetup'
import { AuthModal } from '../components/AuthModal'
import { fetchProfile } from '../lib/sync'
import type { FriendSearchResult } from '../types'

type Tab = 'friends' | 'requests' | 'search'

export default function Friends() {
  const navigate = useNavigate()
  const isAuthenticated = useAppStore(s => s.isAuthenticated)
  const userId = useAppStore(s => s.userId)
  const profile = useAppStore(s => s.profile)
  const setProfile = useAppStore(s => s.setProfile)

  const {
    friends,
    pendingRequests,
    loading,
    error,
    loadFriends,
    loadPendingRequests,
    sendRequest,
    respondRequest,
    removeFriend,
    searchUsers,
    clearError,
  } = useFriendsStore()

  const [activeTab, setActiveTab] = useState<Tab>('friends')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showUsernameSetup, setShowUsernameSetup] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Request feedback state
  const [respondingTo, setRespondingTo] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    loadFriends()
    loadPendingRequests()
  }, [isAuthenticated, loadFriends, loadPendingRequests])

  // Fetch profile from Supabase on mount to get the latest username.
  // Intentionally omits profile?.username from deps: AuthProvider periodically
  // overwrites the store profile (without username) on auth events, which would
  // re-trigger this effect and falsely re-show the setup modal.
  // We derive showUsernameSetup from the fetch result directly, not from store state.
  useEffect(() => {
    if (!isAuthenticated || !userId) return
    // Fast path: username already in store (e.g. navigating back to this page)
    if (profile?.username) return
    let cancelled = false
    fetchProfile(userId).then(fetched => {
      if (cancelled) return
      if (fetched) setProfile(fetched)
      // Only show setup when we confirmed username is absent; don't show on fetch failure
      if (fetched !== null) setShowUsernameSetup(!fetched.username)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userId])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(searchQuery.trim())
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, searchUsers])

  function handleUsernameSet(username: string) {
    if (profile) setProfile({ ...profile, username })
    setShowUsernameSetup(false)
  }

  async function handleSendRequest(username: string, userId: string) {
    setSendingTo(userId)
    try {
      await sendRequest(username)
      setSentTo(prev => new Set(prev).add(userId))
    } catch {
      // error shown via store
    } finally {
      setSendingTo(null)
    }
  }

  async function handleRespond(friendshipId: string, action: 'accepted' | 'declined') {
    setRespondingTo(friendshipId)
    try {
      await respondRequest(friendshipId, action)
      if (action === 'accepted') await loadFriends()
      await loadPendingRequests()
    } catch {
      // error shown via store
    } finally {
      setRespondingTo(null)
    }
  }

  async function handleRemove(friendshipId: string) {
    await removeFriend(friendshipId)
  }

  // ── Not authenticated ────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 text-center">
        <p className="text-[#1a1a1a] font-semibold text-lg mb-2">Sign in to use Friends</p>
        <p className="text-[#6b6b6b] text-sm mb-6">Find and connect with your golf buddies.</p>
        <button
          onClick={() => setShowAuthModal(true)}
          className="w-full max-w-xs bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform"
        >
          Sign in
        </button>
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            defaultTab="signin"
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </main>
    )
  }

  const tabClass = (tab: Tab) =>
    `flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-[#2d5a27] text-[#2d5a27]'
        : 'border-transparent text-[#6b6b6b]'
    }`

  return (
    <main className="flex-1 flex flex-col pb-24">
      {/* Username setup modal */}
      {showUsernameSetup && userId && (
        <UsernameSetup
          userId={userId}
          onComplete={handleUsernameSet}
          onDismiss={() => setShowUsernameSetup(false)}
        />
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-[#1a1a1a]">Friends</h1>
        {profile?.username && (
          <p className="text-xs text-[#6b6b6b] mt-0.5">Your username: @{profile.username}</p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="ml-2 text-red-500 font-bold">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#e5e1d8] mx-4" role="tablist">
        <button className={tabClass('friends')} onClick={() => setActiveTab('friends')} role="tab" aria-selected={activeTab === 'friends'}>
          Friends {friends.length > 0 && `(${friends.length})`}
        </button>
        <button className={tabClass('requests')} onClick={() => setActiveTab('requests')} role="tab" aria-selected={activeTab === 'requests'}>
          Requests {pendingRequests.length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button className={tabClass('search')} onClick={() => setActiveTab('search')} role="tab" aria-selected={activeTab === 'search'}>
          Search
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 px-4 pt-4 space-y-2 overflow-y-auto">

        {/* ── Friends list ─────────────────────────────────── */}
        {activeTab === 'friends' && (
          <>
            {loading && (
              <div className="flex items-center justify-center py-12 text-[#6b6b6b] text-sm">
                Loading friends…
              </div>
            )}
            {!loading && friends.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-[#1a1a1a] font-semibold">No friends yet</p>
                <p className="text-[#6b6b6b] text-sm mt-1">Search by username to add your golf buddies.</p>
                <button
                  onClick={() => setActiveTab('search')}
                  className="mt-4 bg-[#2d5a27] text-white rounded-xl px-6 py-3 font-semibold text-sm active:scale-95 transition-transform"
                >
                  Find friends
                </button>
              </div>
            )}
            {friends.map(friend => (
              <div key={friend.friendshipId} className="flex flex-col gap-1">
                <FriendListItem
                  friend={friend}
                  onRemove={handleRemove}
                />
                <button
                  type="button"
                  onClick={() => navigate(`/settlement-history?friend=${friend.friendUserId}`)}
                  className="text-xs text-[#2d5a27] font-semibold text-right px-2 py-1 active:opacity-70 transition-opacity"
                >
                  View rivalry →
                </button>
              </div>
            ))}
          </>
        )}

        {/* ── Pending requests ─────────────────────────────── */}
        {activeTab === 'requests' && (
          <>
            {pendingRequests.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-[#1a1a1a] font-semibold">No pending requests</p>
                <p className="text-[#6b6b6b] text-sm mt-1">Friend requests will appear here.</p>
              </div>
            )}
            {pendingRequests.map(req => (
              <div
                key={req.friendshipId}
                className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-[#e5e1d8]"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[#2d5a27] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {req.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1a1a1a] truncate">{req.displayName}</p>
                  <p className="text-xs text-[#6b6b6b] truncate">@{req.username}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRespond(req.friendshipId, 'accepted')}
                    disabled={respondingTo === req.friendshipId}
                    className="text-xs bg-[#2d5a27] text-white rounded-lg px-3 py-1.5 font-semibold active:scale-95 transition-transform disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespond(req.friendshipId, 'declined')}
                    disabled={respondingTo === req.friendshipId}
                    className="text-xs border border-[#e5e1d8] text-[#6b6b6b] rounded-lg px-3 py-1.5 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Search / Add ──────────────────────────────────── */}
        {activeTab === 'search' && (
          <>
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by username or name…"
              className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full"
            />

            {searching && (
              <div className="text-center py-6 text-sm text-[#6b6b6b]">Searching…</div>
            )}

            {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="text-center py-6 text-sm text-[#6b6b6b]">No users found for "{searchQuery}"</div>
            )}

            {searchResults.map(result => {
              const alreadySent = sentTo.has(result.userId)
              return (
                <div
                  key={result.userId}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-[#e5e1d8]"
                >
                  <div className="w-10 h-10 rounded-full bg-[#2d5a27] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {result.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1a1a1a] truncate">{result.displayName}</p>
                    <p className="text-xs text-[#6b6b6b] truncate">@{result.username}</p>
                  </div>
                  {result.isFriend ? (
                    <span className="text-xs text-[#2d5a27] font-semibold">Friends</span>
                  ) : result.hasPendingRequest || alreadySent ? (
                    <span className="text-xs text-[#6b6b6b]">Pending</span>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(result.username, result.userId)}
                      disabled={!isAuthenticated || sendingTo === result.userId}
                      className="text-xs bg-[#2d5a27] text-white rounded-lg px-3 py-1.5 font-semibold active:scale-95 transition-transform disabled:opacity-50 flex-shrink-0"
                    >
                      {sendingTo === result.userId ? '…' : 'Add'}
                    </button>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </main>
  )
}
