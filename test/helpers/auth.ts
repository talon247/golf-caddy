import { type Page } from "@playwright/test";
import { createTestUser, deleteTestUser } from "./supabase";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://fxnpkaongbnmuxsdnyly.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken?: string;
}

/** Sign up a new test user via Supabase Admin API, returning credentials. */
export async function signUpTestUser(): Promise<TestUser> {
  return createTestUser();
}

/**
 * Sign in a test user via Supabase Auth REST API and inject the session
 * into the browser's localStorage so the app picks it up on load.
 */
export async function signInTestUser(
  page: Page,
  user: TestUser,
  appUrl: string
): Promise<TestUser> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email: user.email, password: user.password }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sign-in failed (${res.status}): ${body}`);
  }

  const session = await res.json();

  // Inject the Supabase session into localStorage before navigating
  await page.goto(appUrl);
  await page.evaluate(
    ({ url, sess }) => {
      const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify(sess));
    },
    { url: SUPABASE_URL, sess: session }
  );

  // Reload so the app reads the injected session
  await page.reload();

  return { ...user, accessToken: session.access_token };
}

/** Sign out: clear localStorage session and reload. */
export async function signOutTestUser(page: Page): Promise<void> {
  await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.includes("auth-token")) localStorage.removeItem(key);
    }
  });
  await page.reload();
}

/** Clean up a test user (delete from Supabase). */
export async function cleanUpTestUser(user: TestUser): Promise<void> {
  await deleteTestUser(user.id);
}
