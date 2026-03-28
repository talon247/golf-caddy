import * as Sentry from '@sentry/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useGroupRoundRecovery } from './hooks/useGroupRoundRecovery'
import { Header } from './components/Header'
import Home from './pages/Home'
import Setup from './pages/Setup'
import Round from './pages/Round'
import RoundUndoA from './pages/RoundUndoA'
import RoundUndoB from './pages/RoundUndoB'
import RoundUndoC from './pages/RoundUndoC'
import Summary from './pages/Summary'
import Bag from './pages/Bag'
import Courses from './pages/Courses'
import GroupRoundHost from './pages/GroupRoundHost'
import GroupRoundJoin from './pages/GroupRoundJoin'
import HandicapHistory from './pages/HandicapHistory'

function AppInner() {
  useGroupRoundRecovery()
  return null
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p className="p-8 text-center text-red-700">Something went wrong. Please reload the app.</p>} showDialog>
      <BrowserRouter>
        <AppInner />
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
            <Route path="/group-round/host" element={<GroupRoundHost />} />
            <Route path="/group-round/join" element={<GroupRoundJoin />} />
            <Route path="/group-round/join/:code" element={<GroupRoundJoin />} />
            <Route path="/handicap" element={<HandicapHistory />} />
          </Routes>
        </div>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  )
}

export default App
