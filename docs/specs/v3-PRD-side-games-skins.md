# PRD: Integrated Side-Game & Skins Tracker

**Issue:** THEA-193
**Status:** Draft — Awaiting CTO Engineering Breakdown
**Priority:** High
**Date:** 2026-03-28

---

## 1. Problem Statement

Recreational golfers play money games on virtually every group round. Nassau, skins, and press are not edge cases — they are how most amateur golfers experience competitive golf with friends. Yet every major golf app ignores this entirely or buries a basic, non-real-time version that does not handle press rules or persist rivalry history. Golfers currently manage side games with mental math, verbal negotiation, and the back of a scorecard. Disputes are common. The math slows down play. Settlement is chaotic.

Golf Caddy already owns the live scoring interface for group rounds. Adding first-class side game support directly into that interface eliminates the only friction point our current users cannot escape: the running side-game math. This is a daily-use feature, not a novelty — it turns Golf Caddy from a scorecard app into the actual caddy managing the whole round experience.

---

## 2. JTBD User Stories

**Job 1 — Frictionless game setup**
When my foursome is about to tee off and someone says "Nassau, press on 2 down?", I want to configure the side game in the app in under 30 seconds so we all agree on the terms and can focus on playing.

- *Context:* First tee, group round just created, everyone has loaded the lobby
- *Outcome:* Game terms locked in, visible to all players, no verbal re-confirmation needed
- *Current solution:* Verbal agreement, someone writes it on their hand
- *Pain point:* Someone always forgets the terms mid-round

**Job 2 — Live running totals without mental math**
When I make a birdie on hole 7 and there are two skins in the carry, I want to instantly see the updated pot and who leads the Nassau without doing arithmetic in my head so I can stay focused on the next hole.

- *Context:* Mid-round, scorecard view, skins and Nassau both active
- *Outcome:* Live totals visible alongside the scorecard, auto-calculated after each hole
- *Current solution:* Mental math, occasional disputes about who's tracking correctly
- *Pain point:* Math errors cause arguments; no one wants to be the dedicated tracker

**Job 3 — Clean settlement at the end**
When we finish hole 18, I want a settlement screen that tells me exactly who owes who how much — accounting for Nassau, skins, presses, and any carryovers — so we settle up before we leave the green.

- *Context:* Round completion, post-round
- *Outcome:* Unambiguous dollar amounts per player pair, no disputes
- *Current solution:* Group huddles around someone's scorecard doing final math
- *Pain point:* Disagreements about press triggers, carryover rules, final math

**Job 4 — Track the long-running rivalry**
When I play with my regular Saturday group, I want to see my all-time record against each of them — how many times I've won the Nassau, total skins won, running balance — so the rivalry has memory and stakes.

- *Context:* Between rounds, or before starting a new round with the same friends
- *Outcome:* Persistent rivalry history tied to friend relationships
- *Current solution:* Doesn't exist. No one tracks this.
- *Pain point:* Rivalry has no memory; each round resets to zero stakes context

---

## 3. Success Metrics

| Metric | Target (60 days post-launch) |
|--------|------------------------------|
| % of group rounds with side game configured | > 40% |
| Side game completion rate (configured → settlement screen reached) | > 70% |
| 30-day retention of groups who use side games vs. those who don't | +15pp lift |
| Settlement history screen viewed per user per month | ≥ 2 views |
| Support/dispute tickets related to side game math | < 5 total |

---

## 4. MoSCoW Matrix

### Must Have
- **Skins game:** hole-by-hole, carryovers on ties, automatic pot tracking per player
- **Nassau game:** front 9, back 9, overall as 3 independent bets with configurable stakes per bet
- **Press:** automatic press trigger when a player/team is down 2+ on a bet; tracks as a sub-bet alongside parent; resolves independently
- **Side game configuration UI:** available at group round creation (after room code / lobby step)
- **Live side game panel:** visible during scoring, shows current skin value, Nassau standing, active presses per bet
- **Settlement screen:** triggered at round completion; shows net amounts per player pair (who owes who, exact dollar amount)
- **Stableford scoring mode:** points system (eagle=4, birdie=3, par=2, bogey=1, double bogey+=0); separate from Nassau/skins, can run concurrently
- **Multiplayer sync:** side game state (pot, press triggers, skins won per hole) synced via existing Supabase Realtime broadcast
- **Data persistence:** settlement results stored per round in Supabase

### Should Have
- **Settlement history screen:** per-friendship view showing all-time head-to-head records
- **Press configuration toggle:** allow groups to turn off auto-press or set custom trigger threshold
- **Mid-round press override:** host can manually trigger a press outside the auto-trigger rule
- **Carry summary before each hole:** brief display of "X skins in the carry" and "Nassau: front 9 you are +1"

### Could Have
- **Custom stake amounts per game type** (e.g., skins at $2/hole, Nassau at $5/9)
- **Wolf game mode:** rotating hole-by-hole team selection game (popular but more complex)
- **Junk/bonus rules:** greenie, sandy, Bingo Bango Bongo as optional point bonuses
- **Push notification on skin win:** "You won 3 skins on hole 12 — pot now $18"
- **Settlement export:** share settlement summary as image or text

### Won't Have (V1)
- Actual money transfer / payment processing (Venmo deep-link is acceptable as a post-settlement CTA, not integration)
- Handicap-adjusted skins or handicap-adjusted Nassau (net scoring)
- Solo round side games (multiplayer-only in V1)
- Match play tracker (separate feature)
- Team formats beyond 2-man partnerships (scramble, best ball by team)

---

## 5. Anti-Goals

- **No payment processing.** We are not a fintech product. Settlement numbers are for social accountability only.
- **No hardware integration.** Side game logic is purely score-derived. No GPS, no shot data required.
- **No handicap adjustment in V1.** Straight gross scores only. Net/handicap skins is a V2 consideration after we see adoption.
- **Not a standalone side game app.** This feature lives inside group rounds. No solo game modes.
- **No external API calls for game logic.** All Nassau/skins/press calculations run client-side. Server stores results; server does not compute them.

---

## 6. Open Questions

| Question | Owner | Urgency |
|----------|-------|---------|
| Should stakes (dollar amounts) be required or optional at setup? If optional, how does settlement screen display? | PM + Brian | High — affects setup UX |
| Auto-press trigger: down 2 on the bet, or down 2 holes remaining? (Rules vary by group) | PM | High — affects press logic |
| How does Stableford interact with Nassau? Can you run both simultaneously? | PM | Medium |
| Settlement history — does it require both players to have accounts, or does it work with guest players? | CTO | Medium — data model impact |
| Should the side game panel be a drawer/overlay or a tab in the scorecard view? | Designer | Medium — after PRD approved |
| Press on a press — do we support unlimited stacking or cap at 1 level? | PM | Medium |

---

## 7. Acceptance Criteria

### Skins
- [ ] Configuring skins at round start sets a per-skin value and adds all players to the pot
- [ ] After each hole is scored, the app correctly identifies the skin winner (lowest net score, no ties)
- [ ] On a tie, skin carries over and adds to next hole value; carryover counter visible
- [ ] Total skins won per player visible on settlement screen
- [ ] Player with most skins at end receives total skin pot (or split if tie)

### Nassau
- [ ] Three independent bets configured: front 9, back 9, total 18
- [ ] After each hole, Nassau standing updates (who leads front/back/overall, by how many holes)
- [ ] At hole 9, front 9 Nassau winner and amount owed is locked
- [ ] At hole 18, back 9 and overall Nassau winners locked
- [ ] Settlement screen shows per-bet winner and net owed

### Press
- [ ] When a player/team goes down 2 on any Nassau bet, auto-press prompt appears
- [ ] Press creates a sub-bet starting from the hole where it was triggered
- [ ] Sub-bet resolves independently; result added to parent bet settlement
- [ ] Press history visible (how many presses, at which holes)
- [ ] Configuration allows disabling auto-press

### Stableford
- [ ] Points awarded per hole: eagle=4, birdie=3, par=2, bogey=1, double bogey+=0
- [ ] Running Stableford totals visible per player during round
- [ ] Settlement screen includes Stableford winner and point totals

### Multiplayer Sync
- [ ] All players in the round see identical side game state within 2 seconds of a score submission
- [ ] If a player goes offline, side game state rehydrates correctly on reconnect
- [ ] Host can reconfigure side game settings before tee-off (before hole 1 is scored)

### Settlement
- [ ] Settlement screen appears automatically at round completion
- [ ] Settlement shows net amounts: for each player pair, one line with "Player A owes Player B $X" or "All square"
- [ ] Settlement data persists to Supabase on round completion
- [ ] Settlement screen accessible from round history after the fact

### Settlement History
- [ ] Authenticated users can view their record vs. each friend: rounds played, net wins, total owed/won
- [ ] History correctly aggregates across multiple rounds with the same friend

---

## 8. Data Model

### New Tables

**`side_game_configs`**
```sql
id uuid PK
group_round_id uuid FK → group_rounds.id
game_types jsonb          -- ["skins", "nassau", "press", "stableford"]
stake_per_skin numeric    -- nullable
nassau_stake_front numeric
nassau_stake_back numeric
nassau_stake_overall numeric
press_enabled boolean DEFAULT true
press_trigger_threshold int DEFAULT 2
created_at timestamptz
```

**`side_game_results`**
```sql
id uuid PK
group_round_id uuid FK → group_rounds.id
game_type text            -- 'skins' | 'nassau_front' | 'nassau_back' | 'nassau_overall' | 'press' | 'stableford'
winner_player_id uuid FK → group_round_players.id  -- nullable for ties
loser_player_id uuid FK → group_round_players.id   -- nullable
amount_owed numeric       -- positive = loser_player_id owes winner_player_id
hole_range int4range      -- e.g., [1,9] for front nassau, [1,18] for overall
metadata jsonb            -- press depth, carryover count, stableford points, etc.
created_at timestamptz
```

**`settlement_history`**
```sql
id uuid PK
round_id uuid FK → group_rounds.id
from_user_id uuid FK → auth.users.id
to_user_id uuid FK → auth.users.id
net_amount numeric        -- positive = from_user owes to_user; stored post-netting
settled_at timestamptz
```

### Existing Table Changes

**`group_rounds`** — add: `side_games_enabled boolean DEFAULT false`

**Supabase Realtime broadcast channel** (already exists per group round):
Add `side_game_state` field to the broadcast payload:
```json
{
  "side_game_state": {
    "skins_carry": 3,
    "skins_value": 6.00,
    "nassau_front": { "leader": "player_id", "margin": 2 },
    "nassau_back": { "leader": null, "margin": 0 },
    "nassau_overall": { "leader": "player_id", "margin": 1 },
    "active_presses": [{ "bet": "nassau_front", "started_hole": 4 }],
    "stableford_totals": { "player_id": 14, "player_id_2": 11 }
  }
}
```

### Client-Side vs. Server-Side Calculation

**All game logic runs client-side.** The authoritative calculation source is the scoring client, not Supabase. This means:
- Low latency (no round-trip for game state updates)
- Works offline with local score queue (consistent with existing sync architecture)
- Server stores only final `side_game_results` and `settlement_history` rows — no mid-round calculation

The host's client is the canonical source for mid-round side game state. On reconnect, other clients re-derive state from the full score history already in the Realtime channel.

---

## 9. Multiplayer Sync Architecture

Side game state is broadcast alongside scores on the existing per-round Supabase Realtime channel. No new channel is needed.

**Broadcast events:**
- `score_update` (existing): triggers side game recalculation on all clients
- `side_game_config` (new): host broadcasts config at round start; all clients store locally

**Presence data update:** Add `side_game_ready: boolean` to presence payload so lobby screen shows when all players have received config.

**Conflict resolution:** All clients run identical deterministic logic on the same score data — no conflict possible. Late-joining players rehydrate from `group_round_scores` history + `side_game_configs`.

---

## 10. Social Integration

Settlement history is keyed to `auth.users.id` pairs. This means:
- Guest players (no account) do not appear in long-term history — shows as "Guest" in settlement, not tracked
- Authenticated players accumulate rivalry history automatically after each round
- Friends screen (in-progress THEA work) surfaces a "Rivalry Record" section per friend: rounds played, net wins, running balance

The rivalry record becomes a core engagement hook — users check it before a round with their regular group.

---

## 11. Engineering Ticket Breakdown

| Ticket | Title | Owner | Size |
|--------|-------|-------|------|
| SIDE-1 | DB: side_game_configs + side_game_results + settlement_history tables + RLS | Backend Infra | M |
| SIDE-2 | Client: Side game configuration UI (round setup flow, after lobby step) | SE | M |
| SIDE-3 | Client: Skins game logic engine (carryover, pot tracking) | SE | M |
| SIDE-4 | Client: Nassau game logic engine (front/back/overall, settlement) | SE | M |
| SIDE-5 | Client: Press logic engine (auto-trigger, sub-bet tracking, resolution) | SE | M |
| SIDE-6 | Client: Stableford scoring mode | SE | S |
| SIDE-7 | Client: Live side game panel in scorecard view | SE | M |
| SIDE-8 | Client: Settlement screen (round completion trigger, net amounts display) | SE | M |
| SIDE-9 | Realtime: Add side_game_state to broadcast payload + client sync | SE | S |
| SIDE-10 | DB: Persist settlement results on round completion | Backend Infra | S |
| SIDE-11 | Client: Settlement history screen (per-friend rivalry view) | SE | M |
| SIDE-12 | QA: Full side game flow — skins + Nassau + press E2E test | QA | M |

**Suggested sequencing:**
- Week 1: SIDE-1 + SIDE-3 + SIDE-4 (foundation: DB + core game logic)
- Week 2: SIDE-2 + SIDE-6 + SIDE-7 (UI: setup + live panel + Stableford)
- Week 3: SIDE-5 + SIDE-8 + SIDE-9 (press logic + settlement + sync)
- Week 4: SIDE-10 + SIDE-11 + SIDE-12 (persistence + history + QA)
