/**
 * sync.ts — SE1 will fill in the real implementations.
 * This file is a typed stub so TypeScript is satisfied.
 */
import type { Round, UserProfile, Club } from '../types'

// Stub — SE1 implements
export async function syncRoundToSupabase(_userId: string, _round: Round): Promise<void> {
  // SE1 implementation
}

// Stub — SE1 implements
export async function fetchRounds(_userId: string): Promise<Round[]> {
  return []
}

// Stub — SE1 implements
export async function fetchProfile(_userId: string): Promise<UserProfile | null> {
  return null
}

// Stub — SE1 implements
export async function syncClubs(_userId: string, _clubs: Club[]): Promise<void> {
  // SE1 implementation
}
