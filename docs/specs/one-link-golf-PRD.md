# PRD: One Link Golf — Zero-Friction Guest Join via URL

**Author:** Ron (board)  
**Date:** 2026-03-28  
**Priority:** P0 — viral growth feature  
**Status:** Approved for engineering scoping

---

## Problem

Every group golf app has the same friction problem: getting 4 people into a live scorecard requires everyone to have the app installed, an account created, and a friend connection established. That's a 5+ step barrier for every new player in every group.

The result: groups default to the Notes app or a paper card. The host downloads the app. Nobody else bothers.

**The real cost:** Every group round that doesn't use Golf Caddy is a lost viral moment. The host is the growth flywheel — but only if inviting is frictionless.

---

## Solution: One Link Golf

When a host starts a group round, they get a **single share link** (and QR code). Anyone who taps the link — on any device, in any browser — can join the live scorecard **immediately**. No download. No account. No signup wall.

Registered Golf Caddy users see their full profile and stats integrated. Guests get a named slot with real-time scoring. After the round, every guest receives a personalized round recap with a one-tap signup prompt.

---

## User Stories

**As a host:**
- I start a group round and immediately get a share link + QR code
- I can share it via iMessage, AirDrop, WhatsApp, or just show the QR on my phone
- The round starts as soon as I want — I don't wait for everyone to install an app

**As a guest (no app):**
- I tap a link or scan a QR code
- I type my name (one field, done)
- I'm in the live scorecard in under 10 seconds
- I see the leaderboard, my score, and the side game standings in real time
- After the round ends, I see my full scorecard and get a prompt to save it by signing up

**As a guest (has Golf Caddy account):**
- I tap the link, log in, and join — my round is attributed to my account and stats
- My handicap and profile appear on the leaderboard automatically

---

## Core Requirements

### Join Flow
- Host generates join link on Group Round setup screen
- Link format: `golf-caddy.app/join/[roomCode]` (or similar — short, clean, shareable)
- QR code displayed prominently — one tap to copy or share
- Guest lands on a minimal page: app logo, round info (course, hole count), name entry field, "Join Round" button
- **Zero friction:** name entry is the ONLY required input for guests
- Guest session persists for the duration of the round (localStorage token tied to roomCode)

### Guest Experience
- Full live scorecard: all players, current hole, scores vs par
- Guest can enter their own scores (same club tap UI or simplified tap-a-number)
- Leaderboard updates in real time (Supabase realtime — already built)
- Side game standings visible (skins won, Nassau up/down)
- **No paywall, no upsell during the round** — zero friction until the round ends

### Post-Round Conversion
- Round ends → guest sees their full scorecard + summary stats
- Prominent but non-pushy prompt: "Save your round — create a free account"
- One-tap signup via Apple/Google (reduces friction to near-zero)
- If guest signs up: round is migrated to their account (existing guest migration flow)
- If guest doesn't sign up: they still saw the value. Seed is planted.

### Reliability Requirements (Brian's explicit requirement: "work every time")
- Link must work on: Safari iOS, Chrome Android, Chrome desktop, Safari desktop
- Guest join must survive: page refresh, backgrounding the app, switching between apps mid-round
- If Supabase realtime drops: offline indicator + local score buffering (existing offline sync)
- Room codes don't expire until the round ends + 24h buffer
- **Never show a broken state to a guest** — always show something useful

### Host Controls
- Host can see all guests in the lobby before starting
- Host can remove a guest (prevents abuse)
- Optional: host can require Golf Caddy account to join (for serious competitive rounds)

---

## What We're NOT Building (v1)
- GPS distances for guests (app-only feature)
- Guest analytics or handicap tracking (requires account)
- Spectator mode (read-only, separate PRD)
- SMS/push invites (share link is sufficient)
- Persistent guest history without signup

---

## Technical Notes

- **Realtime:** Supabase realtime already powers group rounds — guest join is additive, not a rewrite
- **Guest session:** Use existing guest user pattern — assign a temp UUID on join, store in localStorage
- **Guest migration:** Existing flow already handles this (THEA-144 implemented)
- **PWA:** Guest landing page works as a PWA installable moment — "Add to Home Screen" prompt after joining is a low-friction install vector
- **Room codes:** Already exist (4-digit). The join URL just wraps the existing room code flow
- **QR code:** Generate client-side via `qrcode` npm package — no backend needed

---

## Success Metrics
- % of group rounds that have at least one guest joiner
- Guest → signed-up account conversion rate (target: >20%)
- Time from link share to guest in scorecard (target: <15 seconds)
- Zero reports of "link didn't work" in beta

---

## Priority Rationale

This is the viral loop. Every group round becomes a demo. Every guest is a lead. The host is the distribution channel. This feature turns Golf Caddy's existing group round infrastructure into a growth engine with zero additional ad spend.

The PWA architecture makes this uniquely achievable without App Store friction. No competitor has a clean version of this. It needs to ship and work perfectly.
