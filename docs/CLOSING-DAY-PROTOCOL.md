# Closing Day Protocol — The Colony ELT
**Author:** Brian (board) + Ron  
**Date:** 2026-03-28  
**Cadence:** Daily SOP — triggered automatically by Release Engineer on final deploy of the day  
**Owner:** CEO (orchestrates), Ron (logs final memo)

---

## Purpose

The closing day protocol exists to ensure the ELT:
1. Holds the team accountable through daily performance reviews
2. Eats their own dog food — uses Golf Caddy before talking about it
3. Synthesizes the day's learnings before tomorrow's work begins
4. Grooms tomorrow's sprint with full context

This is not overhead. It is how a product-first company stays honest.

---

## Protocol Sequence

### Step 1: CEO Performance Reviews (CEO)

**Trigger:** Automatically fired by Release Engineer after final deploy of the day. The ELT plays the round on the latest build — not a previous one.  
**Owner:** CEO  
**Format:** One structured comment per agent on a daily review issue  

For each agent reviewed, CEO covers:
- **Output:** What did they ship/produce today? (link to tickets/artifacts)
- **Quality:** Did the work meet the acceptance criteria? Any shortcuts?
- **Blockers:** Did they escalate appropriately or spin their wheels?
- **Rating:** 🟢 Strong / 🟡 Solid / 🔴 Needs improvement
- **Note for tomorrow:** One specific thing to do better or build on

Agents reviewed: CTO, CMO, Product Manager, SE, SE2, QA Engineer, Release Engineer, Designer, Researcher, UAT agents, any others who ran today

---

### Step 2: ELT Golf Round — Eating Our Own Dog Food

**Participants:** CEO, CTO, CMO, Product Manager
**Format:** 9-hole simulated group round using the live Golf Caddy app
**Side games:** $2 skins, $5 Nassau (front 9 only — no back 9 or total in a 9-hole match)
**Proof standard:** All live interactive components must function for the round to count. If the app fails, it's a bug report.

**URL to use:** The ELT golf round runs on the **latest preview deploy URL** (the unique per-deploy URL posted by Release Engineer on the most recent deploy task), NOT the stable GA URL. This ensures ELT is testing what's new before it goes live to users.

**GA Promotion Gate:** After the ELT round completes and the round is bug-free (or all bugs are filed), the CEO signals the Release Engineer to promote the preview build to the stable GA URL: `golf-caddy-talon247s-projects.vercel.app`. If bugs are found, they must be fixed and re-deployed to preview before GA promotion.

#### Setup
Each ELT member runs as a separate browser context (Playwright) simulating a distinct player:
- **CEO** = Player 1 (host — creates the room)
- **CTO** = Player 2
- **CMO** = Player 3
- **Product Manager** = Player 4

They join via the share link (One Link Golf). They log scores hole by hole. They run the Nassau and skins in real time.

#### 9-Hole Course Setup
- Course: "ELT Proving Ground" (fictional — use pars: 4,3,5,4,4,3,5,4,4 = par 36)
- 9 holes, blue tees
- Side games: Skins $2/hole, Nassau front $5

#### ELT Handicap Strokes (simulated — use these fixed differentials)
- CEO: scratch (0 handicap)
- CTO: +2 (plays to a 2 — CTO knows the architecture but is rusty on the course)
- CMO: +5 (plays to a 5)
- PM: +8 (plays to an 8)

#### Scoring simulation
Each ELT member simulates realistic scores for a player of their handicap. Scores must be entered into the live app — not just logged manually. The app must show the live leaderboard updating hole by hole.

#### Pass/Fail criteria for the round
- ✅ All 4 players join via share link successfully
- ✅ Live leaderboard updates after each hole's score is entered
- ✅ Side game standings (skins won, Nassau up/down) visible during round
- ✅ Round completes and settlement screen shows correct payouts
- ❌ Any of the above fails → bug report filed immediately, round still completes manually

#### Running ELT Tally
CEO maintains a running tally in: `docs/elt/elt-wager-tally.md`
- Columns: Date | CEO | CTO | CMO | PM | Skins pot | Nassau winner | Net result per player
- Updated after every ELT session
- This is the permanent record of who owes who

---

### Step 3: Individual Post Mortems

**Order:** PM → CMO → CTO → CEO (ascending seniority, CEO synthesizes last)  
**Format:** Each ELT member posts a written post mortem as a comment on the daily ELT issue

**Post mortem template:**
```
## [Role] Post Mortem — [Date]

### What I did today
- [List of tickets completed, artifacts produced]

### What I learned
- [Technical insights, product insights, process observations]

### Where I stumbled
- [Honest account of what didn't go well or took longer than expected]

### Resolution steps
- [What I'll do differently tomorrow / what needs to be fixed / what I need from others]

### One thing the product needs
- [One observation from using the product today that the team should hear]
```

---

### Step 4: CEO Daily Memo

**Owner:** CEO  
**Save to:** `docs/elt/daily-memo-YYYY-MM-DD.md`  
**Copy to:** Post as a comment on the daily ELT issue AND message Ron in Discord (#ron)

**Memo structure:**
```
# ELT Daily Memo — [Date]
Prepared by: CEO

## Golf Round Results
[Summary of ELT round — scores, skins won, Nassau outcome, settlement]
[Any bugs found during the round]

## Team Performance Summary
[3-5 sentences synthesizing the performance reviews — what the team did well, what needs attention]

## Day's Key Learnings
[Top 3 insights from the post mortems — themes, patterns, surprises]

## Tomorrow's Priorities
[What the ELT has agreed are the highest-priority items for tomorrow]
[Any blocked items or decisions needed from Brian]

## Groomed Sprint Backlog
[Confirmation that all tomorrow's issues are groomed, assigned, and ready to execute]

## Open Questions for Brian
[Anything requiring board input — decisions, approvals, priorities]
```

---

### Step 5: Sprint Grooming

**Owner:** CTO facilitates, all ELT participates  
**Format:** Each ELT member reviews their assigned open issues and confirms:

For each issue:
- **Title:** Clear and accurate?
- **Description:** Complete acceptance criteria?
- **Priority:** Correct?
- **Assignee:** Right person/agent?
- **Dependencies:** Any blockers to flag?
- **Estimate:** Rough size (S/M/L)?

Any issue that is not groomed does not go into tomorrow's sprint. Better to start with fewer well-defined tickets than a full backlog of ambiguity.

CTO posts a grooming summary comment on the daily ELT issue listing all tomorrow's sprint tickets, confirmed and ready.

---

---

### Step 5.5: Org Health Check (CEO)

Before the meeting closes, CEO poses and answers the following question to the ELT:

> **"Does our current org structure, headcount, and role definitions optimally serve our goals — and what, if anything, should change?"**

This is not a rubber stamp. CEO should actively consider:
- **Restructuring:** Is any agent in the wrong role? Is any reporting line creating a bottleneck?
- **New hires:** Is there a gap that is slowing us down — a capability we're missing or a role that's overloaded?
- **Terminations:** Is any agent consistently underperforming, redundant, or misaligned with where the company is going?
- **Role evolution:** Has the product or company stage changed enough that any role description needs updating?

**Format:** CEO posts a comment on the daily ELT issue titled "Org Health Check" with their assessment. If no changes are needed, a single line is fine: "Org is healthy — no changes recommended today."

If a change is recommended, CEO creates the appropriate Paperclip issue:
- New hire: spec ticket assigned to CEO
- Termination: performance review + exit brief ticket assigned to CEO
- Restructuring: role update ticket assigned to Ron for board approval

**This happens every session.** Small orgs rot when no one asks the uncomfortable question.

---

## The Daily ELT Issue

CEO creates a new Paperclip issue each day titled:  
`ELT Daily: [Date] — Performance Reviews + Golf Round + Grooming`

All protocol activity is documented as comments on this issue. At end of protocol, issue is marked done.

---

## ELT Wager Tracking

Running tally: `docs/elt/elt-wager-tally.md`

Format:
| Date | CEO net | CTO net | CMO net | PM net | Bugs found | Notes |
|---|---|---|---|---|---|---|
| 2026-03-29 | TBD | TBD | TBD | TBD | 0 | First ELT round |

Running totals updated after each session. When The Colony becomes The Corporation and profit sharing is formalized, the ELT wager tally becomes the basis for inter-executive account settlement. 🏌️
