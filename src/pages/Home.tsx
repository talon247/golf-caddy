import { Link } from 'react-router-dom'
import { useAppStore } from '../store'

export default function Home() {
  const { clubBag, rounds } = useAppStore()
  const hasRounds = rounds.length > 0

  return (
    <main className="flex flex-col items-center justify-center flex-1 p-6 gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-forest">Golf Caddy</h1>
        <p className="text-warm-gray mt-1">Your digital round companion</p>
      </div>

      {!hasRounds && (
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-cream-dark p-4 text-center">
          <p className="text-sm text-warm-gray mb-3">
            You have <span className="font-semibold text-forest">{clubBag.length} clubs</span> in your bag.
            Review them before starting a round.
          </p>
          <Link
            to="/bag"
            className="inline-block bg-forest text-cream font-semibold px-5 py-2.5 rounded-lg hover:bg-forest-mid transition-colors"
          >
            Review My Bag
          </Link>
        </div>
      )}

      <Link
        to="/setup"
        className="w-full max-w-sm flex items-center justify-center gap-2 bg-gold text-white font-bold py-4 rounded-xl shadow hover:opacity-90 transition-opacity text-lg"
      >
        Start a Round
      </Link>
    </main>
  )
}
