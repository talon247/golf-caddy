export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-cream z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin" />
        <p className="text-green-900 text-sm font-medium">Loading…</p>
      </div>
    </div>
  )
}
