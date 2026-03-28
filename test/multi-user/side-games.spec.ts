import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  signUpTestUser,
  signInTestUser,
  cleanUpTestUser,
  type TestUser,
} from '../helpers/auth'

test.describe('Side Games — Skins configured + live updates in both contexts', () => {
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

  test('Skins side game visible and updating in both contexts', async ({
    browser,
    baseURL,
  }) => {
    const appUrl = baseURL!
    const ctxA: BrowserContext = await browser.newContext()
    const ctxB: BrowserContext = await browser.newContext()
    const pageA: Page = await ctxA.newPage()
    const pageB: Page = await ctxB.newPage()

    // ── Sign in both players ───────────────────────────────────────────
    await signInTestUser(pageA, playerA, appUrl)
    await signInTestUser(pageB, playerB, appUrl)

    await expect(pageA.getByRole('heading', { name: /golf caddy/i })).toBeVisible()
    await expect(pageB.getByRole('heading', { name: /golf caddy/i })).toBeVisible()

    // ── Player A: host group round ─────────────────────────────────────
    await pageA.getByRole('link', { name: /group round/i }).click()
    await pageA.getByRole('link', { name: /host/i }).click()

    const roomCodeEl = pageA
      .locator('[class*="tracking-widest"]')
      .filter({ hasText: /^\d{4}$/ })
    await expect(roomCodeEl).toBeVisible({ timeout: 10_000 })
    const roomCode = (await roomCodeEl.textContent())!.trim()

    // ── Player B: join via room code ───────────────────────────────────
    await pageB.getByRole('link', { name: /group round/i }).click()
    await pageB.getByRole('link', { name: /join/i }).click()

    const codeInputs = pageB.locator('input[maxlength="1"]')
    for (let i = 0; i < 4; i++) {
      await codeInputs.nth(i).fill(roomCode[i])
    }
    await pageB.getByRole('button', { name: /next|join|submit/i }).click()
    await pageB.getByPlaceholder(/name/i).fill('Skins Guest')
    await pageB.getByRole('button', { name: /join|next|submit/i }).click()

    // Wait for both in lobby
    await expect(pageA.getByText('Skins Guest')).toBeVisible({ timeout: 10_000 })

    // ── Player A: setup course ─────────────────────────────────────────
    await pageA.getByRole('button', { name: /set up course|next|continue/i }).click()

    const courseInput = pageA.getByPlaceholder(/course/i)
    if (await courseInput.isVisible()) {
      await courseInput.fill('Skins Test Course')
    }

    // Advance to side games configuration
    await pageA.getByRole('button', { name: /next|continue|side games/i }).click()

    // ── Configure Skins ────────────────────────────────────────────────
    // Enable Skins toggle (try multiple selector strategies)
    const skinsToggle = pageA
      .getByText(/skins/i)
      .locator('..')
      .locator('button, input[type="checkbox"], [role="switch"]')
      .first()
    await skinsToggle.click()

    // Set stake per skin if visible
    const stakeInput = pageA
      .getByPlaceholder(/stake|amount/i)
      .or(pageA.getByLabel(/stake per skin/i))
    if (await stakeInput.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await stakeInput.first().fill('5')
    }

    // ── Start the round ────────────────────────────────────────────────
    await pageA.getByRole('button', { name: /start round|begin/i }).click()

    await expect(pageA).toHaveURL(/\/round/, { timeout: 15_000 })
    await expect(pageB).toHaveURL(/\/round/, { timeout: 15_000 })

    // ── Verify SideGamePanel visible on both contexts ──────────────────
    const sideGamesTabA = pageA.getByRole('tab', { name: /side ?games?/i })
    const sideGamesTabB = pageB.getByRole('tab', { name: /side ?games?/i })

    await sideGamesTabA.click()
    await expect(pageA.getByText(/skins/i)).toBeVisible()

    await sideGamesTabB.click()
    await expect(pageB.getByText(/skins/i)).toBeVisible()

    // ── Player A: enter birdie on hole 1 (3 strokes on par 4) ──────────
    await pageA.getByRole('tab', { name: /round/i }).click()
    const addShotA = pageA.getByRole('button', { name: /\+|add shot/i }).first()
    for (let i = 0; i < 3; i++) {
      await addShotA.click()
    }
    await pageA.getByRole('button', { name: /next hole|→|>/i }).click()

    // ── Player B: enter bogey on hole 1 (5 strokes on par 4) ──────────
    await pageB.getByRole('tab', { name: /round/i }).click()
    const addShotB = pageB.getByRole('button', { name: /\+|add shot/i }).first()
    for (let i = 0; i < 5; i++) {
      await addShotB.click()
    }
    await pageB.getByRole('button', { name: /next hole|→|>/i }).click()

    // ── Verify Skins panel updates ─────────────────────────────────────
    await sideGamesTabA.click()
    await expect(pageA.getByText(/skin|won/i)).toBeVisible({ timeout: 10_000 })

    await sideGamesTabB.click()
    await expect(pageB.getByText(/skin|won/i)).toBeVisible({ timeout: 10_000 })

    await ctxA.close()
    await ctxB.close()
  })
})
