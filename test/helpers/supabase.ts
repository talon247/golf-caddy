import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://fxnpkaongbnmuxsdnyly.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY env var is required for test helpers"
  );
}

/** Admin Supabase client with service-role privileges (test use only). */
export const adminClient: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/** Generate a unique test email address. */
export function testEmail(): string {
  const id = crypto.randomUUID();
  return `test+${id}@golf-caddy.test`;
}

/** Create a test user and return their id + email. */
export async function createTestUser(
  email?: string,
  password = "Test1234!"
): Promise<{ id: string; email: string; password: string }> {
  const userEmail = email ?? testEmail();
  const { data, error } = await adminClient.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  return { id: data.user.id, email: userEmail, password };
}

/** Delete a test user by id. */
export async function deleteTestUser(userId: string): Promise<void> {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Failed to delete test user: ${error.message}`);
}
