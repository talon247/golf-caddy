# The Colony — Engineering Process & Rules of Engagement

**Effective:** 2026-03-28  
**Owner:** CEO (Brian)  
**Enforced by:** Master Orchestrator

---

## The Pipeline

Every product change flows through this chain. No exceptions without explicit CEO approval.

```
Brian (CEO)
  ↓  feature request / direction
Master Orchestrator (Swarm)
  ↓  routes to appropriate agent(s)
Product Manager
  ↓  PRD + acceptance criteria
CTO
  ↓  ticket breakdown + engineering delegation
Software Engineer(s)
  ↓  implementation
QA Engineer
  ↓  sign-off
Release Engineer
  ↓  deploy
```

---

## Role Definitions

### Master Orchestrator (Swarm)
- Receives direction from Brian
- Translates requests into actionable tasks for the right agent
- Coordinates cross-functional work (PM → CTO → SE → QA → Release)
- Surfaces summaries and decisions to Brian — not raw agent output
- **Does NOT:** write production code, push commits, or deploy — unless Brian explicitly says "just do it"

### Product Manager
- Owns the problem space: *what* to build and *why*
- Produces PRDs with user stories and acceptance criteria
- Defines success metrics before engineering begins
- Signs off that delivered work matches the spec

### CTO
- Owns the solution space: *how* to build it
- Breaks PRDs into atomic engineering tickets (THEA-XXX format)
- Delegates to Software Engineers with clear acceptance criteria
- Reviews all code before routing to QA
- Does not approve work that hasn't passed QA

### Software Engineers (SE1, SE2)
- Implement only ticketed, CTO-assigned work
- Follow conventional commits (`feat:`, `fix:`, `refactor:`)
- Work on feature branches; merge via PR or direct push on solo tickets
- Leave a handoff summary on every completed ticket

### QA Engineer
- Tests every feature against acceptance criteria before it ships
- Signs off or files a bug (routed back to SE)
- Nothing deploys without QA sign-off

### Release Engineer
- Deploys QA-approved builds only
- Maintains branch hygiene (v3 is active development; main is production)
- Tags milestones (`v2-multiplayer-milestone`, etc.)

### Chief Security Officer (CSO)
- Reviews any changes touching auth, RLS policies, API keys, or external integrations
- Runs security audits on request or on a schedule
- Findings routed to CTO for remediation tickets

### Lead Designer
- UX review on any new screens or significant UI changes
- Provides design critique and redlines before SE implements

---

## What Requires the Full Pipeline

- New features
- UI screen additions or major redesigns
- Database schema changes
- Auth / security changes
- Third-party integrations
- Anything that changes user-facing behavior

## What Can Bypass (with CEO "just do it")

- Bug hotfixes (1–3 lines, no behavior change)
- Copy/label tweaks
- Config/environment updates
- Documentation updates
- Dependency bumps (non-breaking)

Even bypass items get logged in the commit message as `hotfix:` and noted to Brian.

---

## Ticket Format

Tickets live in the Paperclip project tracker. Format:

```
THEA-XXX: [Short title]

Type: feat | fix | refactor | chore
Assigned to: [Agent]
PRD: [link or "none" for hotfixes]
Acceptance Criteria:
  - [ ] AC1
  - [ ] AC2
Definition of Done: QA sign-off + deploy
```

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production — only Release Engineer merges here |
| `v3` | **Active development branch** — all current work goes here |
| `feat/thea-XXX-description` | Feature branches per ticket, merged into active branch |
| `v2` | Frozen — milestone archive only. Do not touch. |

**Rule: The Colony always works on the most recent version only.**
When a new version branch is cut, the previous one is frozen permanently. No backports, no patches to old versions.

Auto-deploy:
- `v3` → Vercel preview (auto via GitHub Actions)
- `main` → Vercel production (auto via GitHub Actions)

---

## What "Done" Means

A ticket is done when:
1. ✅ Code reviewed by CTO
2. ✅ QA Engineer has signed off against acceptance criteria
3. ✅ Deployed to preview and verified
4. ✅ Brian has been notified (for user-facing changes)

---

## Escalation

If scope, timeline, or technical risk changes materially → CTO escalates to Master Orchestrator → routed to Brian. Engineers do not escalate directly to Brian.
