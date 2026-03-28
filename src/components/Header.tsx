import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { useGroupRoundStore } from '../store/groupRoundStore'

export function Header() {
  const [copied, setCopied] = useState(false)
  const groupRound = useGroupRoundStore((s) => s.groupRound)
  const roomCode = groupRound?.roomCode ?? null

  const handleCopyRoomCode = async () => {
    const joinUrl = `${window.location.origin}/group-round/join/${roomCode}`
    try {
      await navigator.clipboard.writeText(joinUrl)
    } catch {
      // Fallback for HTTP
      const input = document.createElement('input')
      input.value = joinUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <header className="bg-forest text-cream px-4 py-3 flex items-center justify-between shadow-md">
      <span className="font-bold text-lg tracking-wide">⛳ Golf Caddy</span>
      {roomCode ? (
        <button
          aria-label="Copy room join link"
          onClick={handleCopyRoomCode}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold touch-target transition-all duration-150 active:scale-95 ${
            copied
              ? 'bg-green-50 text-green-700'
              : 'bg-[#f5f0e8] text-[#2d5a27]'
          }`}
        >
          {copied ? (
            <>
              <Check size={16} />
              <span className="font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Share2 size={16} />
              <span className="tracking-widest">{roomCode}</span>
            </>
          )}
        </button>
      ) : null}
    </header>
  )
}
