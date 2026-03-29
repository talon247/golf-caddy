import { lazy, Suspense } from 'react'
import * as Sentry from '@sentry/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useGroupRoundRecovery } from './hooks/useGroupRoundRecovery'
import { AuthProvider } from './components/AuthProvider'
import { Header } from './components/Header'
import { BottomNav } from './components/BottomNav'
import { LoadingScreen } from './components/LoadingScreen'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { Toaster } from './components/Toaster'

const Home = lazy(() => import('./pages/Home'))
const Setup = lazy(() => import('./pages/Setup'))
const Round = lazy(() => import('./pages/Round'))
const RoundUndoA = lazy(() => import('./pages/RoundUndoA'))
const RoundUndoB = lazy(() => import('./pages/RoundUndoB'))
const RoundUndoC = lazy(() => import('./pages/RoundUndoC'))
const Summary = lazy(() => import('./pages/Summary'))
const Bag = lazy(() => import('./pages/Bag'))
const Courses = lazy(() => import('./pages/Courses'))
const GroupRound = lazy(() => import('./pages/GroupRound'))
const GroupRoundHost = lazy(() => import('./pages/GroupRoundHost'))
const GroupRoundJoin = lazy(() => import('./pages/GroupRoundJoin'))
const HandicapHistory = lazy(() => import('./pages/HandicapHistory'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Profile = lazy(() => import('./pages/Profile'))
const History = lazy(() => import('./pages/History'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Friends = lazy(() => import('./pages/Friends'))
const SettlementHistory = lazy(() => import('./pages/SettlementHistory'))
const TournamentCreate = lazy(() => import('./pages/TournamentCreate'))
const NotFound = lazy(() => import('./pages/NotFound'))

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
          <Suspense fallback={<LoadingScreen />}>
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
            <Route path="/join/:code" element={<RouteErrorBoundary routeName="Group Round"><GroupRoundJoin /></RouteErrorBoundary>} />
            <Route path="/handicap" element={<HandicapHistory />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/history" element={<History />} />
            <Route path="/analytics" element={<RouteErrorBoundary routeName="Analytics"><Analytics /></RouteErrorBoundary>} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/settlement-history" element={<SettlementHistory />} />
            <Route path="/tournament/create" element={<TournamentCreate />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <BottomNav />
          <Toaster />
        </div>
        </AuthProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  )
}

export default App
