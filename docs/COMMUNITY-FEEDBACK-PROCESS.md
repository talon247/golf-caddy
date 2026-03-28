# Community Feedback Process — Golf Caddy Beta

**Owner:** Ron (Chief of Staff) + PM
**Effective:** March 2026
**Review cadence:** Monthly (part of Monthly Review Ritual)

---

## Overview

Beta testers post unstructured feedback in Discord. Ron triages it, structured feature requests go to Canny for community voting, and Brian approves which voted items enter the development pipeline. This document defines every step of that chain.

---

## 1. Triage Process (Ron)

### Definitions

| Category | Definition | Example |
|---|---|---|
| **Bug** | App behaves incorrectly or crashes | Score not saving, round won't load |
| **UX Issue** | App works but is confusing or frustrating | Button placement, unclear labeling |
| **Feature Request** | New capability not currently in the app | "I want to compare rounds against friends" |

### Discord Channels to Monitor
- `#bug-reports` — direct bug reports; highest priority
- `#feedback` — mixed UX and feature requests; requires categorization

### Response SLAs

| Category | SLA | Action |
|---|---|---|
| **P0 Bug** (crash / data loss) | ≤4h | Create Paperclip ticket immediately, tag CTO |
| **Bug** (functional) | ≤24h | Create Paperclip ticket, assign to CTO/SWE |
| **UX Issue** | ≤48h | Create Paperclip ticket, assign to Designer or PM |
| **Feature Request** | Weekly batch | Queue for Canny — do not create tickets |

### What Gets a Paperclip Ticket Immediately

- Any P0 bug (crash, data loss, auth failure)
- Any regression in a feature that shipped in the last 14 days
- Security issues (route to CSO immediately)

**Everything else goes through Canny first. No exceptions.**

### Triage Checklist (per feedback item)

1. Read the Discord message in full
2. Classify: Bug / UX / Feature Request
3. If Bug or UX: create Paperclip ticket with severity, steps to reproduce, affected platform
4. If Feature Request: add to weekly Canny batch queue
5. Acknowledge the beta tester in Discord within SLA window

---

## 2. Canny Board Setup

### Board Categories

| Category | Scope |
|---|---|
| **Core Gameplay** | Shot tracking, scoring, pars, penalties |
| **Social** | Friends, presence, sharing, leaderboards |
| **Analytics** | Trends, handicap, club usage, FIR/GIR/putts |
| **Multiplayer** | Group rounds, room codes, live scoring |
| **Other** | Everything else |

### Adding Items to Canny

1. Weekly (every Monday), Ron reviews the queued feature requests from `#feedback`
2. For each item: check if a Canny post already exists (search before creating)
3. If new: create a Canny post with:
   - Clear title (action-oriented: "Allow comparing rounds against friends")
   - Description: original feedback + Ron's synthesis + use case
   - Category tag
4. If duplicate: upvote the existing post, add the new commenter's note to the existing post
5. Post the Canny link back in Discord to close the loop with the beta tester

### The 5-Upvote Social Contract

Every beta tester gets **5 upvotes** to allocate across open Canny feature requests. This is not unlimited — scarcity forces prioritization and surfaces genuine demand.

**Communicating this to beta testers:**
> "You have 5 upvotes to spend on Canny. Use them on the features you actually want most. Top-voted items get reviewed by the team each month for roadmap inclusion."

Announce this in `#announcements` at beta onboarding and in the welcome message.

### How Items Appear on the Public Board

- Canny board is publicly visible to beta community
- Status values used: `Open`, `Under Review`, `Planned`, `In Progress`, `Complete`, `Closed`
- Ron updates status when Brian approves an item (→ `Planned`) and when it ships (→ `Complete`)

---

## 3. Monthly Review Ritual

**When:** First Monday of each month, 60-minute session
**Who:** Brian (CEO) + Ron (Chief of Staff) + PM

### Inputs
- Top 10 Canny items by upvotes (export from Canny)
- Current V3/V4 roadmap status (from Paperclip)
- Previous month's shipped items

### PM Preparation (due the Friday before)

PM creates a 1-pager with:
1. Top 10 Canny items ranked by votes
2. For each: strategic alignment rating (High / Medium / Low / Out of Scope)
3. Estimated complexity (S/M/L, in collaboration with CTO if needed)
4. Recommendation: promote / defer / decline — with one-line rationale

### Meeting Flow

1. PM presents the 1-pager (15 min)
2. Brian + Ron discuss alignment vs. roadmap (30 min)
3. Brian approves 2–3 items for the next sprint cycle (15 min)
4. PM documents approved items

### Output

- Approved items: PM hands off to CTO to create Paperclip tickets
- Deferred items: remain on Canny, status unchanged
- Declined items: Ron updates Canny status to `Closed` with a brief reason

---

## 4. Feedback Loop Closure

When a Canny item ships:

1. **Discord:** Ron posts in `#announcements`:
   > "We shipped [Feature Name]! This was suggested by @[BetaTester] — thanks for the feedback. Here's how it works: [link to update]."

2. **Canny:** Ron updates the post status to `Complete` and adds a comment linking to the changelog or release note.

3. **Credit:** Always credit the beta tester who suggested the shipped feature. This is the virtuous loop: feedback → shipped → more engagement → more feedback.

---

## 5. Anti-Patterns to Avoid

| Anti-Pattern | Why It's Prohibited |
|---|---|
| Beta feedback enters active sprint without Brian approval | Bypasses roadmap governance |
| Ron promotes feedback directly to Paperclip tickets (non-bugs) | Skips community validation step |
| Feature ships because it got many votes | Vote count ≠ roadmap alignment |
| Bugs go to Canny for voting | Bugs are severity-driven, not demand-driven |
| PM creates tickets from Canny without Brian sign-off | PM's job is to recommend, Brian's job is to decide |
| Feature requests get immediate responses with "we'll build that" | Sets false expectations before approval |

---

## Quick Reference

```
Discord #feedback / #bug-reports
        ↓
  Ron triages (daily)
        ↓
  Bug/UX → Paperclip ticket (within SLA)
  Feature → Canny batch (weekly Monday)
        ↓
  Beta testers vote (5 upvotes each)
        ↓
  Monthly Review: PM 1-pager → Brian approves 2-3 items
        ↓
  PM → CTO: create Paperclip tickets for approved items
        ↓
  Build → Ship → Credit beta tester → Update Canny → Discord announcement
```

---

*Document maintained by PM. Last updated: March 2026.*
