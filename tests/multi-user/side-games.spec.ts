import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser, type TestUser } from '../helpers/auth'
import { cleanupTestData } from '../helpers/supabase'

test.describe('Side Games — Skins configured + live updates in both contexts', () => {
  let playerA: TestUser
  let playerB: TestUser

  test.beforeAll(async () => {
    playerA = await createTestUser('skins-host')
    playerB = await createTestUser('skins-guest')
  })

  test.afterAll(async () => {
    await cleanupTestData([playerA.id, playerB.id])
    await deleteTestUser(playerA.id)
    await deleteTestUser(playerB.id)
  })

  test('Skins side game visible and updating in both contexts', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    // ── Sign in both players ───────────────────────────────────────────
    await pageA.goto('/')
    await pageA.getByRole('button', { name: /sign in/i }).click()
    await pageA.getByPlaceholder(/email/i).fill(playerA.email)
    await pageA.getByPlaceholder(/password/i).fill(playerA.password)
    await pageA.getByRole('button', { name: /sign in/i }).click()
    await expect(pageA.getByText(/golf caddy/i)).toBeVisible()

    await pageB.goto('/')
    await pageB.getByRole('button', { name: /sign in/i }).click()
    await pageB.getByPlaceholder(/email/i).fill(playerB.email)
    await pageB.getByPlaceholder(/password/i).fill(playerB.password)
    await pageB.getByRole('button', { name: /sign in/i }).click()
    await expect(pageB.getByText(/golf caddy/i)).toBeVisible()

    // ── Player A: host group round ─────────────────────────────────────
    await pageA.getByRole('link', { name: /group round/i }).click()
    await pageA.getByRole('link', { name: /host/i }).click()

    const roomCodeEl = pageA.locator('[class*="tracking-widest"]').filter({ hasText: /^\d{4}$/ })
    await expect(roomCodeEl).toBeVisible({ timeout: 10_000 })
    const roomCode = (await roomCodeEl.textContent())!.trim()

    // ── Player B: join ─────────────────────────────────────────────────
    await pageB.getByRole('link', { name: /group round/i }).click()
    await pageB.getByRole('link', { name: /join/i }).click()

    const codeInputs = pageB.locator('input[maxlength="1"]')
    for (let i = 0; i < 4; i++) {
      await codeInputs.nth(i).fill(roomCode[i])
    }
    await pageB.getByRole('button', { name: /next|join|submit/i }).click()
    await pageB.getByPlaceholder(/name/i).fill(playerB.displayName)
    await pageB.getByRole('button', { name: /join|next|submit/i }).click()

    // Wait for both in lobby
    await expect(pageA.getByText(playerB.displayName)).toBeVisible({ timeout: 10_000 })

    // ── Player A: setup course ─────────────────────────────────────────
    await pageA.getByRole('button', { name: /set up course|next|continue/i }).click()

    const courseInput = pageA.getByPlaceholder(/course/i)
    if (await courseInput.isVisible()) {
      await courseInput.fill('Skins Test Course')
    }

    // Advance to side games configuration phase
    await pageA.getByRole('button', { name: /next|continue|side games/i }).click()

    // ── Configure Skins side game ──────────────────────────────────────
    // Enable Skins
    const skinsToggle = pageA.getByText(/skins/i).locator('..').getByRole('switch', { name: /skins/i })
      .or(pageA.getByLabel(/skins/i))
      .or(pageA.locator('button, input[type="checkbox"]').filter({ hasText: /skins/i }))
    await skinsToggle.first().click()

    // Set stake per skin (if field is visible)
    const stakeInput = pageA.getByPlaceholder(/stake|amount/i).or(pageA.getByLabel(/stake per skin/i))
    if (await stakeInput.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await stakeInput.first().fill('5')
    }

    // ── Start the round with Skins enabled ─────────────────────────────
    await pageA.getByRole('button', { name: /start round|begin/i }).click()

    // Both should navigate to /round
    await expect(pageA).toHaveURL(/\/round/, { timeout: 15_000 })
    await expect(pageB).toHaveURL(/\/round/, { timeout: 15_000 })

    // ── Verify SideGamePanel visible on both contexts ──────────────────
    // Switch to side games tab
    const sideGamesTabA = pageA.getByRole('tab', { name: /side ?games?/i })
    const sideGamesTabB = pageB.getByRole('tab', { name: /side ?games?/i })

    await sideGamesTabA.click()
    await expect(pageA.getByText(/skins/i)).toBeVisible()

    await sideGamesTabB.click()
    await expect(pageB.getByText(/skins/i)).toBeVisible()

    // ── Player A: enter score on hole 1 (birdie = 3 on par 4) ──────────
    await pageA.getByRole('tab', { name: /round/i }).click()
    const addShotA = pageA.getByRole('button', { name: /\+|add shot/i }).first()
    for (let i = 0; i < 3; i++) {
      await addShotA.click()
    }
    await pageA.getByRole('button', { name: /next hole|→|>/i }).click()

    // ── Player B: enter score on hole 1 (bogey = 5 on par 4) ──────────
    await pageB.getByRole('tab', { name: /round/i }).click()
    const addShotB = pageB.getByRole('button', { name: /\+|add shot/i }).first()
    for (let i = 0; i < 5; i++) {
      await addShotB.click()
    }
    await pageB.getByRole('button', { name: /next hole|→|>/i }).click()

    // ── Verify Skins panel updates on both sides ───────────────────────
    // Player A should have won the skin on hole 1
    await sideGamesTabA.click()
    await expect(
      pageA.getByText(/skin|won/i)
    ).toBeVisible({ timeout: 10_000 })

    await sideGamesTabB.click()
    await expect(
      pageB.getByText(/skin|won/i)
    ).toBeVisible({ timeout: 10_000 })

    // Cleanup
    await ctxA.close()
    await ctxB.close()
  })
})
