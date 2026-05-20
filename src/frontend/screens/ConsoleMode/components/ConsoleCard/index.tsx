import { forwardRef } from 'react'
import classNames from 'classnames'
import { hasStatus } from 'frontend/hooks/hasStatus'
import { hasProgress } from 'frontend/hooks/hasProgress'
import { getProgress } from 'frontend/helpers'
import { getImageFormatting } from 'frontend/screens/Library/components/GameCard/constants'
import fallBackImage from 'frontend/assets/heroic_card.jpg'
import pcVertical from 'frontend/assets/dusty/PC_CD-ROM_vertical.png'
import esrbTeen   from 'frontend/assets/dusty/ESRB_Teen.png'
import type { GameInfo, Status } from 'common/types'

const ACTIVE_STATUSES = new Set<Status>([
  'installing','updating','queued','launching','playing',
  'uninstalling','moving','repairing','syncing-saves',
  'extracting','redist','winetricks'
])

const STORE_META: Record<string, { label: string; color: string }> = {
  legendary: { label: 'EPIC',   color: '#2a2a3a' },
  gog:       { label: 'GOG',    color: '#450055' },
  nile:      { label: 'AMAZON', color: '#4a2800' },
  zoom:      { label: 'ZOOM',   color: '#002855' },
  sideload:  { label: 'PC',     color: '#1a1a1a' },
}

type Props = {
  game: GameInfo
  focused: boolean
  needsUpdate: boolean
  onClick: () => void
  onMouseEnter: () => void
  onFocus: () => void
}

const ConsoleCard = forwardRef<HTMLButtonElement, Props>(
  function ConsoleCard(
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

    const store = STORE_META[game.runner] ?? { label: 'PC', color: '#111' }
    const logoUrl = game.art_logo ?? null

    const artUrl = getImageFormatting(game.art_square, game.runner)
      || game.art_cover
      || fallBackImage

    return (
      <button
        ref={ref}
        className={classNames('consoleCard', {
          focused,
          progressing: isProgressing
        })}
        tabIndex={focused ? 0 : -1}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
      >
        {/* Blurred art background */}
        <div
          className="spineArtBg"
          style={{ backgroundImage: `url(${artUrl})` }}
        />

        {/* Left accent stripe */}
        <div
          className="spineStripe"
          style={{ background: store.color }}
        />

        {/* Overlay content */}
        <div className="spineContent">

          {/* PC CD-ROM logo at top */}
          <div className="spinePCWrap">
            <img
              src={pcVertical}
              alt="PC CD-ROM"
              className="spinePCLogo"
            />
          </div>

          {/* Game title or logo in center */}
          <div className="spineTitleWrap">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={game.title}
                className="spineLogoImg"
              />
            ) : (
              <span className="spineTitleText">
                {game.overrides?.title || game.title}
              </span>
            )}
          </div>

          {/* ESRB badge at bottom */}
          <div className="spineESRBWrap">
            <img
              src={esrbTeen}
              alt="ESRB Teen"
              className="spineESRBLogo"
            />
          </div>

        </div>

        {/* Status overlay */}
        {showStatus && (
          <div className="consoleCardStatus">
            <span className="consoleCardStatusText">{label}</span>
            {isProgressing && percent !== null && (
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
  }
)

export default ConsoleCard
