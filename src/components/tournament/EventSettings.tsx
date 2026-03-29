import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../ConfirmModal'
import type { TournamentEvent, TournamentFormat } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament tables pending THEA-417
const db = supabase as unknown as any

const FORMAT_OPTIONS: { value: TournamentFormat; label: string }[] = [
  { value: 'stroke', label: 'Stroke Play' },
  { value: 'stableford', label: 'Stableford' },
  { value: 'match', label: 'Match Play' },
]

interface Props {
  event: TournamentEvent
  onUpdate: (updated: TournamentEvent) => void
}

export default function EventSettings({ event, onUpdate }: Props) {
  const [name, setName] = useState(event.name)
  const [format, setFormat] = useState<TournamentFormat | null>(event.config?.format ?? null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  const [locking, setLocking] = useState(false)

  const isLocked = event.status === 'completed' || event.status === 'archived'
  const isDirty = name !== event.name || format !== (event.config?.format ?? null)

  const handleSave = useCallback(async () => {
    if (!isDirty || isLocked) return
    setSaving(true)
    setSaveError(null)
    try {
      const { error: nameErr } = await db
        .from('tournaments')
        .update({ name: name.trim() })
        .eq('id', event.id)
      if (nameErr) throw nameErr

      if (event.config && format !== event.config.format) {
        const { error: fmtErr } = await db
          .from('tournament_config')
          .update({ format })
          .eq('tournament_id', event.id)
        if (fmtErr) throw fmtErr
      }

      onUpdate({
        ...event,
        name: name.trim(),
        config: event.config ? { ...event.config, format } : null,
      })
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [isDirty, isLocked, name, format, event, onUpdate])

  const handleLockResults = useCallback(async () => {
    setLocking(true)
    try {
      const { error: err } = await db
        .from('tournaments')
        .update({ status: 'completed' })
        .eq('id', event.id)
      if (err) throw err
      onUpdate({ ...event, status: 'completed' })
    } catch {
      // non-fatal; status stays active
    } finally {
      setLocking(false)
      setShowLockConfirm(false)
    }
  }, [event, onUpdate])

  return (
    <div className="px-4 py-4 flex flex-col gap-5">
      {/* Event Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="event-name" className="text-sm font-medium text-gray-700">
          Event Name
        </label>
        <input
          id="event-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLocked}
          className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full disabled:bg-[#f5f0e8] disabled:text-warm-gray"
        />
      </div>

      {/* Format */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">Format</span>
        <div className="flex gap-2 flex-wrap">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={isLocked}
              onClick={() => setFormat(opt.value)}
              className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-colors min-h-[44px] ${
                format === opt.value
                  ? 'bg-[#2d5a27] border-[#2d5a27] text-white'
                  : 'bg-white border-[#e5e1d8] text-gray-700'
              } disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      {!isLocked && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px] active:scale-95 transition-transform disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saveError && <p className="text-sm text-red-600 text-center">{saveError}</p>}
        </div>
      )}

      {/* Lock Results */}
      <div className="border-t border-[#e5e1d8] pt-4 mt-2">
        {isLocked ? (
          <div className="bg-[#eaf4e8] rounded-xl px-4 py-3 text-center">
            <p className="text-[#2d5a27] font-semibold text-sm">Results are locked.</p>
            <p className="text-warm-gray text-xs mt-1">This event has been finalized.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLockConfirm(true)}
            className="w-full bg-red-600 text-white rounded-xl py-4 text-base font-bold min-h-[56px] active:scale-95 transition-transform"
          >
            Lock Results
          </button>
        )}
      </div>

      {showLockConfirm && (
        <ConfirmModal
          title="Lock Results"
          message="This will finalize all results. This cannot be undone."
          confirmLabel={locking ? 'Locking…' : 'Lock Results'}
          destructive
          onConfirm={handleLockResults}
          onCancel={() => setShowLockConfirm(false)}
        />
      )}
    </div>
  )
}
