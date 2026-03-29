# PRD: Tournament Mode — League & Event with Commissioner Role
**Author:** Brian (board) + Ron  
**Date:** 2026-03-28  
**Target horizon:** Horizon 2  
**Status:** Approved for CTO scoping

---

## Overview

Golf Caddy needs a top-level round type hierarchy that reflects how golf is actually played. Today we have solo rounds and group rounds. We need a third: **Tournament**.

Tournament is the competitive layer that powers the GTM strategy — it's what private clubs, member leagues, and event organizers actually need.

---

## Round Type Hierarchy

When a user taps "Start New Round" (or equivalent), they see three options:

```
[ Solo Round ]     [ Group Round ]     [ Tournament ]
```

**Solo Round** — existing, unchanged. One player, logs their own round.

**Group Round** — existing, enhanced. 2–6 players in a live shared scorecard via share link.

**Tournament** — new. Structured competitive format with a commissioner. Two types:

```
Tournament
├── League
└── Event
```

---

## League

A League is a **recurring competitive season** with persistent standings across multiple rounds.

**Who creates it:** Any user. The creator becomes the Commissioner.

**Structure:**
- Commissioner defines the season: name, start date, end date, points system, eligible side games
- Commissioner invites members (via share link or username search)
- Members join and are enrolled in the season standings
- Every group round played within the league counts toward standings
- Live leaderboard updates after each round
- Season ends on the defined date → final standings locked → champion declared

**Commissioner controls:**
- Add/remove members
- Approve or void a round (dispute resolution)
- Set points rules (e.g. 2pts/skin, 5pts/Nassau leg — or custom)
- Start and end the season
- View all member round history within the season

**Data model additions needed:**
- `leagues` table (id, name, commissioner_id, start_date, end_date, points_config, status)
- `league_members` table (league_id, user_id, joined_at)
- `league_rounds` table (league_id, group_round_id, counted_at)
- `league_standings` view (computed from league_rounds + settlement data)

---

## Event

An Event is a **one-time tournament** — a single day, a single competition, a defined field.

Use cases: member-guest, club championship, charity outing, bachelor trip, corporate event.

**Who creates it:** Any user. The creator becomes the Commissioner.

**Structure:**
- Commissioner creates the event: name, date, course, format (stroke play, match play, scramble, etc.), field size
- Commissioner shares a join link — players join before the event starts
- On the day: all players tee off, scores are logged in real time
- Live leaderboard visible to all participants during the event
- Event ends when all scorecards are submitted → final results locked → payout/settlement calculated

**Host controls:**
- Manage the field (add/remove players)
- Set the format and scoring rules
- Configure side games for the event (optional)
- View all scorecards in real time
- Lock results and trigger settlement

**Data model additions needed:**
- `events` table (id, name, host_id, date, course_id, format, status, field_size)
- `event_players` table (event_id, user_id, guest_name [for non-account players])
- `event_rounds` table (event_id, round_id, player_id)
- `event_results` view (computed standings + settlement)

---

## Roles: Commissioner vs. Host

**Commissioner** (League creator) and **Host** (Event creator) are distinct named roles — not interchangeable.

### Commissioner (League)
The Commissioner is the permanent authority for a recurring season. They own the standings, the rules, and the integrity of the season.

**What Commissioners can do:**
- Create and manage the season (start/end dates, points rules, eligible formats)
- Add/remove league members
- Approve or void rounds (dispute resolution)
- See a **Commissioner Dashboard** — all member standings, round history, disputes
- Post season announcements visible to all members
- Export final season results

**What Commissioners cannot do (V1):**
- Cannot modify individual scorecards directly (void/approve only)
- Cannot transfer the Commissioner role (V2)

---

### Host (Event)
The Host is the one-time organizer for a single tournament or outing. Lighter-weight role — set it up, run the day, settle results.

**What Hosts can do:**
- Create the event (name, date, course, format, field size)
- Share the join link and manage the field
- See a **Host Dashboard** — live scorecards, real-time leaderboard
- Lock results and trigger settlement when the event ends
- Configure optional side games

**What Hosts cannot do (V1):**
- Cannot approve/void rounds after results are locked
- Cannot transfer the Host role

---

## Join Flow

Both League and Event use the same frictionless join:
- Commissioner (League) or Host (Event) generates a share link
- Anyone taps the link → joins in browser with just their name (One Link Golf)
- Registered Golf Caddy users get their stats tracked; guests get the experience
- Post-round: guests see the conversion prompt to save their history

---

## UI Changes Required

**Home screen:** "Start New Round" expands to show Solo / Group Round / Tournament
**Tournament creation flow:** name → type (League or Event) → details → invite link generated
**Commissioner Dashboard:** new screen, visible only to commissioners of active leagues/events
**Standings/Leaderboard:** enhanced to support multi-round league context, not just single-round
**Round tagging:** when starting a group round within a tournament context, the round is tagged to the league/event automatically

---

## What This Unlocks for GTM

- **Clubs:** Head pro creates an Event for member-guest. 80 members get the share link. This is the club acquisition wedge.
- **Leagues:** Commissioner creates a League. 24 members are locked in for the season. This is the retention flywheel.
- **Outings:** Host creates an Event. 40 people join via share link. This is the viral moment.
- **Friend groups:** Four guys create a League for their Saturday Nassau. The season standings become the reason they keep coming back.

---

## Acceptance Criteria (Horizon 2 scope)

- [ ] "Tournament" appears as a third option on the new round flow
- [ ] League creation: commissioner can create a season with start/end dates, points config, and invite link
- [ ] Event creation: commissioner can create a one-day event with field, format, and invite link
- [ ] Commissioner Dashboard: shows all participants, round status, live standings
- [ ] League standings update automatically after each group round is completed
- [ ] Event results lock when commissioner marks the event complete
- [ ] Join flow works via share link (leverages One Link Golf — no download required)
- [ ] Guest players can participate in Events (not Leagues — league standings require an account)
- [ ] Commissioner role is clearly labeled in the UI

---

## Open Questions for CTO

1. Does `league_standings` require a real-time computed view or is a triggered recalculation on round completion sufficient?
2. How do we handle a group round that is played within an Event but the commissioner later voids it — do we recalculate or soft-delete?
3. For Events: do we need a check-in flow before the round starts, or is the join link sufficient?
4. Commissioner Dashboard: separate screen or a panel within the existing League/Event detail screen?
