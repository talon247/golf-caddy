import * as Sentry from '@sentry/react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import Setup from './pages/Setup'
import Round from './pages/Round'
import RoundUndoA from './pages/RoundUndoA'
import RoundUndoB from './pages/RoundUndoB'
import RoundUndoC from './pages/RoundUndoC'
import Summary from './pages/Summary'
import Bag from './pages/Bag'
import Courses from './pages/Courses'
import GroupRoundJoin from './pages/GroupRoundJoin'

function Header() {
  return (
    <header className="bg-forest text-cream px-4 py-3 flex items-center justify-between shadow-md">
      <span className="font-bold text-lg tracking-wide">⛳ Golf Caddy</span>
      <nav className="flex gap-4 text-sm">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `touch-target flex items-center px-2 ${isActive ? 'underline' : 'opacity-80 hover:opacity-100'}`
          }
        >
          Home
        </NavLink>
        <NavLink
          to="/bag"
          className={({ isActive }) =>
            `touch-target flex items-center px-2 ${isActive ? 'underline' : 'opacity-80 hover:opacity-100'}`
          }
        >
          Bag
        </NavLink>
      </nav>
    </header>
  )
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p className="p-8 text-center text-red-700">Something went wrong. Please reload the app.</p>} showDialog>
      <BrowserRouter>
        <div className="flex flex-col min-h-svh bg-cream">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/round" element={<Round />} />
            <Route path="/round-a" element={<RoundUndoA />} />
            <Route path="/round-b" element={<RoundUndoB />} />
            <Route path="/round-c" element={<RoundUndoC />} />
            <Route path="/summary/:id" element={<Summary />} />
            <Route path="/bag" element={<Bag />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/group-round/join" element={<GroupRoundJoin />} />
            <Route path="/group-round/join/:code" element={<GroupRoundJoin />} />
          </Routes>
        </div>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  )
}

export default App
