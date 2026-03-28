# Golf Caddy V3 — Pre-Beta Security Audit

**Auditor:** CSO (agent e7f756db-ea2f-445b-89fc-d1606de4e6ca)
**Date:** 2026-03-28
**Scope:** Full pre-beta security review per THEA-227
**Status:** Findings only — no changes made. All items below require Brian's explicit approval.

---

## Executive Summary

Golf Caddy V3 has a **solid security foundation** for solo round tracking: RLS is enabled on all tables, personal data (rounds, holes, shots, clubs, courses, profiles) is correctly scoped to `auth.uid() = user_id`, and no service role keys are exposed in client code. The primary risk surface is the **group rounds / multiplayer subsystem**, which intentionally uses open/anonymous RLS as an MVP shortcut and needs hardening before public beta. Two additional issues — a privacy leak in `send_friend_request` and unauthenticated username enumeration via `check_username_available` — should be fixed before real users are onboarded.

---

## Findings

---

### [HIGH] Group Rounds / Side Games Use Fully Open RLS

**Severity:** High
**Category:** Infrastructure / Database
**Affected tables:** `group_rounds`, `group_round_players`, `side_game_configs`, `side_game_results`
**Migration refs:** `20260327000002_group_rounds.sql`, `20260328000006_side_game_tables.sql`

**Description:**
All four tables have `USING (true)` / `WITH CHECK (true)` policies, making them readable and writable by any unauthenticated client. This was an explicit MVP choice (comment: _"allow public read/insert/update (no auth required for group rounds)"_) pending addition of a `host_user_id` column to `group_rounds`.

Concrete abuse scenarios:
- Any unauthenticated user can enumerate all active room codes (only 10,000 possible 4-digit values)
- Any unauthenticated user can join any waiting room without being invited
- Any unauthenticated user can insert bogus `side_game_results` rows (declare themselves the winner, set `amount_owed` to any value)
- Any unauthenticated user can update a `group_round` row's status (e.g., mark a live round as `completed`)
- No DELETE policy on `side_game_results` — rows can only be created, not retracted by users
- No UPDATE policy on `side_game_results` — once inserted, results are immutable (minor positive)

**Recommendation:**
1. Add `host_user_id uuid REFERENCES auth.users(id)` to `group_rounds`
2. Tighten RLS: host can update/delete their own round; authenticated players can insert into `group_round_players`; restrict `side_game_configs` write to host; restrict `side_game_results` write to authenticated players in that round
3. As an interim measure before the full auth migration: add server-side validation in RPCs for the most sensitive mutations (e.g., validate caller is a known player in the round before allowing result insertion)

**Status:** Recommendation only — no changes made.

---

### [HIGH] `send_friend_request` Leaks Privacy Setting — Code/Comment Mismatch

**Severity:** High
**Category:** Backend / Privacy
**Location:** `supabase/migrations/20260328000003_friends_presence.sql`, lines 157–161

**Description:**
The migration comment at line 159 says _"Return user_not_found to avoid leaking the setting"_, but the code actually returns `'requests_disabled'`:

```sql
-- Privacy: addressee has disabled friend requests
IF NOT v_addressee.friend_requests_open THEN
  -- Return user_not_found to avoid leaking the setting
  RETURN jsonb_build_object('success', false, 'error', 'requests_disabled');
END IF;
```

This is a bug: the intended behavior (mask existence) was documented but not implemented. The actual behavior reveals:
1. The target username exists in the system
2. That user has specifically disabled friend requests

A malicious actor could use this to confirm the existence of specific users (e.g., confirm a celebrity or private user's account is on the platform).

**Recommendation:**
Change the return value to `'error': 'user_not_found'` to match the documented intent. The client should treat both cases identically in the UI ("User not found or not accepting requests").

**Status:** Recommendation only — no changes made.

---

### [MEDIUM] `check_username_available` Enables Unauthenticated Username Enumeration

**Severity:** Medium
**Category:** Backend / Privacy
**Location:** `supabase/migrations/20260328000003_friends_presence.sql`, function `check_username_available()`

**Description:**
`check_username_available()` is `SECURITY DEFINER` and intentionally callable by anonymous (unauthenticated) users to support pre-signup username checking. While this is a common UX pattern, it enables systematic username enumeration with no authentication barrier, no rate limiting in the database layer, and no minimum query constraints.

An attacker could call this function in a loop to:
- Confirm whether any specific username exists
- Enumerate the username space to harvest the user list

**Recommendation:**
1. Add Supabase rate limiting on this RPC endpoint (Supabase supports per-route rate limiting in the API gateway)
2. Consider restricting to authenticated users only — the UX tradeoff is minor since most signups can check availability post-login
3. If anonymous access must remain, implement throttling in the calling client and log high-frequency callers at the Supabase level

**Status:** Recommendation only — no changes made.

---

### [MEDIUM] Room Code Brute-Force Risk (4-Digit Space)

**Severity:** Medium
**Category:** Infrastructure
**Location:** `supabase/migrations/20260327000002_group_rounds.sql`

**Description:**
Room codes are 4-digit strings (0000–9999), providing only 10,000 possible values. Combined with the fully open `group_rounds` SELECT policy, any unauthenticated client can enumerate all active rooms in seconds with a trivial script. This allows:
- Uninvited join attempts against any active lobby
- Presence surveillance (knowing when groups are actively playing)

**Recommendation:**
1. Increase room code entropy (e.g., 6-character alphanumeric = 36^6 ≈ 2.2 billion combinations)
2. Add rate limiting on `join_group_round` RPC (e.g., 10 attempts per IP per minute)
3. The long-term fix is auth-gating the group_rounds table (see HIGH finding above)

**Status:** Recommendation only — no changes made.

---

### [MEDIUM] `search_users` Allows Single-Character Queries — Full User Enumeration

**Severity:** Medium
**Category:** Backend / Privacy
**Location:** `supabase/migrations/20260328000003_friends_presence.sql`, function `search_users()`

**Description:**
The `search_users()` RPC accepts any query including a single character and returns up to 20 matching users:

```sql
WHERE p.username ILIKE p_query || '%'
   OR p.display_name ILIKE '%' || p_query || '%'
```

An authenticated attacker can enumerate the full user list by iterating through the character space. With LIMIT 20 per call and a character-by-character descent (trie-style), the entire username corpus could be extracted in O(n) calls.

**Recommendation:**
1. Enforce a minimum query length of 3 characters
2. Add rate limiting on this RPC
3. Consider whether display_name should be searchable at all (username prefix search is sufficient)

**Status:** Recommendation only — no changes made.

---

### [LOW] `profiles` Table Only Exposes Own Row via RLS — Friends' Data Accessible Only via SECURITY DEFINER RPCs

**Severity:** Low (informational — current design is correct, noting for awareness)
**Category:** Infrastructure
**Location:** `supabase/migrations/20260327000001_initial_schema.sql`

**Description:**
The `profiles` table has:
```sql
create policy "profiles_select_own"
  on public.profiles for select using (auth.uid() = id);
```

Users cannot directly `SELECT` other users' profiles. Friend profile data (`display_name`, `username`, `handicap_index`) is returned only via `SECURITY DEFINER` RPCs (`get_friends`, `search_users`). This is **correct architecture** — friend data is mediated by business-logic-aware functions.

However, `get_friends()` returns `handicap_index` for all accepted friends. Users may not expect their handicap to be visible to all friends. Consider adding a `handicap_visible` privacy flag similar to `presence_visible`.

**Status:** Informational — no action required immediately.

---

### [LOW] Session Tokens Stored in localStorage

**Severity:** Low
**Category:** Frontend / Auth
**Location:** `src/lib/supabase.ts`

**Description:**
The Supabase client is configured with `persistSession: true`, which causes JWT tokens to be stored in `localStorage`. This is standard Supabase behavior and acceptable for a non-enterprise app. However, it means any XSS vulnerability would result in session token theft.

The app currently has no Content Security Policy (CSP) configured, which is a prerequisite for meaningful XSS mitigation.

**Recommendation:**
1. Add a Content Security Policy header (can be done in `vercel.json` headers)
2. Restrict script sources to `'self'` and whitelisted CDNs
3. The localStorage choice is acceptable for this app tier; cookie-based sessions would provide `HttpOnly` protection but require server-side infrastructure

**Status:** Recommendation only — no changes made.

---

### [LOW] Password Reset `redirectTo` Uses `window.location.origin`

**Severity:** Low
**Category:** Auth
**Location:** `src/lib/auth.ts`, line 36

**Description:**
```typescript
redirectTo: window.location.origin + '/reset-password',
```

`window.location.origin` is determined at call time in the browser, which means the redirect URL is whatever origin the user is currently on. This is correct behavior for a SPA and same-origin enforcement is handled by the browser. Supabase also validates redirect URLs against the allowlist configured in the Supabase dashboard.

**Recommendation:** Verify that the Supabase project's "Redirect URLs" allowlist is correctly restricted to production and preview domains only (not wildcards).

**Status:** Informational — verify Supabase dashboard allowlist.

---

### [LOW] `VERCEL_OIDC_TOKEN` in `.env.local` — Correctly Git-Ignored

**Severity:** Low (informational)
**Category:** Secrets
**Location:** `.env.local`

**Description:**
`.env.local` contains a `VERCEL_OIDC_TOKEN` (a short-lived JWT, ~12hr expiry, generated by Vercel CLI for local development). This file is **correctly excluded** from version control via `.gitignore` (`*.local` rule). The token would be expired within hours of generation.

No action required, but noting it was observed in local environment.

**Status:** Informational — no action required.

---

### [LOW] No Service Role Key Exposure Found

**Severity:** Low (positive finding)
**Category:** Secrets

**Description:**
No service role key was found in any client-side code, `.env.example`, or committed files. The `.gitignore` includes `supabase/.env` explicitly. The `src/lib/supabase.ts` client is initialized with `VITE_SUPABASE_ANON_KEY` only, which is the correct pattern.

**Status:** No action required — good hygiene confirmed.

---

### [INFO] No CSP Headers Configured

**Severity:** Informational
**Category:** Frontend

**Description:**
No `vercel.json` was found with security headers. Before public beta, recommend adding:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

These can be added to `vercel.json` without changing any application code.

**Status:** Recommendation only — no changes made.

---

### [INFO] No Rate Limiting on RPCs

**Severity:** Informational
**Category:** Infrastructure

**Description:**
None of the Supabase RPC functions implement internal rate limiting. Supabase's built-in API rate limiting applies globally but not per-function. Functions of concern:
- `check_username_available` (unauthenticated enumeration)
- `search_users` (user enumeration)
- `join_group_round` (room code brute force)
- `send_friend_request` (spam/harassment)

**Recommendation:** Configure Supabase project-level rate limits, or add lightweight per-caller throttle tables.

**Status:** Informational.

---

## Summary Table

| # | Finding | Severity | Status | Ticket |
|---|---------|----------|--------|--------|
| 1 | Group rounds / side games: fully open RLS | **High** | Not fixed | File ticket |
| 2 | `send_friend_request` leaks `requests_disabled` error | **High** | Not fixed | File ticket |
| 3 | `check_username_available` unauthenticated enumeration | Medium | Not fixed | — |
| 4 | Room code brute-force (4-digit space) | Medium | Not fixed | — |
| 5 | `search_users` single-char queries allow full enumeration | Medium | Not fixed | — |
| 6 | Friend handicap visibility (privacy, no RLS issue) | Low | Informational | — |
| 7 | Session tokens in localStorage (standard, no CSP) | Low | Informational | — |
| 8 | Password reset redirectTo (verify Supabase allowlist) | Low | Informational | — |
| 9 | `VERCEL_OIDC_TOKEN` in `.env.local` (git-ignored, expired) | Low | OK | — |
| 10 | No service role key exposure | — | ✅ Confirmed safe | — |
| 11 | No CSP headers | Info | Recommend before beta | — |
| 12 | No RPC rate limiting | Info | Recommend before beta | — |

---

## Recommendation Priority

**Must fix before any real users:**
- [ ] #2: `send_friend_request` privacy leak (one-line fix)

**Fix before public beta:**
- [ ] #1: Group rounds open RLS (requires schema migration adding `host_user_id`)
- [ ] #3: Rate-limit or auth-gate `check_username_available`
- [ ] #4: Increase room code entropy / rate-limit join attempts
- [ ] #5: Enforce 3-char minimum on `search_users`
- [ ] #11: Add security headers in `vercel.json`

**Plan within 30 days of beta:**
- [ ] #7: CSP policy
- [ ] #12: Per-function rate limiting

---

*No changes have been made to any file, database, or configuration. All items above are recommendations pending Brian's explicit approval.*
