import * as Sentry from '@sentry/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useGroupRoundRecovery } from './hooks/useGroupRoundRecovery'
import { AuthProvider } from './components/AuthProvider'
import { Header } from './components/Header'
import { BottomNav } from './components/BottomNav'
import Home from './pages/Home'
import Setup from './pages/Setup'
import Round from './pages/Round'
import RoundUndoA from './pages/RoundUndoA'
import RoundUndoB from './pages/RoundUndoB'
import RoundUndoC from './pages/RoundUndoC'
import Summary from './pages/Summary'
import Bag from './pages/Bag'
import Courses from './pages/Courses'
import GroupRound from './pages/GroupRound'
import GroupRoundHost from './pages/GroupRoundHost'
import GroupRoundJoin from './pages/GroupRoundJoin'
import HandicapHistory from './pages/HandicapHistory'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'
import History from './pages/History'
import Analytics from './pages/Analytics'
import Friends from './pages/Friends'
import SettlementHistory from './pages/SettlementHistory'
import NotFound from './pages/NotFound'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { Toaster } from './components/Toaster'

function AppInner() {
  useGroupRoundRecovery()
  return null
}

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p className="p-8 text-center text-red-700">Something went wrong. Please reload the app.</p>} showDialog>
      <BrowserRouter>
        <AuthProvider>
        <AppInner />
        <div className="flex flex-col min-h-svh bg-cream">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/round" element={<RouteErrorBoundary routeName="Round"><Round /></RouteErrorBoundary>} />
            <Route path="/round-a" element={<RouteErrorBoundary routeName="Round"><RoundUndoA /></RouteErrorBoundary>} />
            <Route path="/round-b" element={<RouteErrorBoundary routeName="Round"><RoundUndoB /></RouteErrorBoundary>} />
            <Route path="/round-c" element={<RouteErrorBoundary routeName="Round"><RoundUndoC /></RouteErrorBoundary>} />
            <Route path="/summary/:id" element={<RouteErrorBoundary routeName="Summary"><Summary /></RouteErrorBoundary>} />
            <Route path="/bag" element={<Bag />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/group-round" element={<RouteErrorBoundary routeName="Group Round"><GroupRound /></RouteErrorBoundary>} />
            <Route path="/group-round/host" element={<RouteErrorBoundary routeName="Group Round"><GroupRoundHost /></RouteErrorBoundary>} />
            <Route path="/group-round/join" element={<RouteErrorBoundary routeName="Group Round"><GroupRoundJoin /></RouteErrorBoundary>} />
            <Route path="/group-round/join/:code" element={<RouteErrorBoundary routeName="Group Round"><GroupRoundJoin /></RouteErrorBoundary>} />
            <Route path="/handicap" element={<HandicapHistory />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/history" element={<History />} />
            <Route path="/analytics" element={<RouteErrorBoundary routeName="Analytics"><Analytics /></RouteErrorBoundary>} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/settlement-history" element={<SettlementHistory />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
          <Toaster />
        </div>
        </AuthProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  )
}

export default App
