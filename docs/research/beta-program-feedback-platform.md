# Golf Caddy Beta Program — Research Report
*Date: 2026-03-28*

## Executive Summary

For a 10–20 golfer beta cohort on a PWA, a **three-tool stack** covers all feedback needs at zero cost: **Tally** for post-round structured surveys, **Discord** for real-time community and quick bug reports, and **LogRocket** (free tier) for technical session replay and error monitoring. Add **Canny** (free tier) as a lightweight public roadmap so beta users can see what's coming and feel heard. Recruit via r/golf, local club networks, and the Golf Caddy social presence. Triage should sit with the PM (Ron), with a simple bug/UX/feature tagging convention flowing into Paperclip.

---

## Part 1: Feedback Platform Comparison

### 1.1 Canny — Public Roadmap + Feedback Voting

| Attribute | Detail |
|-----------|--------|
| **Free tier** | 25 tracked users (voters/commenters) — fits 10–20 beta users |
| **Paid** | $19/mo (annual) for 100 users; $99/mo month-to-month |
| **Setup effort** | Easy — embed widget or share a link, no code required |
| **PWA compatibility** | Good — web-based board works in any browser context |
| **Signal quality** | Strong for feature requests and roadmap votes; weak for bug reports |
| **Integrations** | Zapier, Segment, Intercom (free); Jira/Linear on Pro+ only |
| **Cost risk** | Canny changed billing model in May 2025 without grandfathering; pricing history is volatile |

**Best for:** Showing beta users the roadmap, collecting feature votes, changelog updates that build trust.

**Watch-out:** At 1,000 tracked users (post-launch growth), Core plan jumps to ~$275/mo. Lock in free tier now, re-evaluate before public launch.

---

### 1.2 Tally — Structured Survey Forms

| Attribute | Detail |
|-----------|--------|
| **Free tier** | Unlimited forms, unlimited responses — no caps |
| **Paid** | $29/mo Pro (team collaboration, custom domain) |
| **Setup effort** | Easy — share URL or embed in PWA |
| **PWA compatibility** | Good — web forms via link or iframe |
| **Signal quality** | Strong for structured post-round NPS, bug reports with required fields, onboarding surveys |
| **Integrations** | Webhook, Zapier, Make, Notion, Google Sheets, Airtable, Slack |
| **Cost risk** | None — free tier is genuinely unlimited |

**vs. Typeform:** Typeform caps free at 10 responses/month (unusable). Tally has no cap. Tally wins clearly.

**Best for:** Post-round "how did it go?" surveys, structured bug reporting form (device, OS, steps), and onboarding NPS.

**Suggested trigger:** Fire a Tally survey link inside the PWA after a round is completed (e.g., a toast/banner: "Got 2 minutes? Help us improve Golf Caddy →").

---

### 1.3 Discord — Community + Real-Time Bug Reports

| Attribute | Detail |
|-----------|--------|
| **Free tier** | Free — all server features are free |
| **Setup effort** | Easy to create; medium to maintain (moderation, structure) |
| **PWA compatibility** | N/A — Discord is the feedback channel, not installed in the PWA |
| **Signal quality** | Strong for qualitative, conversational bugs and real-time discussion; weak for structured data |
| **Integrations** | Zapier, bots can forward messages to Linear/Jira/Notion |
| **Cost risk** | Time cost (moderation); 2025 data breach (620M messages) is a privacy note |

**Recommended channel structure:**
- `#announcements` (team → users, no replies)
- `#bug-reports` (pinned template: device, OS version, steps)
- `#feature-ideas`
- `#general-feedback`
- `#round-replays` (optional: share interesting rounds)

**Best for:** Real-time community, quick back-and-forth bug clarification, building beta tester identity and loyalty.

**Limitation:** Duplicate reports need manual merging; no prioritization or deduplication. Always pair with a structured tool.

---

### 1.4 Hotjar / Contentsquare — Session Recording + Heatmaps

| Attribute | Detail |
|-----------|--------|
| **Free tier** | 200,000 sessions/month (overkill for beta) |
| **Setup effort** | Medium — JS snippet + SPA route configuration required |
| **PWA compatibility** | Good but requires SPA configuration (`hj('stateChange', url)` on route changes) |
| **Signal quality** | Strong for UX friction (rage clicks, dead zones on scorecard), scroll depth |
| **Status** | Hotjar merged into Contentsquare in July 2025 — pricing redirects there |
| **Cost risk** | Post-merger pricing uncertainty |

**Not recommended for initial beta** — with only 10–20 users, you don't have the volume to generate meaningful heatmaps. LogRocket covers the session replay use case with more technical depth. Revisit at public launch when you have volume.

---

### 1.5 LogRocket — Session Recording + Error Tracking

| Attribute | Detail |
|-----------|--------|
| **Free tier** | 1,000 sessions/month, 1-month retention, 3 seats |
| **Paid** | $69/mo Team (10,000 sessions, 5–10 seats) |
| **Setup effort** | Easy — NPM package + init call |
| **PWA compatibility** | Good — JavaScript SDK; SPA routing requires `LogRocket.startNewSession()` |
| **Signal quality** | Strong for JS errors with stack traces + session replay context, network request failures (Supabase sync!), Redux/Zustand state |
| **Integrations** | Linear, Jira, GitHub Issues, Sentry, Slack, Datadog, Segment |
| **Cost risk** | 3-seat free limit is tight if team > 3 reviewers |

**Key differentiator:** LogRocket captures *why* a bug happened (console logs, network calls, app state at error time). Hotjar captures *how* the user navigated. For a technical PWA with offline sync complexity, LogRocket is more valuable.

**Best for:** Catching Supabase sync failures, offline/online state bugs, and any errors users can't articulate ("it just didn't save my score").

---

### Platform Comparison Table

| Platform | Free Fit (10–20 users) | Setup | PWA Compat | Best Signal | Cost Risk |
|----------|------------------------|-------|------------|-------------|-----------|
| **Canny** | ✅ Fits (25 tracked users) | Easy | Good | Feature requests, roadmap | Volatile pricing history |
| **Tally** | ✅ Excellent (unlimited) | Easy | Good | Structured surveys, NPS | None |
| **Discord** | ✅ Excellent (free) | Easy/Medium | N/A | Qualitative, real-time | Time cost (moderation) |
| **Hotjar/CS** | ✅ Generous (200k sessions) | Medium | Good (SPA config) | UX heatmaps | Post-merger uncertainty |
| **LogRocket** | ✅ Fits (1k sessions, 3 seats) | Easy | Good | JS errors + session replay | 3-seat free limit |

---

## Part 2: Beta Tester Recruitment

### 2.1 Where to Find 10–20 Engaged Golfers

**Tier 1 — Highest quality signal (real golfers, motivated to improve)**

1. **r/golf and r/golfing** (Reddit) — Post in the weekly discussion or create a "looking for beta testers" post. Be transparent: show screenshots, explain it's a score tracking PWA, describe what you're asking of them. These communities are active and include serious amateur golfers.
2. **Local golf clubs / driving ranges** — Approach the pro shop or post on club message boards. "Looking for golfers to test a free score tracking app" is a credible ask. Offer to demo it in person.
3. **Golf Discord servers** — Servers like "Golf Community" and golf-focused hobby servers. Ask in `#tools` or `#apps` channels.
4. **Personal network first** — Start with 3–5 people you know personally who golf. They'll give more honest feedback, forgive rough edges, and help you find more testers via word-of-mouth.

**Tier 2 — Supplemental**

5. **Twitter/X golf community** (#golf, #golftwitter) — Golf Twitter is active. A tweet showing off the app with "DM me if you want early access" works well for tech-adjacent golfers.
6. **Golf app subreddits** (r/discgolf if relevant, r/GolfGPS) — Niche audiences likely to compare you to GHIN, GolfNow, etc.
7. **The Colony team itself** — Have team members play a few rounds. They'll catch things users won't report.

### 2.2 What Incentives Work

For 10–20 beta testers, **non-monetary incentives work well** and avoid "incentive hunters" who give low-quality feedback:

- **"Founding Beta" badge** — permanent visible label in their profile or on the app. Golfers are competitive; status markers work.
- **Early access to premium features** — commit to giving beta testers free access to whatever premium tier you launch. Even just promising this gets buy-in.
- **Direct line to the team** — being in the Discord with the actual founders/devs is genuinely appealing to enthusiasts.
- **Feature naming** — "You suggested this; it ships in v2" is memorable and builds loyalty.
- **What doesn't work at this scale:** Gift cards and cash payments attract low-quality respondents and create tax/admin overhead.

### 2.3 Beta Tester Onboarding Checklist

**Information to collect at signup:**
- Name + contact (Discord handle or email)
- Golf frequency (rounds/month)
- Phone type (iOS/Android) + browser (Safari/Chrome)
- Primary course(s) they play
- What score-tracking tools they currently use (GHIN, paper, another app)

**Expectation-setting (send this upfront, in writing):**
- "This is an early beta — you'll encounter bugs. That's expected."
- "We're asking for 1–2 rounds of feedback per month."
- "After each round, please complete a 5-minute survey (Tally link)."
- "Join our Discord — that's where we communicate and where bug reports go."
- Commit date for first major update based on their feedback (creates urgency and accountability)

---

## Part 3: Feedback → Ticket Pipeline

### 3.1 Triage Owner

**Recommend: PM (Ron) as primary triage.**

- Ron is closest to the product vision and best positioned to differentiate "nice to have" from "critical UX failure"
- The CEO (Brian) should not be in the triage loop — too much noise, and feedback decisions should sit with the PM
- Engineers should not triage directly — they'll fix the interesting bugs and defer the UX issues

### 3.2 Categorization Convention

Use three labels in Paperclip for all beta feedback tickets:
- `beta-bug` — reproducible defect (app crashed, score didn't save, sync failed)
- `beta-ux` — friction, confusion, or friction in the user journey (not a bug, but a pain point)
- `beta-feature` — new capability request (course not in database, need X stat)

**Triage SLA (suggested):**
- `beta-bug` → logged within 24 hours, priority set, assigned to engineer
- `beta-ux` → logged within 48 hours, batched into a weekly UX review
- `beta-feature` → logged to Canny for upvote tracking; reviewed monthly

### 3.3 Pipeline: Discord/Tally → Paperclip

**Recommended flow:**

```
User reports bug in Discord #bug-reports
    → Ron reviews (daily, 15-min slot)
    → Logs as Paperclip issue with label beta-bug/beta-ux/beta-feature
    → Links back to Discord thread for context
    → Tags LogRocket session replay URL in issue (if available)

User completes Tally post-round survey
    → Ron reviews weekly
    → Extracts actionable items into Paperclip
    → Dismisses noise / duplicates
```

**Preventing noise from derailing engineering:**
- Create a `beta-feedback` milestone/project in Paperclip — all beta issues go there first
- **No beta feedback issue enters the active sprint without Ron's explicit approval**
- Engineers are protected from the raw feed; they only see triaged, scoped issues
- Hold a weekly "Beta Review" (20 min max): Ron + 1 engineer. What ships from beta feedback this sprint? Keep it tight.

### 3.4 LogRocket Integration with Paperclip/Linear

LogRocket supports direct issue creation in Linear and GitHub Issues. When a session replay captures an error, LogRocket can auto-create an issue with:
- Session replay link
- Console log snippet
- Network request that failed

If the team is using Linear alongside Paperclip, configure the LogRocket → Linear integration so technical bugs surface automatically. Ron then moves validated issues into Paperclip.

---

## Part 4: Recommendation — Concrete Plan

### Recommended Stack

| Tool | Purpose | Cost | Time to Setup |
|------|---------|------|---------------|
| **Discord** | Beta community, real-time bugs | Free | 2 hours |
| **Tally** | Post-round structured survey | Free | 1 hour |
| **LogRocket** | Session replay + error tracking | Free (1k sessions/mo) | 2 hours |
| **Canny** | Public roadmap + feature votes | Free (25 tracked users) | 1 hour |

**Total cost: $0/month for entire beta phase.**

### First 30 Days — Suggested Timeline

**Week 1 — Setup**
- [ ] Create Discord server with 4-channel structure (see 1.3 above)
- [ ] Install LogRocket SDK in Golf Caddy PWA (SPA routing configuration included)
- [ ] Build Tally post-round survey (10 questions: NPS, 3 UX questions, open "what went wrong?", open "what was great?")
- [ ] Create Canny board — add the roadmap for the next 3 months
- [ ] Write beta tester onboarding doc (what we're building, what we need from you, how to report)

**Week 2 — Recruit**
- [ ] Post in r/golf and 1–2 local club channels
- [ ] Personal network: sign up 3–5 known golfers first
- [ ] DM 5 golf Twitter/Discord accounts who engage with golf tech
- [ ] Target: 10 testers confirmed by end of Week 2

**Week 3 — First Rounds**
- [ ] Beta testers play first round with Golf Caddy
- [ ] Post-round: Tally survey link sent in Discord `#announcements`
- [ ] Ron: daily 15-min Discord triage
- [ ] LogRocket: review error logs after first batch of sessions

**Week 4 — First Synthesis**
- [ ] Ron compiles feedback into a Beta Week 1 report (post in Paperclip)
- [ ] Top 3 bugs → assigned to engineering this sprint
- [ ] Top UX friction → design review
- [ ] Canny: post update to beta testers on what's being fixed
- [ ] Recruit 5–10 more testers if signal is strong; or go deeper with current cohort

### Key Success Metrics for Beta

- **Engagement:** % of beta testers who complete at least 2 rounds in the first 30 days (target: >70%)
- **Survey completion:** % who fill out the Tally survey after each round (target: >60%)
- **Bug yield:** # of actionable beta-bug issues logged in first 30 days (target: 10–20)
- **Retention signal:** % still active in Discord and playing in Week 4 (target: >50%)

---

## Caveats & Limitations

- **Canny pricing volatility:** Canny's billing history (multiple model changes in 2024–2025) is a real risk. The free tier works now, but re-evaluate before scaling. Alternatives: Featurebase (~$49/mo), Productboard (complex), or a simple Notion roadmap page.
- **LogRocket 3-seat limit:** Free tier limits to 3 users who can view session replays. If the team has 4+ people who need access, $69/mo for the Team plan or limit access to Ron + 1–2 engineers.
- **Discord moderation load:** Discord works well with a dedicated moderator (15 min/day). If no one owns it, feedback quality degrades quickly. Assign ownership explicitly.
- **Hotjar excluded for now:** With 10–20 users, heatmap data won't be statistically meaningful. Add Contentsquare/Hotjar at public launch (500+ active users) when volume justifies heatmap aggregation.
- **Tally webhook reliability:** Tally's webhook and Zapier integrations work well, but for automated Paperclip ticket creation from survey responses, test the pipeline before beta launch — don't assume it works.

---

## Sources
- [Canny Pricing 2026 | Featurebase](https://www.featurebase.app/blog/canny-pricing)
- [Canny Pricing Hidden Costs | FeatureOS](https://featureos.com/blog/canny-pricing-2026)
- [Tally Plans and Pricing](https://tally.so/pricing)
- [Typeform Pricing 2025 | Growform](https://www.growform.co/typeform-pricing/)
- [Hotjar/Contentsquare Pricing](https://contentsquare.com/pricing/)
- [Hotjar on Single Page Apps — Hotjar Documentation](https://help.hotjar.com/hc/en-us/articles/115011805428-Hotjar-on-Single-Page-Apps)
- [LogRocket Pricing](https://logrocket.com/pricing)
- [LogRocket Pricing Breakdown 2025 | LiveSession](https://livesession.io/blog/logrocket-pricing-breakdown-session-replay-costs-and-better-alternatives)
- [Discord Community Best Practices 2025](https://www.influencers-time.com/build-a-successful-discord-community-best-practices-2025/)
- [From Discord Chaos to Organized Feedback | BetaHub](https://betahub.io/blog/guides/2025/07/16/discord-community-feedback.html)
