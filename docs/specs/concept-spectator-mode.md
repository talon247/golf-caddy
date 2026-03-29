# Spectator Mode — Concept Document

**Status:** Concept / Pre-PRD
**Author:** PM Agent
**Date:** 2026-03-28
**Decision pending:** Brian + Ron review before build decision

---

## Overview

Spectator Mode lets a user watch a live group round without joining as a player. They see the live leaderboard, hole-by-hole scores, and side game standings — all in real time — without affecting the round or scorecards.

The app already has the technical foundation: Supabase Realtime broadcast channels (`round:{groupRoundId}`), presence tracking, and a LiveLeaderboard component. Spectator Mode is an **access-level extension** on top of infrastructure that already exists.

---

## 1. Use Cases — Who Watches and Why?

### Primary (high value)
| Persona | Situation | Why It Matters |
|---|---|---|
| **Betting observer** | Has action on the round (Nassau, skins side bet) but isn't playing | Wants live results — this is the highest-engagement spectator |
| **Clubhouse watcher** | Friends at the 19th hole waiting for the group to finish | Casual scoreboard glance; "how close are they?" |

### Secondary
| Persona | Situation |
|---|---|
| **Remote partner/family** | Following along from home or work |
| **Caddie/range employee** | Watching the group they're supporting |
| **Non-golfer significant other** | Wants to know when to expect the group back |

### Insight
The **betting observer** is the highest-value spectator. They have financial stakes in the outcome and will refresh obsessively. If side game standings are visible to spectators, this becomes a social/engagement hook that drives round sharing.

---

## 2. Live Experience — What Does a Spectator See?

### Must-show
- **Running leaderboard** — scores vs par per player, updated hole-by-hole
- **Current hole** each player is on
- **Round status** — in progress / finished / waiting on player

### Should-show
- **Side game standings** — skins count, Nassau (front/back/overall), pot size
- **Hole completion time** — estimated finish time (based on holes remaining + pace)

### Could-show (future)
- Shot-by-shot updates (requires players to log shots individually, not just hole scores)
- Course map view with player positions

### Won't-show (at launch)
- Individual shot data (no shot tracking for V3)
- GPS/map of player positions (requires hardware)

### Key Design Decision
Spectators see **hole completion scores only** — not shot-by-shot, since the current app only captures scores per hole. This is the right scope for now and matches what players actually log.

---

## 3. Entry Flow — How Do Spectators Get In?

### Recommended: Share Link (Host-generated)
1. Host taps **Share Round** from the active round screen
2. App generates a spectator-only link: `golfcaddy.app/watch/{roomCode}`
3. Link is shareable via iMessage, WhatsApp, or copy/paste
4. Recipient opens link → lands on read-only leaderboard view (no account required)

### Alternative: Quick Join with Spectate Option
- Same room code flow as player join
- After entering code, user sees two buttons: **Join as Player** / **Watch**
- Choosing Watch puts them in spectator mode without claiming a scorecard slot

### Anonymous Access
- Spectator links should work **without login** — frictionless for non-users
- This is a viral acquisition surface: a spectator who enjoys the experience may sign up

### Won't Do
- Auto-available to all friends (requires a social graph / friends system not yet built)
- Push notification "your friend started a round" (requires notification opt-in infrastructure)

---

## 4. Privacy — What Can the Host Control?

### Default behavior
- Spectators **disabled by default** — host must explicitly share the link to enable spectating
- This avoids surprising players who don't expect an audience

### Host controls
| Setting | Options |
|---|---|
| Spectators allowed | Off (default) / Link only / Anyone |
| Side game visibility | Visible to spectators / Hidden |

### Side bet visibility
- **Recommended: let host decide.** Some groups are comfortable with spectators seeing bet sizes; others aren't. Default to hidden, toggleable on.
- This is especially relevant for the betting observer persona — they likely already know the stakes.

---

## 5. Engagement — What Can a Spectator Do?

### V1 Scope (watch-only)
- View live leaderboard — no interaction
- Pull-to-refresh or auto-refresh every 30 seconds (no persistent Realtime subscription for anonymous users unless they sign in)

### V2 Scope (social layer)
- **Emoji reactions** — tap a player's score to react (birdie = 🔥, bogey = 😬, eagle = 🦅)
- Reactions visible to players on their scorecard briefly (toast notification)
- Creates a "peanut gallery" feel — light, fun, non-intrusive

### Won't Do (V1)
- Text comments from spectators to players (too much moderation complexity)
- Spectator-to-spectator chat
- Spectator leaderboard (ranking spectators by prediction accuracy — interesting but out of scope)

---

## 6. Competitive Differentiation

### Current landscape
| App | Spectator feature? |
|---|---|
| Golfshot | No |
| 18Birdies | No live spectator mode |
| TheGrint | Scorecard-sharing after round, not live |
| GolfNow | No |
| Shot Scope | No |
| Arccos | Live stats dashboard, but player-facing only |

**Finding:** No mainstream golf app has a first-class live spectator mode for casual group rounds. This is a genuine whitespace opportunity.

### Our differentiator
- **Side game visibility for betting observers** — no other app does this
- **Frictionless anonymous access** via share link — no download required to watch
- **Emoji reactions** create social feedback loop between spectators and players

The share link is also a **user acquisition channel**: every round watched by a non-user is a top-of-funnel touchpoint.

---

## 7. Technical Foundation (What Already Exists)

The app already has everything needed:

| Existing capability | How it enables Spectator Mode |
|---|---|
| `useGroupRoundBroadcast` hook | Spectator subscribes to same Realtime channel (`round:{groupRoundId}`) in read-only mode |
| `LiveLeaderboard.tsx` | Reusable as-is for spectator view — just remove edit controls |
| `QuickJoinModal.tsx` | Entry point to add a "Watch" path alongside "Join as Player" |
| Presence tracking | Can indicate spectator count to players ("2 watching") |
| Room code system | Spectator share link uses the same room code |

The core implementation is a **new route** (`/watch/:roomCode`) that:
1. Resolves the room code to a `groupRoundId`
2. Opens the Realtime channel in listen-only mode
3. Renders LiveLeaderboard in read-only mode
4. No auth required for anonymous spectating

---

## 8. Open Questions for Brian + Ron

1. **Anonymous access OK?** Should spectators need to sign in, or is frictionless link-based access preferred? (Recommendation: no login required, but prompt to sign up after watching)

2. **Side bet amounts visible?** Should spectators see dollar amounts in side games, or just standings (who's winning, not how much)? (Recommendation: standings only by default, host can enable amounts)

3. **Emoji reactions in V1 or later?** The watch-only V1 is simpler to ship. Reactions add engagement but require a new broadcast message type.

4. **Spectator count visible to players?** Showing "3 watching" could be motivating or pressure-inducing — depends on the group.

5. **Share link expiry?** Should spectator links expire when the round ends, or persist for 24 hours so people can review final scores?

---

## 9. Recommendation

Build Spectator Mode in two phases:

**Phase 1 — Watch-only (low effort, high value)**
- New `/watch/:roomCode` route
- Read-only LiveLeaderboard (reuse existing component)
- Anonymous access via share link
- Host can enable/disable + control side game visibility
- Estimated scope: small — 1–2 sprint

**Phase 2 — Social layer (medium effort, high engagement)**
- Emoji reactions (new broadcast event type)
- "X watching" indicator for players
- Push notification prompt for signed-in spectators
- Estimated scope: medium — 2–3 sprints

The Phase 1 investment is minimal given the existing Realtime infrastructure. The spectator share link is also a low-cost acquisition surface.
