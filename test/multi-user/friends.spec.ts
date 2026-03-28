import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  signUpTestUser,
  signInTestUser,
  cleanUpTestUser,
  type TestUser,
} from '../helpers/auth'

test.describe('Friends — send request, accept, presence indicator', () => {
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

  test('A sends friend request by username, B accepts, presence visible', async ({
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

    // ── Set up usernames if prompted ───────────────────────────────────
    const usernameA = `testa_${playerA.id.slice(0, 6)}`
    const usernameB = `testb_${playerB.id.slice(0, 6)}`

    for (const [page, username] of [
      [pageA, usernameA],
      [pageB, usernameB],
    ] as const) {
      await page.goto('/friends')
      const usernameInput = page.getByPlaceholder(/username/i)
      if (
        await usernameInput.isVisible({ timeout: 3_000 }).catch(() => false)
      ) {
        await usernameInput.fill(username)
        await page.getByRole('button', { name: /save|set|confirm/i }).click()
        await expect(usernameInput).not.toBeVisible({ timeout: 5_000 })
      }
    }

    // ── Player A: search for Player B ──────────────────────────────────
    await pageA.goto('/friends')
    await pageA.getByRole('tab', { name: /search/i }).click()

    await pageA.getByPlaceholder(/search|find|username/i).fill(usernameB)

    // Wait for search results
    await expect(pageA.getByText(usernameB)).toBeVisible({ timeout: 10_000 })

    // Send friend request
    await pageA
      .getByRole('button', { name: /add|send|request/i })
      .first()
      .click()

    await expect(pageA.getByText(/sent|pending|requested/i)).toBeVisible({
      timeout: 5_000,
    })

    // ── Player B: accept request ───────────────────────────────────────
    await pageB.goto('/friends')
    await pageB.getByRole('tab', { name: /requests/i }).click()

    await expect(
      pageB.getByText(usernameA).or(pageB.getByText(playerA.email))
    ).toBeVisible({ timeout: 10_000 })

    await pageB.getByRole('button', { name: /accept/i }).first().click()

    // Verify B sees A in friends list
    await pageB.getByRole('tab', { name: /friends/i }).click()
    await expect(
      pageB.getByText(usernameA).or(pageB.getByText(playerA.email))
    ).toBeVisible({ timeout: 5_000 })

    // ── Player A: verify B in friends list ─────────────────────────────
    await pageA.goto('/friends')
    await pageA.getByRole('tab', { name: /friends/i }).click()
    await expect(
      pageA.getByText(usernameB).or(pageA.getByText(playerB.email))
    ).toBeVisible({ timeout: 10_000 })

    // ── Player A: start a solo round ───────────────────────────────────
    await pageA.goto('/')
    await pageA
      .getByRole('link', { name: /start round|new round|play/i })
      .first()
      .click()

    const courseField = pageA.getByPlaceholder(/course/i)
    if (await courseField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await courseField.fill('Friend Test Course')
    }
    const nameField = pageA.getByPlaceholder(/your name|player name/i)
    if (await nameField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nameField.fill('Player A')
    }
    await pageA.getByRole('button', { name: /start|begin|go/i }).click()
    await expect(pageA).toHaveURL(/\/round|\/setup/, { timeout: 10_000 })

    // ── Player B: check presence indicator ─────────────────────────────
    await pageB.goto('/')

    // FriendsPlayingCard shows friends in active rounds
    const presenceIndicator = pageB
      .getByText(usernameA)
      .or(pageB.getByText(/playing|in round|active/i))
    await expect(presenceIndicator.first()).toBeVisible({ timeout: 15_000 })

    await ctxA.close()
    await ctxB.close()
  })
})
