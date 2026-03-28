interface Props {
  isOpen: boolean
  roundCount: number
  onConfirm: () => void
  onDecline: () => void
}

export function MigrationPrompt({ isOpen, roundCount, onConfirm, onDecline }: Props) {
  if (!isOpen) return null

  const roundWord = roundCount === 1 ? 'round' : 'rounds'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40"
        aria-hidden="true"
      />

      {/* Sheet / Modal */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 bg-[#f5f0e8] rounded-t-2xl shadow-xl px-6 pt-6 pb-10 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Sync local rounds"
      >
        {/* Title */}
        <h2 className="text-2xl font-black text-[#1a1a1a] mb-3">Welcome! 🎉</h2>

        {/* Body */}
        <p className="text-[#6b6b6b] text-base mb-6">
          We found <span className="font-bold text-[#1a1a1a]">{roundCount} {roundWord}</span> on
          this device. Sync them to your new account so you never lose them?
        </p>

        {/* Primary action */}
        <button
          onClick={onConfirm}
          className="w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform mb-3"
        >
          Yes, sync my rounds
        </button>

        {/* Secondary action */}
        <button
          onClick={onDecline}
          className="w-full text-[#6b6b6b] text-base font-semibold py-2 underline"
        >
          No, start fresh
        </button>
      </div>
    </>
  )
}
