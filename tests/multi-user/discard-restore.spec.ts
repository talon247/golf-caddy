import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser, type TestUser } from '../helpers/auth'
import { cleanupTestData } from '../helpers/supabase'

test.describe('Discard / Restore — abandon mid-round, sign out/in, restore banner', () => {
  let playerA: TestUser

  test.beforeAll(async () => {
    playerA = await createTestUser('discard-a')
  })

  test.afterAll(async () => {
    await cleanupTestData([playerA.id])
    await deleteTestUser(playerA.id)
  })

  test('abandon group round, sign out, sign back in, see restore banner, discard', async ({
    browser,
  }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    // ── Sign in ────────────────────────────────────────────────────────
    await page.goto('/')
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.getByPlaceholder(/email/i).fill(playerA.email)
    await page.getByPlaceholder(/password/i).fill(playerA.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/golf caddy/i)).toBeVisible()

    // ── Start a group round (host) ─────────────────────────────────────
    await page.getByRole('link', { name: /group round/i }).click()
    await page.getByRole('link', { name: /host/i }).click()

    // Wait for room code
    const roomCodeEl = page.locator('[class*="tracking-widest"]').filter({ hasText: /^\d{4}$/ })
    await expect(roomCodeEl).toBeVisible({ timeout: 10_000 })

    // Move to setup and start round (solo host)
    await page.getByRole('button', { name: /set up course|next|continue/i }).click()

    const courseInput = page.getByPlaceholder(/course/i)
    if (await courseInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await courseInput.fill('Discard Test Course')
    }

    // Skip side games, start round
    await page.getByRole('button', { name: /start round|begin|skip/i }).click()
    await expect(page).toHaveURL(/\/round/, { timeout: 15_000 })

    // ── Enter scores on a few holes (mid-round) ────────────────────────
    const addShot = page.getByRole('button', { name: /\+|add shot/i }).first()
    // Hole 1: 4 strokes
    for (let i = 0; i < 4; i++) {
      await addShot.click()
    }
    await page.getByRole('button', { name: /next hole|→|>/i }).click()

    // Hole 2: 5 strokes
    for (let i = 0; i < 5; i++) {
      await addShot.click()
    }
    await page.getByRole('button', { name: /next hole|→|>/i }).click()

    // ── Abandon mid-round: navigate away ───────────────────────────────
    // Go back to home without completing
    await page.goto('/')

    // Verify restore banner appears (round is in progress)
    await expect(
      page.getByText(/in-progress round/i).or(page.getByText(/resume round/i))
    ).toBeVisible({ timeout: 5_000 })

    // ── Sign out ───────────────────────────────────────────────────────
    // Navigate to profile to find sign out button
    await page.goto('/profile')
    await page.getByRole('button', { name: /sign out|log out/i }).click()

    // Confirm sign out if modal appears
    const confirmSignOut = page.getByRole('button', { name: /confirm|yes|sign out/i })
    if (await confirmSignOut.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmSignOut.click()
    }

    // Verify signed out (should see sign in button)
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 5_000 })

    // ── Sign back in ───────────────────────────────────────────────────
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.getByPlaceholder(/email/i).fill(playerA.email)
    await page.getByPlaceholder(/password/i).fill(playerA.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/golf caddy/i)).toBeVisible()

    // ── Verify restore banner reappears ────────────────────────────────
    // The in-progress round should be restored from Supabase / localStorage
    await expect(
      page.getByText(/in-progress round/i).or(page.getByText(/resume round/i))
    ).toBeVisible({ timeout: 15_000 })

    // ── Discard the round ──────────────────────────────────────────────
    await page.getByRole('button', { name: /discard/i }).click()

    // Confirm discard
    const confirmDiscard = page.getByRole('button', { name: /yes, discard/i })
    await expect(confirmDiscard).toBeVisible({ timeout: 3_000 })
    await confirmDiscard.click()

    // ── Verify banner does not reappear ────────────────────────────────
    // Wait a moment for state to settle
    await page.waitForTimeout(2_000)

    // Reload to be sure
    await page.reload()
    await expect(page.getByText(/golf caddy/i)).toBeVisible()

    // The restore banner should NOT be present anymore
    await expect(
      page.getByText(/in-progress round/i)
    ).not.toBeVisible({ timeout: 5_000 })

    await expect(
      page.getByText(/resume round/i)
    ).not.toBeVisible({ timeout: 3_000 })

    // Cleanup
    await ctx.close()
  })
})
