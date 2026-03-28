import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-6xl font-bold text-[#2d5a27] mb-2">404</div>
      <h1 className="text-xl font-semibold text-[#1a1a1a] mb-2">Page not found</h1>
      <p className="text-[#6b6b6b] mb-8 max-w-xs">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="bg-[#2d5a27] text-white rounded-xl px-6 py-3 text-base font-bold min-h-[48px] active:scale-95 transition-transform inline-flex items-center"
      >
        Back to Home
      </Link>
    </main>
  )
}
