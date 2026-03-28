import { NavLink, useLocation } from "react-router-dom"
import { Flag, Clock, BarChart2, User, Users } from "lucide-react"
import { useAppStore } from "../store"
import { useFriendsStore } from "../store/friendsStore"
import { FriendRequestBadge } from "./FriendRequestBadge"

export function BottomNav() {
  const location = useLocation()
  const syncStatus = useAppStore(s => s.syncStatus)
  const isAuthenticated = useAppStore(s => s.isAuthenticated)
  const pendingRequests = useFriendsStore(s => s.pendingRequests)

  // Hide bottom nav on round-playing screens
  const hiddenRoutes = ["/round", "/round-a", "/round-b", "/round-c"]
  if (hiddenRoutes.some(r => location.pathname.startsWith(r))) return null

  // Count unsynced rounds
  const unsyncedCount = Object.values(syncStatus).filter(
    s => s === "pending" || s === "error"
  ).length

  const tabClass = (isActive: boolean) =>
    `flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-semibold transition-colors relative ${
      isActive ? "text-[#2d5a27]" : "text-[#6b6b6b]"
    }`

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#e5e1d8] flex justify-around items-center pb-[env(safe-area-inset-bottom)]">
      <NavLink to="/" end className={({ isActive }) => tabClass(isActive)}>
        <Flag size={22} />
        <span>Play</span>
      </NavLink>

      <NavLink to="/history" className={({ isActive }) => tabClass(isActive)}>
        <div className="relative">
          <Clock size={22} />
          {unsyncedCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unsyncedCount > 9 ? "9+" : unsyncedCount}
            </span>
          )}
        </div>
        <span>History</span>
      </NavLink>

      <NavLink to="/analytics" className={({ isActive }) => tabClass(isActive)}>
        <BarChart2 size={22} />
        <span>Analytics</span>
      </NavLink>

      {isAuthenticated && (
        <NavLink to="/friends" className={({ isActive }) => tabClass(isActive)}>
          <div className="relative">
            <Users size={22} />
            <FriendRequestBadge count={pendingRequests.length} />
          </div>
          <span>Friends</span>
        </NavLink>
      )}

      <NavLink to="/profile" className={({ isActive }) => tabClass(isActive)}>
        <div className="relative">
          <User size={22} />
          {!isAuthenticated && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#2d5a27] rounded-full border border-white" />
          )}
        </div>
        <span>Profile</span>
      </NavLink>
    </nav>
  )
}
