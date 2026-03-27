import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { buildHoles } from '../storage'
import ConfirmModal from '../components/ConfirmModal'

export default function Setup() {
  const navigate = useNavigate()
  const { addRound, setActiveRoundId, completeRound, activeRoundId, clubBag } = useAppStore()

  const [courseName, setCourseName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [tees, setTees] = useState('White')
  const [holeCount, setHoleCount] = useState<9 | 18>(18)
  const [showBagWarning, setShowBagWarning] = useState(false)

  function startRound() {
    if (activeRoundId) {
      const confirmed = window.confirm(
        'You have an active round in progress. Starting a new round will abandon it. Continue?'
      )
      if (!confirmed) return
      completeRound(activeRoundId)
    }
    const id = crypto.randomUUID()
    addRound({
      id,
      courseName: courseName.trim() || 'Unknown Course',
      playerName: playerName.trim() || 'Player',
      tees,
      holeCount,
      startedAt: Date.now(),
      holes: buildHoles(holeCount),
    })
    setActiveRoundId(id)
    navigate('/round')
  }

  function handleStart(e: React.FormEvent) {
    e.preventDefault()
    if (clubBag.length === 0) {
      setShowBagWarning(true)
      return
    }
    startRound()
  }

  return (
    <main className="flex flex-col flex-1 p-6 max-w-lg mx-auto w-full">
      <h1 className="text-2xl font-bold text-forest mb-6">New Round</h1>
      <form onSubmit={handleStart} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-warm-gray uppercase tracking-wide">
            Course Name
          </label>
          <input
            type="text"
            value={courseName}
            onChange={e => setCourseName(e.target.value)}
            placeholder="Augusta National"
            className="border border-cream-dark rounded-lg px-4 py-3 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-warm-gray uppercase tracking-wide">
            Player Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Your name"
            className="border border-cream-dark rounded-lg px-4 py-3 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-warm-gray uppercase tracking-wide">
            Tees
          </label>
          <select
            value={tees}
            onChange={e => setTees(e.target.value)}
            className="border border-cream-dark rounded-lg px-4 py-3 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-forest"
          >
            <option>Black</option>
            <option>Blue</option>
            <option>White</option>
            <option>Gold</option>
            <option>Red</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-warm-gray uppercase tracking-wide">
            Holes
          </label>
          <div className="flex gap-3">
            {([9, 18] as const).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setHoleCount(n)}
                className={`flex-1 py-3 rounded-lg text-lg font-semibold border-2 transition-colors touch-target ${
                  holeCount === n
                    ? 'bg-forest text-cream border-forest'
                    : 'bg-white text-forest border-cream-dark'
                }`}
              >
                {n} holes
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="mt-4 bg-forest text-cream py-4 rounded-xl text-lg font-bold shadow touch-target"
        >
          Start Round →
        </button>
      </form>

      {showBagWarning && (
        <ConfirmModal
          title="Your bag is empty"
          message="Add clubs before starting a round so you can track shots by club. You can still start without clubs."
          confirmLabel="Start Anyway"
          cancelLabel="Go to Bag"
          onConfirm={() => {
            setShowBagWarning(false)
            startRound()
          }}
          onCancel={() => {
            setShowBagWarning(false)
            navigate('/bag')
          }}
        />
      )}
    </main>
  )
}
