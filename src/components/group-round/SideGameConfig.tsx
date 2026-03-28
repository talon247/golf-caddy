import { useState, useCallback } from 'react'
import type { SideGameConfig, SideGameType } from '../../types'
import { useGroupRoundStore } from '../../store/groupRoundStore'

const DEFAULT_CONFIG: SideGameConfig = {
  sideGamesEnabled: false,
  gameTypes: [],
  stakePerSkin: null,
  nassauStakeFront: null,
  nassauStakeBack: null,
  nassauStakeOverall: null,
  pressEnabled: true,
  pressTriggerThreshold: 2,
}

interface Props {
  onBack: () => void
  onStartRound: (config: SideGameConfig) => void
  submitting: boolean
}

function parseStake(raw: string): number | null {
  const n = parseFloat(raw)
  return raw.trim() === '' || isNaN(n) ? null : n
}

export default function SideGameConfig({ onBack, onStartRound, submitting }: Props) {
  const [config, setConfig] = useState<SideGameConfig>(DEFAULT_CONFIG)
  const locked = useGroupRoundStore((s) => s.sideGameConfigLocked)

  const toggleEnabled = useCallback(() => {
    setConfig((prev) => ({ ...prev, sideGamesEnabled: !prev.sideGamesEnabled }))
  }, [])

  const toggleGameType = useCallback((type: SideGameType) => {
    setConfig((prev) => {
      const has = prev.gameTypes.includes(type)
      return {
        ...prev,
        gameTypes: has ? prev.gameTypes.filter((t) => t !== type) : [...prev.gameTypes, type],
      }
    })
  }, [])

  const hasGame = (type: SideGameType) => config.gameTypes.includes(type)
  const nassauActive = hasGame('nassau')
  const skinsActive = hasGame('skins')
  const pressActive = hasGame('press')

  return (
    <main className="flex flex-col flex-1 p-6 pb-20 gap-6 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-[#2d5a27] font-semibold touch-target"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-black text-forest">Side Games</h1>
      </div>

      {locked && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-amber-800 text-sm font-medium">
          <span aria-hidden>🔒</span>
          Config locked — scores have been entered and the setup can no longer be changed.
        </div>
      )}

      {/* Enable toggle */}
      <div className="bg-white rounded-2xl border border-[#e5e1d8] p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-[#1a1a1a]">Enable Side Games</p>
          <p className="text-xs text-gray-500 mt-0.5">Skins, Nassau, Stableford</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.sideGamesEnabled}
          onClick={locked ? undefined : toggleEnabled}
          disabled={locked}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
            config.sideGamesEnabled ? 'bg-[#2d5a27]' : 'bg-gray-300'
          } ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              config.sideGamesEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {config.sideGamesEnabled && (
        <div className="flex flex-col gap-4">
          {/* Skins */}
          <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
            <button
              type="button"
              onClick={locked ? undefined : () => toggleGameType('skins')}
              disabled={locked}
              className={`w-full flex items-center justify-between px-4 py-3 min-h-[48px] ${locked ? 'cursor-not-allowed' : ''}`}
            >
              <span className="font-semibold text-[#1a1a1a]">Skins</span>
              <CheckboxIcon checked={skinsActive} />
            </button>
            {skinsActive && (
              <div className="px-4 pb-4 flex flex-col gap-2 border-t border-[#e5e1d8] pt-3">
                <label className="text-sm font-medium text-gray-700" htmlFor="stake-per-skin">
                  Stake per skin <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                  <input
                    id="stake-per-skin"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.50"
                    value={config.stakePerSkin ?? ''}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, stakePerSkin: parseStake(e.target.value) }))
                    }
                    placeholder="0.00"
                    disabled={locked}
                    readOnly={locked}
                    className={`w-full py-3 pl-8 pr-4 rounded-xl border-2 border-[#e5e1d8] bg-white text-[#1a1a1a] font-medium focus:outline-none focus:border-[#2d5a27] ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Nassau */}
          <div className="bg-white rounded-2xl border border-[#e5e1d8] overflow-hidden">
            <button
              type="button"
              onClick={locked ? undefined : () => toggleGameType('nassau')}
              disabled={locked}
              className={`w-full flex items-center justify-between px-4 py-3 min-h-[48px] ${locked ? 'cursor-not-allowed' : ''}`}
            >
              <span className="font-semibold text-[#1a1a1a]">Nassau</span>
              <CheckboxIcon checked={nassauActive} />
            </button>
            {nassauActive && (
              <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#e5e1d8] pt-3">
                {(
                  [
                    { id: 'nassau-front', label: 'Front 9 stake', key: 'nassauStakeFront' as const },
                    { id: 'nassau-back', label: 'Back 9 stake', key: 'nassauStakeBack' as const },
                    { id: 'nassau-overall', label: 'Overall stake', key: 'nassauStakeOverall' as const },
                  ] as const
                ).map(({ id, label, key }) => (
                  <div key={id} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700" htmlFor={id}>
                      {label} <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                      <input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.50"
                        value={config[key] ?? ''}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, [key]: parseStake(e.target.value) }))
                        }
                        placeholder="0.00"
                        disabled={locked}
                        readOnly={locked}
                        className={`w-full py-3 pl-8 pr-4 rounded-xl border-2 border-[#e5e1d8] bg-white text-[#1a1a1a] font-medium focus:outline-none focus:border-[#2d5a27] ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>
                ))}

                {/* Press (sub-option of Nassau) */}
                <div className="mt-1 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={locked ? undefined : () => toggleGameType('press')}
                    disabled={locked}
                    className={`flex items-center justify-between min-h-[40px] ${locked ? 'cursor-not-allowed' : ''}`}
                  >
                    <span className="text-sm font-medium text-gray-700">Press</span>
                    <CheckboxIcon checked={pressActive} />
                  </button>
                  {pressActive && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-gray-700">Trigger when down by</span>
                      <div className="flex gap-2">
                        {[1, 2, 3].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={locked ? undefined : () =>
                              setConfig((prev) => ({ ...prev, pressTriggerThreshold: n }))
                            }
                            disabled={locked}
                            className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm transition-colors ${
                              config.pressTriggerThreshold === n
                                ? 'bg-[#2d5a27] border-[#2d5a27] text-white'
                                : 'bg-white border-[#e5e1d8] text-[#1a1a1a]'
                            } ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stableford */}
          <div className="bg-white rounded-2xl border border-[#e5e1d8]">
            <button
              type="button"
              onClick={locked ? undefined : () => toggleGameType('stableford')}
              disabled={locked}
              className={`w-full flex items-center justify-between px-4 py-3 min-h-[48px] ${locked ? 'cursor-not-allowed' : ''}`}
            >
              <span className="font-semibold text-[#1a1a1a]">Stableford</span>
              <CheckboxIcon checked={hasGame('stableford')} />
            </button>
          </div>
        </div>
      )}

      <div className="mt-auto">
        <button
          type="button"
          onClick={locked ? undefined : () => onStartRound(config)}
          disabled={submitting || locked}
          className="w-full py-4 rounded-xl bg-[#2d5a27] text-white text-lg font-bold min-h-[56px] active:scale-95 transition-transform disabled:opacity-60"
        >
          {submitting ? 'Starting…' : locked ? 'Round in Progress' : 'Start Round'}
        </button>
      </div>
    </main>
  )
}

function CheckboxIcon({ checked }: { checked: boolean }) {
  return (
    <span
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
        checked ? 'bg-[#2d5a27] border-[#2d5a27]' : 'border-gray-300'
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  )
}
