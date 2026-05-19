import { forwardRef } from 'react'
import classNames from 'classnames'

import { hasStatus } from 'frontend/hooks/hasStatus'
import { hasProgress } from 'frontend/hooks/hasProgress'
import { getProgress } from 'frontend/helpers'

import type { GameInfo, Status } from 'common/types'

// Statuses that we surface as an overlay on the card. Anything outside this set
// (e.g. `installed`, `notInstalled`, `done`) is treated as idle.
const ACTIVE_STATUSES = new Set<Status>([
  'installing',
  'updating',
  'queued',
  'launching',
  'playing',
  'uninstalling',
  'moving',
  'repairing',
  'syncing-saves',
  'extracting',
  'redist',
  'winetricks'
])

type Props = {
  game: GameInfo
  focused: boolean
  needsUpdate: boolean
  onClick: () => void
  onMouseEnter: () => void
  onFocus: () => void
}

const STORE_META: Record<string, { label: string; color: string }> = {
  legendary: { label: 'EPIC', color: '#2d2d2d' },
  gog: { label: 'GOG', color: '#86328a' },
  nile: { label: 'AMAZON', color: '#ff9900' },
  zoom: { label: 'ZOOM', color: '#0070f3' },
  sideload: { label: 'CUSTOM', color: '#555555' }
}

const ConsoleCard = forwardRef<HTMLButtonElement, Props>(function ConsoleCard(
  { game, focused, needsUpdate, onClick, onMouseEnter, onFocus },
  ref
) {
  const { status, label } = hasStatus(game)
  const [progress] = hasProgress(game.app_name, game.runner)

  const isProgressing = status === 'installing' || status === 'updating'
  const percent = isProgressing
    ? Math.max(0, Math.min(100, Math.round(getProgress(progress))))
    : null
  const showStatus = !!status && ACTIVE_STATUSES.has(status)

  // Store metadata
  const store = STORE_META[game.runner] ?? { label: 'PC', color: '#444' }
  const accentColor = store.color

  // Logo URL: use art_logo if available
  const logoUrl = game.art_logo ?? null

  return (
    <button
      ref={ref}
      className={classNames('consoleCard', {
        focused,
        progressing: isProgressing
      })}
      style={{ borderLeft: `3px solid ${accentColor}` }}
      tabIndex={focused ? 0 : -1}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
    >
      {/* Left black plastic edge */}
      <div className="spineEdge" />

      {/* Main spine body */}
      <div className="spineBody">
        {/* Top: PC CD-ROM badge */}
        <div className="spineTopBadge">
          <span className="spineTopPC">PC</span>
          <span className="spineTopMedia">CD-ROM</span>
        </div>

        {/* Center: logo or title — rotated sideways like real spine */}
        <div className="spineCenterArea">
          {logoUrl ? (
            <div className="spineLogoWrap">
              <img src={logoUrl} alt={game.title} className="spineLogoImg" />
            </div>
          ) : (
            <span className="spineTitleText">
              {game.overrides?.title || game.title}
            </span>
          )}
        </div>

        {/* Bottom: store label */}
        <div className="spineBottomBadge">
          <span className="spineStoreLabel">{store.label}</span>
        </div>
      </div>

      {/* Status bar */}
      {showStatus && (
        <div className="consoleCardStatus">
          <span className="consoleCardStatusText">{label}</span>
          {isProgressing && (
            <div className="consoleCardProgress" aria-hidden>
              <div
                className="consoleCardProgressFill"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {needsUpdate && !showStatus && (
        <span className="consoleCardBadge">↑</span>
      )}
    </button>
  )
})

export default ConsoleCard
