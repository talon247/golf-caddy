# V3 PRD: Friends, Presence & Quick-Join Group Rounds

**Status:** Final Draft
**Version:** 1.0
**Author:** CTO, The Colony
**Date:** 2026-03-28
**Track:** V3
**PRD ID:** THEA-138

---

## Executive Summary

Golf Caddy's group rounds feature currently uses a room-code-based join system with polling-based lobby updates. Players must manually share a 4-digit code to invite others, and there is no concept of social connections between users. This PRD defines three interconnected features that transform Golf Caddy into a social golf platform:

1. **Friends System** — Add friends by username, accept/decline requests, view friends list
2. **Presence** — See which friends are currently in an active round, in real-time
3. **Quick-Join** — One-tap join a friend's active group round without entering a room code

These features build on the existing `profiles` table, `group_rounds` infrastructure, and Supabase Realtime broadcast channel already in production.

---

## Problem Statement

### Current State
- Group rounds require sharing a 4-digit room code via external means (text, voice)
- No concept of friendships or social connections between users
- No visibility into whether other users are currently playing
- Players must be physically co-located or coordinate externally to join the same round
- The `profiles` table exists but has no social graph

### User Pain Points
1. **Friction to Group Up**: "I have to text my buddy the room code every time we play"
2. **No Social Discovery**: "I can't tell if my friend is already on the course"
3. **Missed Opportunities**: "I would have joined their round if I'd known they were playing"
4. **Repeated Coordination**: "We play together every week but it's a new code each time"

### Business Impact
- Group rounds are the stickiest feature — reducing join friction increases session frequency
- Social connections create retention loops (friends keep friends coming back)
- Presence creates FOMO-driven engagement (seeing friends play triggers "I should go too")
- Foundation for future features: leagues, challenges, head-to-head

---

## Goals & Success Metrics

### Primary Goals
| Goal | Description | Priority |
|------|-------------|----------|
| G1 | Users can send, accept, and decline friend requests | P0 |
| G2 | Users can see real-time presence status of friends | P0 |
| G3 | Users can quick-join a friend's active group round | P0 |
| G4 | Privacy controls: users can hide presence or block friend requests | P1 |
| G5 | Room code flow continues to work for non-friend joins | P0 |

### Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Friends added per active user | ≥ 2 in first 30 days | Count of accepted friendships |
| Quick-join usage | ≥ 30% of group round joins via quick-join | Join source tracking |
| Group round frequency | +25% increase in group rounds per user | Rounds per user per week |
| Presence-driven sessions | ≥ 10% of app opens lead to a quick-join | Event tracking |

---

## Assumptions & Prerequisites

1. **Auth is live** — Users must be authenticated (V3 auth from THEA-100 PRD)
2. **Profiles exist** — The `profiles` table with `display_name` is already deployed
3. **Supabase Realtime is available** — Broadcast channel pattern already proven in score sync
4. **Group rounds schema stable** — Current `group_rounds` + `group_round_players` tables unchanged
5. **4-player cap remains** — Quick-join respects existing player limit

---

## Technical Design

### 1. Friends Data Model

#### New Tables

##### `friendships`
```sql
CREATE TABLE public.friendships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate requests in either direction
  CONSTRAINT friendships_unique_pair UNIQUE (
    LEAST(requester_id, addressee_id),
    GREATEST(requester_id, addressee_id)
  ),
  -- Prevent self-friendship
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id)
);

-- Fast lookups: "all friendships involving user X"
CREATE INDEX friendships_requester_idx ON public.friendships (requester_id, status);
CREATE INDEX friendships_addressee_idx ON public.friendships (addressee_id, status);

-- RLS: Users can only see friendships they are part of
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() IN (requester_id, addressee_id));

CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id AND status = 'pending');

CREATE POLICY "Addressee can respond to requests"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id)
  WITH CHECK (status IN ('accepted', 'declined', 'blocked'));

CREATE POLICY "Either party can delete (unfriend)"
  ON public.friendships FOR DELETE
  USING (auth.uid() IN (requester_id, addressee_id));
```

##### `profiles` table additions
```sql
-- Add username for friend search (unique, lowercase, alphanumeric + underscore)
ALTER TABLE public.profiles
  ADD COLUMN username text UNIQUE,
  ADD COLUMN presence_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN friend_requests_open boolean NOT NULL DEFAULT true;

-- Username format constraint
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[a-z0-9_]{3,20}$');

-- Index for username search
CREATE INDEX profiles_username_idx ON public.profiles (username);
```

#### Friend Request Flow (RPCs)

##### `send_friend_request(p_addressee_username text) → jsonb`
```
1. Look up addressee by username in profiles
2. Check addressee.friend_requests_open = true
3. Check no existing friendship row (in either direction)
4. Insert into friendships (requester_id=auth.uid(), addressee_id, status='pending')
5. Return { success: true, friendshipId, addresseeDisplayName }
   Errors: 'user_not_found', 'requests_disabled', 'already_exists', 'self_request'
```

##### `respond_friend_request(p_friendship_id uuid, p_action text) → jsonb`
```
1. Validate p_action IN ('accepted', 'declined', 'blocked')
2. Validate auth.uid() = addressee_id AND status = 'pending'
3. Update friendship status + updated_at
4. Return { success: true, status: p_action }
   Errors: 'not_found', 'not_addressee', 'already_responded'
```

##### `get_friends(p_status text DEFAULT 'accepted') → jsonb`
```
1. Select all friendships where (requester_id=auth.uid() OR addressee_id=auth.uid()) AND status=p_status
2. Join with profiles to get display_name, username, handicap_index for each friend
3. Return array of { friendshipId, friendUserId, displayName, username, handicapIndex }
```

##### `search_users(p_query text) → jsonb`
```
1. Search profiles where username ILIKE p_query || '%' OR display_name ILIKE '%' || p_query || '%'
2. Exclude auth.uid() from results
3. Limit 20 results
4. Return array of { userId, displayName, username, isFriend: boolean, hasPendingRequest: boolean }
```

##### `remove_friend(p_friendship_id uuid) → jsonb`
```
1. Validate auth.uid() IN (requester_id, addressee_id)
2. DELETE the friendship row
3. Return { success: true }
```

---

### 2. Presence System

#### Approach: Supabase Realtime Presence

Use Supabase Realtime Presence (not polling) on a shared channel. This is the same Realtime infrastructure already used for score broadcast, extended with the Presence API for user-level online/activity state.

#### Channel Design

**Channel**: `presence:friends:{userId}`

Each authenticated user subscribes to their own presence channel on app load. Their friends subscribe to the same channel to receive presence updates.

**Implementation pattern** (simplified — actual subscription is per-friend-group):

```
Channel: `presence:global`
```

A single global presence channel where all authenticated users track their state. Each client filters the presence list to show only friends. This avoids O(N) channel subscriptions per user.

**Presence Payload** (sent via `channel.track()`):
```typescript
interface PresenceState {
  userId: string;
  displayName: string;
  status: 'online' | 'in_round';
  groupRoundId?: string;    // Set when in an active group round
  roomCode?: string;         // Set when in an active group round
  courseName?: string;       // Current course name
  currentHole?: number;      // Progress indicator
  playerCount?: number;      // How many in the group
  maxPlayers: number;        // 4 (capacity)
  joinable: boolean;         // false if full or presence_visible=false
  updatedAt: string;
}
```

#### Presence Lifecycle

1. **App Load** (authenticated): Join presence channel, track `{ status: 'online', joinable: false }`
2. **Start/Join Group Round**: Update presence to `{ status: 'in_round', groupRoundId, roomCode, courseName, joinable: true, playerCount, maxPlayers: 4 }`
3. **Round Full** (4 players): Update `joinable: false`
4. **Round Complete**: Revert to `{ status: 'online', joinable: false }`
5. **App Background/Close**: Supabase auto-removes presence after timeout (~30s)

#### Privacy: `presence_visible` Flag

- If `profiles.presence_visible = false`, the client does NOT join the presence channel
- Friends see the user as "offline" (absence = offline, not a distinct state)
- This is enforced client-side (presence is opt-in by nature)
- Default: `true` (visible)

#### Fallback: Polling for Presence (Degraded Mode)

If Realtime Presence is unavailable (e.g., connection issues), fall back to a lightweight RPC:

##### `get_friends_in_rounds() → jsonb`
```sql
SELECT
  f.friend_user_id,
  p.display_name,
  gr.id AS group_round_id,
  gr.room_code,
  gr.course_name,
  grp_count.player_count,
  gr.status
FROM friends_view f
JOIN group_round_players grp ON grp.user_id = f.friend_user_id
JOIN group_rounds gr ON gr.id = grp.group_round_id AND gr.status = 'active'
LEFT JOIN LATERAL (
  SELECT count(*) AS player_count FROM group_round_players WHERE group_round_id = gr.id
) grp_count ON true
WHERE f.user_id = auth.uid()
  AND p.presence_visible = true;
```

Poll interval: 30 seconds (background), 10 seconds (friends list page active).

> **Note:** This fallback requires adding a `user_id` column to `group_round_players` (see Migration section below).

---

### 3. Quick-Join Flow

#### User Journey

1. User opens app → sees "Friends Playing" card on Home page (or Friends tab)
2. Card shows: friend's name, course, hole progress, "Join" button
3. User taps "Join" → confirmation modal: "Join [Friend]'s round at [Course]?"
4. On confirm → calls existing `join_group_round(roomCode, playerName)` RPC
5. If round is active → immediate catch-up flow (already implemented)
6. If round is waiting → enters lobby (already implemented)
7. If round is full → shows "Round is full" error

#### Integration with Existing Room Code System

Quick-join does NOT bypass the room code system. It simply auto-fills the room code from presence data, removing the need for manual entry. The same `join_group_round` RPC is called under the hood.

**Why this matters:**
- No new server-side join logic needed
- Existing player cap, validation, and catch-up logic all apply
- Room codes still work for non-friends (backwards compatible)
- Presence just provides a discovery layer on top

#### Quick-Join Guard Rails

- Cannot quick-join if `joinable: false` (round full)
- Cannot quick-join your own round
- Button disabled with explanation if round is completed or expired
- If presence data is stale (round ended between presence update and tap), the `join_group_round` RPC returns `'completed'` or `'not_found'` — handled by existing error UI

---

### 4. Database Migration: `group_round_players` Enhancement

To support presence fallback and friend-round lookups, add `user_id` to `group_round_players`:

```sql
-- Link group round players to authenticated users (nullable for guest players)
ALTER TABLE public.group_round_players
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for "find rounds my friends are in"
CREATE INDEX group_round_players_user_idx ON public.group_round_players (user_id)
  WHERE user_id IS NOT NULL;
```

Update `join_group_round` RPC to accept and store `user_id` when the caller is authenticated.

---

### 5. Privacy Controls

| Setting | Column | Default | Effect |
|---------|--------|---------|--------|
| Presence Visible | `profiles.presence_visible` | `true` | Controls whether friends can see you're online/in-round |
| Friend Requests Open | `profiles.friend_requests_open` | `true` | Controls whether others can send you friend requests |
| Block User | `friendships.status = 'blocked'` | N/A | Blocked user cannot send requests or see presence |

#### Block Behavior
- Blocking sets `friendships.status = 'blocked'`
- Blocked user sees the blocker as "not found" in search
- Blocked user's friend request returns `'user_not_found'` (no leak)
- Blocker no longer sees blocked user's presence
- Unblocking: delete the friendship row, can re-add as friend

---

### 6. New Zustand Stores

#### `friendsStore`
```typescript
interface FriendsStore {
  friends: Friend[];
  pendingRequests: FriendRequest[];  // Incoming pending
  sentRequests: FriendRequest[];     // Outgoing pending

  // Actions
  loadFriends: () => Promise<void>;
  loadPendingRequests: () => Promise<void>;
  sendRequest: (username: string) => Promise<void>;
  respondRequest: (friendshipId: string, action: 'accepted' | 'declined' | 'blocked') => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<SearchResult[]>;
}
```

#### `presenceStore`
```typescript
interface PresenceStore {
  onlineFriends: Map<string, PresenceState>;
  friendsInRounds: FriendRoundInfo[];  // Derived: filtered to in_round + joinable

  // Actions
  initPresence: () => void;           // Subscribe to channel
  updateMyPresence: (state: Partial<PresenceState>) => void;
  teardown: () => void;               // Unsubscribe
}
```

---

### 7. UI Components & Pages

#### New Pages
| Route | Page | Description |
|-------|------|-------------|
| `/friends` | FriendsPage | Friends list, pending requests, search/add |
| `/friends/search` | FriendSearchPage | Search by username or display name |
| `/settings/privacy` | PrivacySettingsPage | Toggle presence_visible, friend_requests_open |

#### New Components
| Component | Location | Description |
|-----------|----------|-------------|
| `FriendsPlayingCard` | Home page | Shows friends currently in active rounds with Join buttons |
| `FriendRequestBadge` | BottomNav friends icon | Badge count for pending incoming requests |
| `FriendListItem` | FriendsPage | Friend row with presence dot (green=online, blue=in-round) |
| `QuickJoinModal` | Overlay | Confirmation before joining a friend's round |
| `UsernameSetup` | Post-signup flow | Prompt to choose a username (required for friends) |

#### BottomNav Update
Add a "Friends" tab to the bottom navigation (icon: `Users`). Badge shows pending request count.

---

### 8. Username Onboarding

Since the friends system requires a unique username:

1. **New signups**: After email verification, prompt for username selection
2. **Existing users**: On first visit to Friends page, show username setup modal
3. **Validation**: 3-20 chars, lowercase alphanumeric + underscore, unique
4. **Availability check**: Debounced (300ms) call to `check_username_available(p_username)` RPC

---

## Migration Plan

### Phase 1: Schema & RPCs (THEA-162)
- Create `friendships` table with RLS
- Add `username`, `presence_visible`, `friend_requests_open` to `profiles`
- Add `user_id` to `group_round_players`
- Create all RPCs: `send_friend_request`, `respond_friend_request`, `get_friends`, `search_users`, `remove_friend`, `check_username_available`
- Update `join_group_round` to accept optional `p_user_id`

### Phase 2: Friends UI (THEA-163)
- Username setup flow
- Friends page (list, pending, search)
- `friendsStore` Zustand store
- Friend request send/accept/decline/block UI
- BottomNav friends tab with badge

### Phase 3: Presence (THEA-164)
- `presenceStore` Zustand store
- Supabase Realtime Presence integration
- Presence tracking lifecycle (online → in-round → offline)
- Privacy toggle in settings
- Friends list presence indicators (green dot, blue dot)
- Polling fallback RPC

### Phase 4: Quick-Join (THEA-165)
- `FriendsPlayingCard` on Home page
- `QuickJoinModal` confirmation flow
- Integration with existing `join_group_round` RPC
- Join source tracking (room_code vs quick_join)
- Error handling for stale presence data

### Phase 5: Polish & Edge Cases (THEA-166)
- Block/unblock flow
- Unfriend confirmation
- Empty states (no friends, no one playing)
- Push notification foundation (friend started a round) — stub only
- Performance: presence channel scaling review

---

## Ticket Breakdown

| Ticket | Title | Depends On | Priority | Estimate |
|--------|-------|------------|----------|----------|
| THEA-162 | Friends schema, RPCs, and migrations | Auth (THEA-100) | P0 | M |
| THEA-163 | Friends UI — list, search, requests, username setup | THEA-162 | P0 | L |
| THEA-164 | Presence system — Realtime tracking + privacy | THEA-162 | P0 | L |
| THEA-165 | Quick-join — home card, modal, auto-join flow | THEA-163, THEA-164 | P0 | M |
| THEA-166 | Polish — block/unblock, empty states, edge cases | THEA-165 | P1 | S |

**Size key:** S = ≤ 2 hours, M = 2–4 hours, L = 4–8 hours

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Realtime Presence scaling (>100 concurrent users) | Degraded presence | Low (MVP scale) | Single global channel + client-side filtering; can shard later |
| Username squatting | Poor UX | Medium | Require min 3 chars, reserve common words, add reporting |
| Stale presence → failed quick-join | Frustrating UX | Medium | Graceful error handling already in `join_group_round` RPC |
| Privacy expectations | Trust issue | Medium | Default presence ON but prominent toggle; block is immediate |
| Presence channel abuse (spoofed state) | Misleading UI | Low | Presence is cosmetic; actual join still validated server-side |

---

## Out of Scope (V4+)

- Push notifications ("Friend started a round")
- Friend suggestions / "People you may know"
- Friend groups / teams
- Invite links (deep links to add friend)
- Friend activity feed
- Leaderboard between friends (all-time stats)
- Direct messaging between friends

---

## Open Questions

1. **Username requirement timing**: Should username be mandatory at signup, or optional until first friend interaction? Recommendation: optional, prompted on first Friends page visit.
2. **Friend limit**: Should there be a max friends count? Recommendation: 200 cap initially (prevents abuse, can raise later).
3. **Presence granularity**: Should friends see which hole you're on? Recommendation: yes, it adds engagement ("they're on 14, I could catch up").
4. **Guest quick-join**: Can a non-authenticated user quick-join? Recommendation: no, friends system requires auth. Room codes still work for guests.
