import { useRef, useState } from 'react'
import { useAppStore } from '../store'

export default function Bag() {
  const { clubBag, addClub, removeClub, updateClubName, moveClubUp, moveClubDown } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const sorted = [...clubBag].sort((a, b) => a.order - b.order)

  function startEdit(id: string, name: string) {
    setEditingId(id)
    setEditValue(name)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    if (editingId) {
      const trimmed = editValue.trim()
      if (trimmed) updateClubName(editingId, trimmed)
    }
    setEditingId(null)
  }

  function handleAdd() {
    const id = addClub('New Club')
    setEditingId(id)
    setEditValue('New Club')
    setTimeout(() => inputRef.current?.select(), 50)
  }

  function handleDone() {
    commitEdit()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <main className="flex flex-col flex-1 p-4 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-forest">My Bag</h1>
        <button
          onClick={handleDone}
          className="bg-forest text-cream font-semibold px-4 py-2 min-h-[44px] rounded-lg hover:bg-forest-mid transition-colors"
        >
          {saved ? '✓ Saved' : 'Done'}
        </button>
      </div>
      <p className="text-warm-gray text-sm mb-5">
        {sorted.length} club{sorted.length !== 1 ? 's' : ''} · tap a name to edit
      </p>

      <ul className="flex flex-col gap-2 mb-4">
        {sorted.map((club, idx) => (
          <li
            key={club.id}
            className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-cream-dark"
          >
            {editingId === club.id ? (
              <input
                ref={inputRef}
                className="flex-1 border-b-2 border-forest outline-none px-1 py-0.5 bg-transparent text-base"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingId(null)
                }}
              />
            ) : (
              <button
                className="flex-1 text-left px-1 py-0.5 hover:text-forest rounded transition-colors"
                onClick={() => startEdit(club.id, club.name)}
              >
                {club.name}
              </button>
            )}

            <div className="flex flex-col shrink-0">
              <button
                className="text-warm-gray hover:text-forest disabled:opacity-25 text-xs leading-tight px-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                onClick={() => moveClubUp(club.id)}
                disabled={idx === 0}
                aria-label={`Move ${club.name} up`}
              >
                ▲
              </button>
              <button
                className="text-warm-gray hover:text-forest disabled:opacity-25 text-xs leading-tight px-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                onClick={() => moveClubDown(club.id)}
                disabled={idx === sorted.length - 1}
                aria-label={`Move ${club.name} down`}
              >
                ▼
              </button>
            </div>

            <button
              className="shrink-0 touch-target flex items-center justify-center text-warm-gray hover:text-red-500 transition-colors ml-1"
              onClick={() => removeClub(club.id)}
              aria-label={`Remove ${club.name}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={handleAdd}
        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-forest-light text-forest hover:border-forest hover:bg-cream-dark transition-colors font-medium"
      >
        <span className="text-xl leading-none">+</span>
        <span>Add Club</span>
      </button>
    </main>
  )
}
