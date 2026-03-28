import { useState } from "react"
import { AuthModal } from "./AuthModal"

interface Props {
  roundId: string
  isAuthenticated: boolean
}

export function SaveRoundBanner({ roundId, isAuthenticated }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(`save_prompt_dismissed_${roundId}`) === "true"
  })
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signup")

  if (isAuthenticated || dismissed) return null

  function handleDismiss() {
    localStorage.setItem(`save_prompt_dismissed_${roundId}`, "true")
    setDismissed(true)
  }

  function handleSignUp() {
    setAuthTab("signup")
    setAuthOpen(true)
  }

  function handleSignIn() {
    setAuthTab("signin")
    setAuthOpen(true)
  }

  return (
    <>
      <div className="mx-4 mb-4 bg-[#2d5a27]/10 border border-[#2d5a27]/30 rounded-2xl px-4 py-4">
        <p className="text-sm font-semibold text-[#1a1a1a] mb-3">
          💾 Save this round? Sign in to keep your history and track your handicap.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleSignUp}
            className="flex-1 bg-[#2d5a27] text-white rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-transform"
          >
            Sign Up
          </button>
          <button
            onClick={handleSignIn}
            className="flex-1 border border-[#2d5a27] text-[#2d5a27] rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-transform"
          >
            Sign In
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 text-[#6b6b6b] text-sm font-semibold"
          >
            Not Now
          </button>
        </div>
      </div>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
    </>
  )
}
