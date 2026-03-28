import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser, type TestUser } from '../helpers/auth'
import { cleanupTestData } from '../helpers/supabase'

test.describe('Group Round — host + join + leaderboard sync', () => {
  let playerA: TestUser
  let playerB: TestUser

  test.beforeAll(async () => {
    playerA = await createTestUser('group-host')
    playerB = await createTestUser('group-guest')
  })

  test.afterAll(async () => {
    await cleanupTestData([playerA.id, playerB.id])
    await deleteTestUser(playerA.id)
    await deleteTestUser(playerB.id)
  })

  test('two players complete a group round with live leaderboard', async ({ browser }) => {
    // Create two isolated browser contexts (separate sessions)
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    // ── Player A: sign in ──────────────────────────────────────────────
    await pageA.goto('/')
    await pageA.getByRole('button', { name: /sign in/i }).click()
    await pageA.getByPlaceholder(/email/i).fill(playerA.email)
    await pageA.getByPlaceholder(/password/i).fill(playerA.password)
    await pageA.getByRole('button', { name: /sign in/i }).click()
    await expect(pageA.getByText(/golf caddy/i)).toBeVisible()

    // ── Player A: start group round ────────────────────────────────────
    await pageA.getByRole('link', { name: /group round/i }).click()
    await pageA.getByRole('link', { name: /host/i }).click()

    // Wait for room code to be generated
    const roomCodeEl = pageA.locator('[class*="tracking-widest"]').filter({ hasText: /^\d{4}$/ })
    await expect(roomCodeEl).toBeVisible({ timeout: 10_000 })
    const roomCode = (await roomCodeEl.textContent())!.trim()
    expect(roomCode).toMatch(/^\d{4}$/)

    // ── Player B: sign in ──────────────────────────────────────────────
    await pageB.goto('/')
    await pageB.getByRole('button', { name: /sign in/i }).click()
    await pageB.getByPlaceholder(/email/i).fill(playerB.email)
    await pageB.getByPlaceholder(/password/i).fill(playerB.password)
    await pageB.getByRole('button', { name: /sign in/i }).click()
    await expect(pageB.getByText(/golf caddy/i)).toBeVisible()

    // ── Player B: join via room code ───────────────────────────────────
    await pageB.getByRole('link', { name: /group round/i }).click()
    await pageB.getByRole('link', { name: /join/i }).click()

    // Enter 4-digit room code
    const codeInputs = pageB.locator('input[maxlength="1"]')
    for (let i = 0; i < 4; i++) {
      await codeInputs.nth(i).fill(roomCode[i])
    }
    await pageB.getByRole('button', { name: /next|join|submit/i }).click()

    // Enter display name
    await pageB.getByPlaceholder(/name/i).fill(playerB.displayName)
    await pageB.getByRole('button', { name: /join|next|submit/i }).click()

    // ── Verify both players appear in lobby ────────────────────────────
    // Player A should see Player B's name in the lobby
    await expect(pageA.getByText(playerB.displayName)).toBeVisible({ timeout: 10_000 })

    // Player B should see Player A's name (host) in the lobby
    await expect(pageB.getByText(playerA.displayName)).toBeVisible({ timeout: 10_000 })

    // Player count should show 2 players
    await expect(pageA.getByText(/2\/4/)).toBeVisible()

    // ── Player A: configure and start round ────────────────────────────
    // Move to setup phase
    await pageA.getByRole('button', { name: /set up course|next|continue/i }).click()

    // Enter course name (manual entry)
    const courseInput = pageA.getByPlaceholder(/course/i)
    if (await courseInput.isVisible()) {
      await courseInput.fill('Test Course')
    }

    // Start the round (skip side games for this test)
    await pageA.getByRole('button', { name: /start round|begin/i }).click()

    // ── Both players should navigate to /round ─────────────────────────
    await expect(pageA).toHaveURL(/\/round/, { timeout: 15_000 })
    await expect(pageB).toHaveURL(/\/round/, { timeout: 15_000 })

    // ── Player A: enter score on hole 1 ────────────────────────────────
    // Add strokes (tap the + button or shot button)
    const addShotA = pageA.getByRole('button', { name: /\+|add shot/i }).first()
    // Enter 4 strokes (par)
    for (let i = 0; i < 4; i++) {
      await addShotA.click()
    }

    // Move to next hole to trigger broadcast
    await pageA.getByRole('button', { name: /next hole|→|>/i }).click()

    // ── Verify Player B sees leaderboard update ────────────────────────
    // Switch to leaderboard tab on Player B's view
    await pageB.getByRole('tab', { name: /leaderboard/i }).click()

    // Player A's score should appear (E for even par on hole 1)
    await expect(
      pageB.getByText(playerA.displayName).locator('..').getByText(/E|0|\+0/)
    ).toBeVisible({ timeout: 10_000 })

    // ── Complete the round ──────────────────────────────────────────────
    // Navigate to summary for Player A
    // Fill remaining holes quickly by going through each one
    for (let hole = 2; hole <= 18; hole++) {
      for (let i = 0; i < 4; i++) {
        await addShotA.click()
      }
      if (hole < 18) {
        await pageA.getByRole('button', { name: /next hole|→|>/i }).click()
      }
    }

    // Complete round
    await pageA.getByRole('button', { name: /finish|complete|done/i }).click()

    // Verify summary page shows
    await expect(pageA.getByText(/summary|scorecard|final/i)).toBeVisible({ timeout: 10_000 })

    // Cleanup
    await ctxA.close()
    await ctxB.close()
  })
})
