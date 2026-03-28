import { supabase } from './supabase'
import type { AuthChangeEvent, AuthResponse, Session } from '@supabase/supabase-js'

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  const response = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        // Trigger uses raw_user_meta_data->>'full_name' to set display_name in profiles
        full_name: displayName,
      },
    },
  })
  if (response.error) throw response.error
  return response
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  const response = await supabase.auth.signInWithPassword({ email, password })
  if (response.error) throw response.error
  return response
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  })
  if (error) throw error
}

export function onAuthChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): { unsubscribe: () => void } {
  const { data } = supabase.auth.onAuthStateChange(callback)
  return { unsubscribe: () => data.subscription.unsubscribe() }
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}
