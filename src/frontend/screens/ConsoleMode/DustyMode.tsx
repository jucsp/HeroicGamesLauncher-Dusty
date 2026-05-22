import './index.scss'
import './DustyMode.scss'

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'

import ContextProvider from 'frontend/state/ContextProvider'
import { getGameInfo, sendKill, updateGame } from 'frontend/helpers'
import { timestampStore } from 'frontend/helpers/electronStores'
import HeroicIcon from 'frontend/assets/heroic-icon.svg?react'
import bgAsset from 'frontend/assets/dusty/background_clean.png'
import exodiaAsset from 'frontend/assets/dusty/exodia.png'
import stormtrooperAsset from 'frontend/assets/dusty/stormtrooper.png'
import pcCdRomHorizontalImg from 'frontend/assets/dusty/PC_CD-ROM_horizontal.png'
import epicImg from 'frontend/assets/dusty/epic.png'
import battleImg from 'frontend/assets/dusty/battle.png'
import gogImg from 'frontend/assets/dusty/gog.png'
import steamImg from 'frontend/assets/dusty/steam.png'
import esrbTeenImg from 'frontend/assets/dusty/ESRB_Teen.png'
import { CachedImage } from 'frontend/components/UI'

import ConfirmDialog from './components/ConfirmDialog'
import ConsoleCard from './components/ConsoleCard'
import ControllerHints from './components/ControllerHints'
import LaunchOverlay from './components/LaunchOverlay'
import InstallOverlay from './InstallOverlay'
import {
  BTN_L1,
  BTN_R1,
  BTN_R2,
  getActionButtonLabel,
  getBackButtonLabel
} from './controller'
import { useGamepadButtonPress, useGamepadInfo } from './hooks'

import type { TFunction } from 'i18next'
import type { GameInfo, Runner } from 'common/types'

type StoreKey = Runner | 'all'

const EMPTY_SLOTS = 40

const convertMinsToHrsMins = (mins: number) => {
  let h: string | number = Math.floor(mins / 60)
  let m: string | number = mins % 60
  h = h < 10 ? '0' + h : h
  m = m < 10 ? '0' + m : m
  return `${h}h ${m}m`
}

const CANCEL_DOWNLOAD_COPY = {
  update: {
    title: (t: TFunction) => t('console.cancelUpdate.title', 'Cancel update?'),
    message: (t: TFunction) =>
      t(
        'console.cancelUpdate.message',
        'This game is currently downloading. Cancel the ongoing update?'
      )
  },
  install: {
    title: (t: TFunction) =>
      t('console.cancelInstall.title', 'Cancel installation?'),
    message: (t: TFunction) =>
      t(
        'console.cancelInstall.message',
        'This game is currently installing. Cancel the installation?'
      )
  }
} as const

export default function DustyMode() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    epic,
    gog,
    amazon,
    zoom,
    libraryStatus,
    sideloadedLibrary,
    refreshLibrary,
    refreshing,
    gameUpdates
  } = useContext(ContextProvider)

  const [activeStore, setActiveStore] = useState<StoreKey>('all')
  const [ascending, setAscending] = useState(true)
  const [filteringByInstalled, setFilteringByInstalled] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [launchingGame, setLaunchingGame] = useState<GameInfo | null>(null)
  const [installingGame, setInstallingGame] = useState<GameInfo | null>(null)
  const [updateNoticeGame, setUpdateNoticeGame] = useState<GameInfo | null>(
    null
  )
  const [cancelDownloadGame, setCancelDownloadGame] = useState<{
    game: GameInfo
    kind: 'install' | 'update'
  } | null>(null)
  const [queuedNoticeGame, setQueuedNoticeGame] = useState<GameInfo | null>(
    null
  )
  const [focusedGameInfo, setFocusedGameInfo] = useState<GameInfo | null>(null)
  const [focusedDesc, setFocusedDesc] = useState<string>('')

  const { connected: gamepadConnected, layout: controllerLayout } =
    useGamepadInfo()
  const backButtonLabel = getBackButtonLabel(controllerLayout)
  const actionButtonLabel = getActionButtonLabel(controllerLayout)

  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const gridRef = useRef<HTMLDivElement | null>(null)
  const topBarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.api.setFullscreen(true)
    if (
      !refreshing &&
      epic.library.length === 0 &&
      gog.library.length === 0 &&
      amazon.library.length === 0 &&
      zoom.library.length === 0
    ) {
      void refreshLibrary({ runInBackground: true })
    }
    return () => {
      window.api.setFullscreen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allGames = useMemo<GameInfo[]>(() => {
    const all: GameInfo[] = [
      ...epic.library,
      ...gog.library,
      ...amazon.library,
      ...zoom.library,
      ...sideloadedLibrary
    ]
    return all.filter((g) => !g.install?.is_dlc && !g.thirdPartyManagedApp)
  }, [
    epic.library,
    gog.library,
    amazon.library,
    zoom.library,
    sideloadedLibrary
  ])

  const visibleGames = useMemo(() => {
    // reset card refs to rebuild them
    cardRefs.current = []

    let filteredGames = allGames

    if (filteringByInstalled) {
      filteredGames = filteredGames.filter((g) => g.is_installed)
    }

    if (activeStore !== 'all') {
      filteredGames = filteredGames.filter((g) => g.runner === activeStore)
    }

    return filteredGames.sort((a, b) => {
      const cmp = a.title.localeCompare(b.title)
      return ascending ? cmp : -cmp
    })
  }, [allGames, filteringByInstalled, activeStore, ascending])

  useEffect(() => {
    const game = visibleGames[focusedIndex]
    if (!game) {
      setFocusedGameInfo(null)
      return
    }
    setFocusedGameInfo(null)
    getGameInfo(game.app_name, game.runner)
      .then((info) => setFocusedGameInfo(info ?? game))
      .catch(() => setFocusedGameInfo(game))
  }, [focusedIndex, visibleGames])

  useEffect(() => {
    const game = visibleGames[focusedIndex]
    if (!game) {
      setFocusedDesc('')
      return
    }
    setFocusedDesc('...')
    window.api
      .getExtraInfo(game.app_name, game.runner)
      .then((extra) => {
        if (!extra) {
          setFocusedDesc('')
          return
        }
        const title = game.overrides?.title || game.title
        const desc =
          extra.about?.shortDescription ||
          (extra.about?.description && extra.about.description !== title
            ? extra.about.description
            : '') ||
          ''
        setFocusedDesc(desc)
      })
      .catch(() => setFocusedDesc(''))
  }, [focusedIndex, visibleGames])

  const storesWithGames = useMemo(() => {
    const set = new Set<Runner>()
    for (const g of allGames) set.add(g.runner)
    return set
  }, [allGames])

  const storeFilters = useMemo<
    { key: StoreKey; label: string; enabled: boolean }[]
  >(
    () => [
      {
        key: 'all',
        label: t('console.filter.all', 'All'),
        enabled: allGames.length > 0
      },
      {
        key: 'legendary',
        label: 'Epic',
        enabled: storesWithGames.has('legendary')
      },
      { key: 'gog', label: 'GOG', enabled: storesWithGames.has('gog') },
      { key: 'nile', label: 'Amazon', enabled: storesWithGames.has('nile') },
      {
        key: 'sideload',
        label: t('console.filter.sideload', 'Other'),
        enabled: storesWithGames.has('sideload')
      },
      { key: 'zoom', label: 'ZOOM', enabled: storesWithGames.has('zoom') }
    ],
    [t, storesWithGames, allGames.length]
  )

  const enabledStoreKeys = useMemo(
    () => storeFilters.filter((f) => f.enabled).map((f) => f.key),
    [storeFilters]
  )

  useEffect(() => {
    if (activeStore !== 'all' && !enabledStoreKeys.includes(activeStore)) {
      setActiveStore('all')
    }
  }, [enabledStoreKeys, activeStore])

  useEffect(() => {
    // always make sane focused index
    if (focusedIndex >= visibleGames.length || focusedIndex < 0) {
      setFocusedIndex(
        Math.max(0, Math.min(focusedIndex, visibleGames.length - 1))
      )
    }
  }, [visibleGames.length, focusedIndex])

  useEffect(() => {
    const btn = cardRefs.current[focusedIndex]
    if (!btn) return

    if (document.activeElement !== btn) {
      btn.focus({ preventScroll: true })
    }

    // Usar el spineSlotWrap (padre del btn) como target del scroll
    // scrollIntoView sobre el contenedor directo del grid funciona mejor
    const slot = btn.closest<HTMLElement>('.spineSlotWrap') ?? btn
    slot.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest'
    })
  }, [focusedIndex, visibleGames.length])

  const cycleStore = useCallback(
    (direction: 1 | -1) => {
      if (enabledStoreKeys.length === 0) return
      const idx = enabledStoreKeys.indexOf(activeStore)
      const next =
        (idx + direction + enabledStoreKeys.length) % enabledStoreKeys.length
      setActiveStore(enabledStoreKeys[next])
    },
    [enabledStoreKeys, activeStore]
  )

  const quit = useCallback(() => navigate('/'), [navigate])

  const idle =
    !launchingGame &&
    !installingGame &&
    !updateNoticeGame &&
    !cancelDownloadGame &&
    !queuedNoticeGame

  const activateGame = useCallback(
    (game: GameInfo) => {
      if (!idle) return
      const status = libraryStatus.find(
        (g) => g.appName === game.app_name
      )?.status
      if (status === 'queued') {
        setQueuedNoticeGame(game)
        return
      }
      if (status === 'installing') {
        setCancelDownloadGame({ game, kind: 'install' })
        return
      }
      if (status === 'updating') {
        setCancelDownloadGame({ game, kind: 'update' })
        return
      }
      if (!game.is_installed) {
        setInstallingGame(game)
        return
      }
      if (gameUpdates.includes(game.app_name)) {
        setUpdateNoticeGame(game)
        return
      }
      setLaunchingGame(game)
    },
    [idle, libraryStatus, gameUpdates]
  )

  const handleUpdateFromNotice = useCallback(() => {
    if (!updateNoticeGame) return
    const game = updateNoticeGame
    setUpdateNoticeGame(null)
    if (game.runner !== 'sideload') {
      void updateGame({
        appName: game.app_name,
        runner: game.runner as Runner,
        gameInfo: game
      })
    }
  }, [updateNoticeGame])

  const handleLaunchWithoutUpdate = useCallback(() => {
    if (!updateNoticeGame) return
    const game = updateNoticeGame
    setUpdateNoticeGame(null)
    setLaunchingGame(game)
  }, [updateNoticeGame])

  const dismissUpdateNotice = useCallback(() => setUpdateNoticeGame(null), [])

  const handleCancelDownload = useCallback(() => {
    if (!cancelDownloadGame) return
    const { game } = cancelDownloadGame
    setCancelDownloadGame(null)
    void sendKill(game.app_name, game.runner)
  }, [cancelDownloadGame])

  const dismissCancelDownload = useCallback(
    () => setCancelDownloadGame(null),
    []
  )

  const handleRemoveFromQueue = useCallback(() => {
    if (!queuedNoticeGame) return
    const game = queuedNoticeGame
    setQueuedNoticeGame(null)
    window.localStorage.removeItem(game.app_name)
    void window.api.removeFromDMQueue(game.app_name)
  }, [queuedNoticeGame])

  const dismissQueuedNotice = useCallback(() => setQueuedNoticeGame(null), [])

  const onTopBarKeyDown = (e: React.KeyboardEvent) => {
    if (!idle) return
    const root = topBarRef.current
    if (!root) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      cardRefs.current[focusedIndex]?.focus()
      return
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const btns = Array.from(
        root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      )
      const active = document.activeElement as HTMLButtonElement | null
      const idx = active ? btns.indexOf(active) : -1
      if (idx === -1 || btns.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.key === 'ArrowRight' ? 1 : -1
      const next = (idx + delta + btns.length) % btns.length
      btns[next].focus()
    }
  }

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (visibleGames.length === 0 || !idle) return
    const last = visibleGames.length - 1

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
      setFocusedIndex((i) => Math.min(i + 1, last))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      e.stopPropagation()
      setFocusedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'ArrowDown') {
      // Jump forward 5 spines (like page-right on a shelf)
      e.preventDefault()
      e.stopPropagation()
      setFocusedIndex((i) => Math.min(i + 5, last))
    } else if (e.key === 'ArrowUp') {
      // Jump back 5 spines
      e.preventDefault()
      e.stopPropagation()
      if (focusedIndex < 5) {
        const first = topBarRef.current?.querySelector<HTMLButtonElement>(
          'button:not(:disabled)'
        )
        first?.focus()
      } else {
        setFocusedIndex((i) => Math.max(i - 5, 0))
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const g = visibleGames[focusedIndex]
      if (g) activateGame(g)
    }
  }

  // Esc quits when idle. While a game is launching or a dialog is open,
  // the overlay/dialog handles Esc itself.
  useEffect(() => {
    if (!idle) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      quit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [quit, idle])

  // Read by gamepad.ts to block the Guide/back buttons during launch.
  useEffect(() => {
    if (!launchingGame) return
    document.body.classList.add('console-launching')
    return () => document.body.classList.remove('console-launching')
  }, [launchingGame])

  const toggleSort = useCallback(() => setAscending((v) => !v), [])

  useGamepadButtonPress(BTN_L1, () => cycleStore(-1), idle)
  useGamepadButtonPress(BTN_R1, () => cycleStore(1), idle)
  useGamepadButtonPress(BTN_R2, toggleSort, idle)

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })
  useEffect(() => {
    const handler = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  const { width: windowWidth, height: windowHeight } = windowSize

  const BG_W = 2750
  const BG_H = 1568

  const scaledPosition = (
    x: number,
    y: number,
    w: number,
    h: number
  ): React.CSSProperties => {
    const scaleX = windowWidth / BG_W
    const scaleY = windowHeight / BG_H
    return {
      position: 'absolute',
      left: `${x * scaleX}px`,
      top: `${y * scaleY}px`,
      width: `${w * scaleX}px`,
      height: `${h * scaleY}px`
    }
  }

  const scaledCharacter = (
    x: number,
    yBottom: number,
    w: number,
    h: number
  ): React.CSSProperties => {
    const scaleX = windowWidth / BG_W
    const scaleY = windowHeight / BG_H
    const scale = Math.min(scaleX, scaleY)
    const scaledW = w * scale
    const scaledH = h * scale
    // Anclar al piso: yBottom es la coordenada Y del borde inferior
    // del personaje en el canvas original
    const bottomPx = (BG_H - yBottom) * scaleY
    return {
      position: 'absolute',
      left: `${x * scaleX}px`,
      bottom: `${bottomPx}px`,
      width: `${scaledW}px`,
      height: `${scaledH}px`,
    }
  }

  return (
    <div
      className={classNames('ConsoleMode', 'ConsoleMode--dusty', {
        launching: !!launchingGame
      })}
    >
      {/* Fondo completo */}
      <img src={bgAsset} className="dusty-bg" alt="" />

      <div
        style={{
          ...scaledCharacter(430, 855, 363, 315),
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        <img
          src={exodiaAsset}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-8px',
            left: '8%',
            width: '84%',
            height: '28px',
            background: 'radial-gradient(ellipse at 50% 10%, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 40%, transparent 70%)',
            filter: 'blur(6px)',
            transform: 'scaleY(0.6)',
          }}
        />
      </div>
      <div
        style={{
          ...scaledCharacter(1488, 840, 130, 185),
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        <img
          src={stormtrooperAsset}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-6px',
            left: '12%',
            width: '76%',
            height: '22px',
            background: 'radial-gradient(ellipse at 50% 10%, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 40%, transparent 70%)',
            filter: 'blur(5px)',
            transform: 'scaleY(0.6)',
          }}
        />
      </div>

      {/* Menú superior — bg coords: x=63, y=109, w=2632, h=144 */}
      <div
        className="consoleTopBar"
        ref={topBarRef}
        onKeyDown={onTopBarKeyDown}
        style={scaledPosition(63, 109, 2632, 144)}
      >
        <HeroicIcon className="consoleLogo" />
        <div className="consoleFilters">
          <button
            key={'installedGames'}
            className={classNames('consoleChip', {
              active: filteringByInstalled
            })}
            onClick={() => setFilteringByInstalled(!filteringByInstalled)}
          >
            {t('status.installed', 'Instalado')}
          </button>
          <div className="consoleDividerVertical" />
          {storeFilters
            .filter((f) => f.enabled)
            .map((f) => (
              <button
                key={f.key}
                className={classNames('consoleChip', {
                  active: activeStore === f.key
                })}
                onClick={() => setActiveStore(f.key)}
                disabled={!!launchingGame}
              >
                {f.label}
              </button>
            ))}
        </div>
        <div className="consoleTopRight">
          <button
            className="consoleChip"
            onClick={toggleSort}
            aria-label={t('console.sort', 'Sort')}
            disabled={!!launchingGame}
          >
            {ascending ? 'A → Z' : 'Z → A'}
          </button>
          <button
            className="consoleQuitButton"
            onClick={quit}
            disabled={!!launchingGame}
          >
            {t('console.quit', 'Quit Console')}
          </button>
          <button
            className="consoleQuitButton danger"
            onClick={() => window.api.quit()}
            disabled={!!launchingGame}
          >
            {t('console.quitApp', 'Quit App')}
          </button>
        </div>
      </div>

      {/* Área disco + carátula — bg coords: x=835, y=362, w=528, h=479 */}
      <div className="dustyDiscArea" style={scaledPosition(835, 362, 528, 479)}>
        {visibleGames[focusedIndex] &&
          (() => {
            const game = visibleGames[focusedIndex]
            const coverUrl =
              game.overrides?.art_square ||
              game.art_square ||
              game.art_cover ||
              ''
            const STORE_LOGOS: Record<string, string> = {
              legendary: epicImg,
              gog: gogImg,
              sideload: steamImg,
              nile: battleImg,
            }
            const storeLogoImg = STORE_LOGOS[game.runner] ?? pcCdRomHorizontalImg
            return (
              <>
                {/* Carátula */}
                <div style={{ position: 'relative', height: '100%', flexShrink: 0, display: 'flex', alignItems: 'flex-end' }}>
                  <div className="dustyBoxCase">
                    <div className="dustyBoxArtWrap">
                      <CachedImage className="dustyBoxArt" src={coverUrl} key={`art-${game.app_name}`} alt="" />
                      <div className="dustyBoxSheen" />
                      <div className="dustyBoxCornerTL" key={`corner-tl-${game.app_name}`}>
                        <img src={pcCdRomHorizontalImg} alt="PC CD-ROM" />
                      </div>
                      <div className="dustyBoxCornerBL" key={`corner-bl-${game.app_name}`}>
                        <img src={storeLogoImg} alt="store" />
                      </div>
                      <div className="dustyBoxCornerBR" key={`corner-br-${game.app_name}`}>
                        <img src={esrbTeenImg} alt="ESRB Teen" />
                      </div>
                    </div>
                  </div>
                  {/* Sombra trasera carátula */}
                  <div className="dustyBoxShadowBack" />
                </div>

                {/* Disco */}
                <div className="dustyDiscWrapper">
                  <div className="dustyDisc" key={`disc-${game.app_name}`}>
                    <div className="dustyDiscSurface">
                      <div className="dustyDiscTracks" />
                      <div className="dustyDiscLabel">
                        <CachedImage src={coverUrl} alt={game.title} className="dustyDiscLabelArt" />
                        <div className="dustyDiscLabelOverlay" />
                        <div className="dustyDiscHub" />
                        <div className="dustyDiscHole" />
                      </div>
                      <div className="dustyDiscSheen" />
                    </div>
                  </div>
                  {/* Sombra trasera disco */}
                  <div className="dustyDiscShadowBack" />
                </div>
              </>
            )
          })()}
      </div>

      {/* Área TV descripción — bg coords: x=1960, y=349, w=616, h=449 */}
      <div className="dustyTVArea" style={scaledPosition(1960, 349, 616, 449)}>
        {visibleGames[focusedIndex] &&
          (() => {
            const game = visibleGames[focusedIndex]
            const info = focusedGameInfo ?? game
            const tsInfo = timestampStore.get_nodefault(game.app_name)
            const totalPlayed = tsInfo?.totalPlayed
              ? convertMinsToHrsMins(tsInfo.totalPlayed)
              : null
            const lastPlayed = tsInfo?.lastPlayed
              ? new Intl.DateTimeFormat(undefined, {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric'
                }).format(new Date(tsInfo.lastPlayed))
              : null
            return (
              <div className="tv-screen" key={`detail-${game.app_name}`}>
                <h2 className="dustyDetailTitle">
                  {game.overrides?.title || game.title}
                </h2>
                {info.developer && (
                  <p className="dustyDetailDev">{info.developer}</p>
                )}

                <div className="tv-body">
                  <div className="tv-body-left">
                    <p className="dustyDetailDesc">{focusedDesc}</p>
                  </div>

                  <div className="tv-body-right">
                    {totalPlayed && (
                      <div className="tv-meta">
                        <span className="tv-meta-label">JUGADO</span>
                        <span className="tv-meta-val ok">{totalPlayed}</span>
                      </div>
                    )}
                    {lastPlayed && (
                      <div className="tv-meta">
                        <span className="tv-meta-label">ÚLTIMA VEZ</span>
                        <span className="tv-meta-val">{lastPlayed}</span>
                      </div>
                    )}
                    <div className="tv-meta">
                      <span className="tv-meta-label">ESTADO</span>
                      <span
                        className={`tv-meta-val ${game.is_installed ? 'ok' : ''}`}
                      >
                        {game.is_installed
                          ? t('status.installed', 'Instalado')
                          : t('game.notInstalled', 'No instalado')}
                      </span>
                    </div>
                    <button
                      className="tv-play-btn"
                      onClick={() => activateGame(game)}
                      disabled={!idle}
                    >
                      {game.is_installed
                        ? `▶ ${t('label.playing.start', 'Jugar')}`
                        : `↓ ${t('game.install', 'Instalar')}`}
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
      </div>

      {/* Área shelf/lomos — bg coords: x=77, y=979, w=2608, h=448 */}
      <div
        className="dustyShelfArea"
        style={scaledPosition(77, 979, 2608, 448)}
      >
        {visibleGames.length === 0 ? (
          <div className="consoleEmpty">
            {refreshing
              ? t('console.loading', 'Loading your library…')
              : t(
                  'console.empty',
                  'No installed games to show. Install something first.'
                )}
          </div>
        ) : (
          <div
            className="consoleGridScroller"
            ref={gridRef}
            role="listbox"
            aria-label={t('console.games', 'Installed games')}
            onKeyDown={onGridKeyDown}
          >
            <div className="consoleGrid">
              {visibleGames.map((game, i) => {
                const isFocused = i === focusedIndex
                return (
                  <div
                    key={`slot-${game.runner}-${game.app_name}`}
                    className={classNames('spineSlotWrap', {
                      focused: isFocused
                    })}
                  >
                    <ConsoleCard
                      ref={(el) => {
                        cardRefs.current[i] = el
                      }}
                      game={game}
                      focused={isFocused}
                      needsUpdate={gameUpdates.includes(game.app_name)}
                      onClick={() => {
                        if (isFocused) activateGame(game)
                        else setFocusedIndex(i)
                      }}
                      onMouseEnter={() => setFocusedIndex(i)}
                      onFocus={() => setFocusedIndex(i)}
                    />
                  </div>
                )
              })}
              {Array.from({ length: EMPTY_SLOTS }).map((_, i) => (
                <div
                  key={`empty-slot-${i}`}
                  className="spineSlotWrap spineSlotEmpty"
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="consoleFooter">
        {gamepadConnected && !launchingGame && (
          <ControllerHints layout={controllerLayout} />
        )}
      </div>

      {launchingGame && (
        <LaunchOverlay
          game={launchingGame}
          onDismiss={() => setLaunchingGame(null)}
        />
      )}

      {installingGame && (
        <InstallOverlay
          game={installingGame}
          onDismiss={() => setInstallingGame(null)}
        />
      )}

      {updateNoticeGame && (
        <ConfirmDialog
          title={t('gamepage:box.update.title')}
          message={t('gamepage:box.update.message')}
          gameTitle={updateNoticeGame.title}
          confirmLabel={t('gamepage:box.yes')}
          cancelLabel={t('gamepage:box.no')}
          dismissLabel={t('button.cancel', 'Cancel')}
          onConfirm={handleUpdateFromNotice}
          onCancel={handleLaunchWithoutUpdate}
          onDismiss={dismissUpdateNotice}
          gamepadConnected={gamepadConnected}
          backButtonLabel={backButtonLabel}
          actionButtonLabel={actionButtonLabel}
        />
      )}

      {cancelDownloadGame && (
        <ConfirmDialog
          title={CANCEL_DOWNLOAD_COPY[cancelDownloadGame.kind].title(t)}
          message={CANCEL_DOWNLOAD_COPY[cancelDownloadGame.kind].message(t)}
          gameTitle={cancelDownloadGame.game.title}
          confirmLabel={t('gamepage:box.yes')}
          cancelLabel={t('gamepage:box.no')}
          onConfirm={handleCancelDownload}
          onCancel={dismissCancelDownload}
          gamepadConnected={gamepadConnected}
          backButtonLabel={backButtonLabel}
          actionButtonLabel={actionButtonLabel}
        />
      )}

      {queuedNoticeGame && (
        <ConfirmDialog
          title={t('gamepage:button.queue.remove')}
          message={t(
            'console.removeFromQueue.message',
            'This game is queued for download. Remove it from the queue?'
          )}
          gameTitle={queuedNoticeGame.title}
          confirmLabel={t('gamepage:box.yes')}
          cancelLabel={t('gamepage:box.no')}
          onConfirm={handleRemoveFromQueue}
          onCancel={dismissQueuedNotice}
          gamepadConnected={gamepadConnected}
          backButtonLabel={backButtonLabel}
          actionButtonLabel={actionButtonLabel}
        />
      )}
    </div>
  )
}
