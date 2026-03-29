import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../ConfirmModal'
import type { TournamentEvent } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tournament tables pending THEA-417
const db = supabase as unknown as any

interface Props {
  league: TournamentEvent
  onUpdate: (updated: TournamentEvent) => void
}

export default function LeagueSettingsTab({ league, onUpdate }: Props) {
  const [name, setName] = useState(league.name)
  const [startDate, setStartDate] = useState<string>(league.config?.start_date ?? '')
  const [endDate, setEndDate] = useState<string>(league.config?.end_date ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [ending, setEnding] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const isLocked = league.status === 'completed' || league.status === 'archived'

  const isDirty =
    name !== league.name ||
    startDate !== (league.config?.start_date ?? '') ||
    endDate !== (league.config?.end_date ?? '')

  const handleSave = useCallback(async () => {
    if (!isDirty || isLocked) return
    setSaving(true)
    setSaveError(null)
    try {
      const { error: nameErr } = await db
        .from('tournaments')
        .update({ name: name.trim() })
        .eq('id', league.id)
      if (nameErr) throw nameErr

      if (league.config) {
        const { error: cfgErr } = await db
          .from('tournament_config')
          .update({
            start_date: startDate || null,
            end_date: endDate || null,
          })
          .eq('tournament_id', league.id)
        if (cfgErr) throw cfgErr
      }

      onUpdate({
        ...league,
        name: name.trim(),
        config: league.config
          ? { ...league.config, start_date: startDate || null, end_date: endDate || null }
          : null,
      })
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [isDirty, isLocked, name, startDate, endDate, league, onUpdate])

  const handleEndSeason = useCallback(async () => {
    setEnding(true)
    try {
      const { error: err } = await db
        .from('tournaments')
        .update({ status: 'completed' })
        .eq('id', league.id)
      if (err) throw err
      onUpdate({ ...league, status: 'completed' })
    } catch {
      // non-fatal
    } finally {
      setEnding(false)
      setShowEndConfirm(false)
    }
  }, [league, onUpdate])

  const handleArchive = useCallback(async () => {
    setArchiving(true)
    try {
      const { error: err } = await db
        .from('tournaments')
        .update({ status: 'archived' })
        .eq('id', league.id)
      if (err) throw err
      onUpdate({ ...league, status: 'archived' })
    } catch {
      // non-fatal
    } finally {
      setArchiving(false)
      setShowArchiveConfirm(false)
    }
  }, [league, onUpdate])

  return (
    <div className="px-4 py-4 flex flex-col gap-5">
      {/* Season Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="league-name" className="text-sm font-medium text-gray-700">Season Name</label>
        <input
          id="league-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLocked}
          className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full disabled:bg-[#f5f0e8] disabled:text-warm-gray"
        />
      </div>

      {/* Dates */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <label htmlFor="league-start" className="text-sm font-medium text-gray-700">Start Date</label>
          <input
            id="league-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isLocked}
            className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full disabled:bg-[#f5f0e8] disabled:text-warm-gray"
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <label htmlFor="league-end" className="text-sm font-medium text-gray-700">End Date</label>
          <input
            id="league-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isLocked}
            className="border border-[#e5e1d8] rounded-xl px-4 py-3 text-base bg-white text-[#1a1a1a] focus:ring-2 focus:ring-[#2d5a27] focus:border-[#2d5a27] outline-none min-h-[48px] w-full disabled:bg-[#f5f0e8] disabled:text-warm-gray"
          />
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

      {/* Season controls */}
      <div className="border-t border-[#e5e1d8] pt-4 mt-2 flex flex-col gap-3">
        {league.status === 'archived' ? (
          <div className="bg-[#eaf4e8] rounded-xl px-4 py-3 text-center">
            <p className="text-[#2d5a27] font-semibold text-sm">Season archived — historical view only.</p>
          </div>
        ) : league.status === 'completed' ? (
          <>
            <div className="bg-amber-50 rounded-xl px-4 py-3 text-center">
              <p className="text-amber-700 font-semibold text-sm">Season ended — standings locked.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowArchiveConfirm(true)}
              className="w-full bg-gray-500 text-white rounded-xl py-3 text-base font-semibold min-h-[48px] active:scale-95 transition-transform"
            >
              Archive Season
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowEndConfirm(true)}
            className="w-full bg-red-600 text-white rounded-xl py-4 text-base font-bold min-h-[56px] active:scale-95 transition-transform"
          >
            End Season
          </button>
        )}
      </div>

      {showEndConfirm && (
        <ConfirmModal
          title="End Season"
          message="This will lock all standings and declare a champion. This cannot be undone in V4."
          confirmLabel={ending ? 'Ending…' : 'End Season'}
          destructive
          onConfirm={handleEndSeason}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}

      {showArchiveConfirm && (
        <ConfirmModal
          title="Archive Season"
          message="Move this season to historical view. It will no longer appear in active leagues."
          confirmLabel={archiving ? 'Archiving…' : 'Archive'}
          destructive
          onConfirm={handleArchive}
          onCancel={() => setShowArchiveConfirm(false)}
        />
      )}
    </div>
  )
}
