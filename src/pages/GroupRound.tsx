import { Link } from 'react-router-dom'

export default function GroupRound() {
  return (
    <main className="flex flex-col flex-1 max-w-lg mx-auto w-full pb-20">
      <div className="flex flex-col flex-1 p-6 gap-6">
        <div className="text-center pt-4">
          <div className="text-5xl mb-2">👥</div>
          <h1 className="text-3xl font-black text-forest">Group Round</h1>
          <p className="text-warm-gray mt-1">Play together, track separately</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/group-round/host"
            className="flex items-center justify-center bg-forest text-cream py-4 rounded-2xl text-lg font-bold shadow-md touch-target"
          >
            Host a Round
          </Link>
          <Link
            to="/group-round/join"
            className="flex items-center justify-center border-2 border-forest text-forest py-4 rounded-2xl text-lg font-bold touch-target"
          >
            Join a Round
          </Link>
        </div>
      </div>
    </main>
  )
}
