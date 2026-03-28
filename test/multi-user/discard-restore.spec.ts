import { test, expect } from '@playwright/test'
import {
  signUpTestUser,
  signInTestUser,
  signOutTestUser,
  cleanUpTestUser,
  type TestUser,
} from '../helpers/auth'

test.describe('Discard / Restore — abandon mid-round, sign out/in, restore banner', () => {
  let playerA: TestUser

  test.beforeAll(async () => {
    playerA = await signUpTestUser()
  })

  test.afterAll(async () => {
    await cleanUpTestUser(playerA)
  })

  test('abandon round, sign out, sign back in, restore banner, discard', async ({
    browser,
    baseURL,
  }) => {
    const appUrl = baseURL!
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    // ── Sign in ────────────────────────────────────────────────────────
    await signInTestUser(page, playerA, appUrl)
    await expect(page.getByText(/golf caddy/i)).toBeVisible()

    // ── Start a group round (host, solo) ───────────────────────────────
    await page.getByRole('link', { name: /group round/i }).click()
    await page.getByRole('link', { name: /host/i }).click()

    const roomCodeEl = page
      .locator('[class*="tracking-widest"]')
      .filter({ hasText: /^\d{4}$/ })
    await expect(roomCodeEl).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /set up course|next|continue/i }).click()

    const courseInput = page.getByPlaceholder(/course/i)
    if (await courseInput.isVisible()) {
      await courseInput.fill('Discard Test Course')
    }

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

    // ── Abandon: navigate away ─────────────────────────────────────────
    await page.goto('/')

    await expect(
      page.getByText(/in-progress round/i).or(page.getByText(/resume round/i))
    ).toBeVisible({ timeout: 5_000 })

    // ── Sign out ───────────────────────────────────────────────────────
    await signOutTestUser(page)

    await expect(
      page.getByRole('button', { name: /sign in/i })
    ).toBeVisible({ timeout: 5_000 })

    // ── Sign back in ───────────────────────────────────────────────────
    await signInTestUser(page, playerA, appUrl)
    await expect(page.getByText(/golf caddy/i)).toBeVisible()

    // ── Verify restore banner reappears ────────────────────────────────
    await expect(
      page.getByText(/in-progress round/i).or(page.getByText(/resume round/i))
    ).toBeVisible({ timeout: 15_000 })

    // ── Discard the round ──────────────────────────────────────────────
    await page.getByRole('button', { name: /discard/i }).click()

    const confirmDiscard = page.getByRole('button', { name: /yes, discard/i })
    await expect(confirmDiscard).toBeVisible({ timeout: 3_000 })
    await confirmDiscard.click()

    // ── Verify banner does not reappear ────────────────────────────────
    await page.waitForTimeout(2_000)
    await page.reload()
    await expect(page.getByText(/golf caddy/i)).toBeVisible()

    await expect(page.getByText(/in-progress round/i)).not.toBeVisible({
      timeout: 5_000,
    })
    await expect(page.getByText(/resume round/i)).not.toBeVisible({
      timeout: 3_000,
    })

    await ctx.close()
  })
})
