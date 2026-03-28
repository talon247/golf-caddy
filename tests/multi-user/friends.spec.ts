import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser, type TestUser } from '../helpers/auth'
import { cleanupTestData } from '../helpers/supabase'

test.describe('Friends — send request, accept, presence indicator', () => {
  let playerA: TestUser
  let playerB: TestUser

  test.beforeAll(async () => {
    playerA = await createTestUser('friends-a')
    playerB = await createTestUser('friends-b')
  })

  test.afterAll(async () => {
    await cleanupTestData([playerA.id, playerB.id])
    await deleteTestUser(playerA.id)
    await deleteTestUser(playerB.id)
  })

  test('A sends friend request to B by username, B accepts, presence visible', async ({
    browser,
  }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    // ── Sign in Player A ───────────────────────────────────────────────
    await pageA.goto('/')
    await pageA.getByRole('button', { name: /sign in/i }).click()
    await pageA.getByPlaceholder(/email/i).fill(playerA.email)
    await pageA.getByPlaceholder(/password/i).fill(playerA.password)
    await pageA.getByRole('button', { name: /sign in/i }).click()
    await expect(pageA.getByText(/golf caddy/i)).toBeVisible()

    // ── Sign in Player B ───────────────────────────────────────────────
    await pageB.goto('/')
    await pageB.getByRole('button', { name: /sign in/i }).click()
    await pageB.getByPlaceholder(/email/i).fill(playerB.email)
    await pageB.getByPlaceholder(/password/i).fill(playerB.password)
    await pageB.getByRole('button', { name: /sign in/i }).click()
    await expect(pageB.getByText(/golf caddy/i)).toBeVisible()

    // ── Ensure both players have usernames set ─────────────────────────
    // Players created via helpers should have usernames, but if the app
    // shows a username setup modal on first visit, fill it in.
    for (const [page, user] of [[pageA, playerA], [pageB, playerB]] as const) {
      const usernameModal = page.getByPlaceholder(/username/i)
      if (await usernameModal.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await usernameModal.fill(user.username)
        await page.getByRole('button', { name: /save|set|confirm/i }).click()
      }
    }

    // ── Player A: navigate to Friends → Search tab ─────────────────────
    await pageA.goto('/friends')
    await pageA.getByRole('tab', { name: /search/i }).click()

    // Search for Player B by username
    await pageA.getByPlaceholder(/search|find|username/i).fill(playerB.username)

    // Wait for search results
    await expect(pageA.getByText(playerB.displayName)).toBeVisible({ timeout: 10_000 })

    // Send friend request
    await pageA.getByRole('button', { name: /add|send|request/i }).first().click()

    // Verify request sent feedback
    await expect(
      pageA.getByText(/sent|pending|requested/i)
    ).toBeVisible({ timeout: 5_000 })

    // ── Player B: navigate to Friends → Requests tab ───────────────────
    await pageB.goto('/friends')
    await pageB.getByRole('tab', { name: /requests/i }).click()

    // Verify Player A's request is visible
    await expect(pageB.getByText(playerA.displayName)).toBeVisible({ timeout: 10_000 })

    // Accept the request
    await pageB.getByRole('button', { name: /accept/i }).first().click()

    // Verify B now sees A in friends list
    await pageB.getByRole('tab', { name: /friends/i }).click()
    await expect(pageB.getByText(playerA.displayName)).toBeVisible({ timeout: 5_000 })

    // ── Player A: verify B appears in friends list ─────────────────────
    await pageA.goto('/friends')
    await pageA.getByRole('tab', { name: /friends/i }).click()
    await expect(pageA.getByText(playerB.displayName)).toBeVisible({ timeout: 10_000 })

    // ── Player A: start a solo round ───────────────────────────────────
    await pageA.goto('/')
    await pageA.getByRole('link', { name: /start round|new round|play/i }).first().click()

    // Fill in round setup (minimal)
    const courseField = pageA.getByPlaceholder(/course/i)
    if (await courseField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await courseField.fill('Friendship Test Course')
    }
    const nameField = pageA.getByPlaceholder(/your name|player name/i)
    if (await nameField.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nameField.fill(playerA.displayName)
    }
    await pageA.getByRole('button', { name: /start|begin|go/i }).click()

    // A should now be on /round
    await expect(pageA).toHaveURL(/\/round|\/setup/, { timeout: 10_000 })

    // ── Player B: check presence — A should appear as playing ──────────
    // Navigate to home or friends page to see presence
    await pageB.goto('/')

    // Look for "Friends Playing" card or presence indicator
    // The FriendsPlayingCard component shows friends in active rounds
    const presenceIndicator = pageB
      .getByText(playerA.displayName)
      .or(pageB.getByText(/playing|in round|active/i))
    await expect(presenceIndicator.first()).toBeVisible({ timeout: 15_000 })

    // Cleanup
    await ctxA.close()
    await ctxB.close()
  })
})
