import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  signUpTestUser,
  signInTestUser,
  cleanUpTestUser,
  type TestUser,
} from '../helpers/auth'

test.describe('Group Round — host + join + leaderboard sync', () => {
  let playerA: TestUser
  let playerB: TestUser

  test.beforeAll(async () => {
    playerA = await signUpTestUser()
    playerB = await signUpTestUser()
  })

  test.afterAll(async () => {
    await cleanUpTestUser(playerA)
    await cleanUpTestUser(playerB)
  })

  test('two players complete a group round with live leaderboard', async ({
    browser,
    baseURL,
  }) => {
    const appUrl = baseURL!
    // Create two isolated browser contexts (separate sessions)
    const ctxA: BrowserContext = await browser.newContext()
    const ctxB: BrowserContext = await browser.newContext()
    const pageA: Page = await ctxA.newPage()
    const pageB: Page = await ctxB.newPage()

    // ── Sign in both players via session injection ─────────────────────
    await signInTestUser(pageA, playerA, appUrl)
    await signInTestUser(pageB, playerB, appUrl)

    await expect(pageA.getByText(/golf caddy/i)).toBeVisible()
    await expect(pageB.getByText(/golf caddy/i)).toBeVisible()

    // ── Player A: start group round (host) ─────────────────────────────
    await pageA.getByRole('link', { name: /group round/i }).click()
    await pageA.getByRole('link', { name: /host/i }).click()

    // Wait for room code to be generated
    const roomCodeEl = pageA
      .locator('[class*="tracking-widest"]')
      .filter({ hasText: /^\d{4}$/ })
    await expect(roomCodeEl).toBeVisible({ timeout: 10_000 })
    const roomCode = (await roomCodeEl.textContent())!.trim()
    expect(roomCode).toMatch(/^\d{4}$/)

    // ── Player B: join via room code ───────────────────────────────────
    await pageB.getByRole('link', { name: /group round/i }).click()
    await pageB.getByRole('link', { name: /join/i }).click()

    // Enter 4-digit room code
    const codeInputs = pageB.locator('input[maxlength="1"]')
    for (let i = 0; i < 4; i++) {
      await codeInputs.nth(i).fill(roomCode[i])
    }
    await pageB.getByRole('button', { name: /next|join|submit/i }).click()

    // Enter display name for guest
    await pageB.getByPlaceholder(/name/i).fill('Guest B')
    await pageB.getByRole('button', { name: /join|next|submit/i }).click()

    // ── Verify both players appear in lobby ────────────────────────────
    await expect(pageA.getByText('Guest B')).toBeVisible({ timeout: 10_000 })
    // Player count should show 2
    await expect(pageA.getByText(/2\/4/)).toBeVisible()

    // ── Player A: configure course and start round ─────────────────────
    await pageA.getByRole('button', { name: /set up course|next|continue/i }).click()

    const courseInput = pageA.getByPlaceholder(/course/i)
    if (await courseInput.isVisible()) {
      await courseInput.fill('Test Course')
    }

    // Start the round (skip side games)
    await pageA.getByRole('button', { name: /start round|begin/i }).click()

    // ── Both should navigate to /round ─────────────────────────────────
    await expect(pageA).toHaveURL(/\/round/, { timeout: 15_000 })
    await expect(pageB).toHaveURL(/\/round/, { timeout: 15_000 })

    // ── Player A: enter score on hole 1 (4 strokes = par) ──────────────
    const addShotA = pageA.getByRole('button', { name: /\+|add shot/i }).first()
    for (let i = 0; i < 4; i++) {
      await addShotA.click()
    }

    // Move to next hole to trigger broadcast
    await pageA.getByRole('button', { name: /next hole|→|>/i }).click()

    // ── Verify Player B sees leaderboard update ────────────────────────
    await pageB.getByRole('tab', { name: /leaderboard/i }).click()
    // Player A's score should appear (E for even par on hole 1)
    await expect(pageB.getByText(/E|0|\+0/)).toBeVisible({ timeout: 10_000 })

    // ── Complete the round: fill remaining holes ───────────────────────
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
    await expect(pageA.getByText(/summary|scorecard|final/i)).toBeVisible({
      timeout: 10_000,
    })

    await ctxA.close()
    await ctxB.close()
  })
})
