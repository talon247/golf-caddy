import { useState } from 'react'
import { DISCORD_INVITE_URL } from '../lib/config'

const DISMISSED_KEY = 'gc-discord-banner-dismissed'

interface DiscordInviteBannerProps {
  /** When true the banner is always visible and not dismissable (Profile card). */
  permanent?: boolean
}

export default function DiscordInviteBanner({ permanent = false }: DiscordInviteBannerProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (permanent) return false
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true')
    } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-md flex items-center gap-3">
      {/* Discord icon (SVG) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-8 h-8 shrink-0 opacity-90"
        aria-hidden="true"
      >
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm leading-tight">Join the Beta Community</div>
        <div className="text-indigo-200 text-xs mt-0.5 leading-snug">
          Share your rounds and get early access to new features.
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white text-indigo-600 font-bold text-sm px-3 py-1.5 rounded-lg touch-target"
        >
          Join
        </a>
        {!permanent && (
          <button
            onClick={dismiss}
            className="text-indigo-300 hover:text-white text-lg leading-none touch-target px-1"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
