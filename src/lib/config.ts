export const DISCORD_INVITE_URL: string =
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_DISCORD_INVITE_URL ??
  'https://discord.gg/tGycmdBjRm'
