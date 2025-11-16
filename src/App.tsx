import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import './App.css'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, RotateCcw, Info, RotateCw } from 'lucide-react'
import BackgroundVideo from '@/components/ui/BackgroundVideo'

type CellState = 'empty' | 'ship' | 'hit' | 'miss'
type GamePhase = 'title' | 'instructions' | 'placement' | 'battle' | 'gameOver'
type Orientation = 'horizontal' | 'vertical'

interface Cell {
  state: CellState
  shipId?: number
  animation?: string
}

interface MissileAnimation {
  id: number
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
  fromBoard: 'player' | 'ai'
}

interface Ship {
  id: number
  name: string
  size: number
  width: number
  length: number
  hits: number
  sunk: boolean
}

type Placement = {
  shipId: number
  name: string
  size: number
  width: number
  length: number
  startRow: number
  startCol: number
  orientation: Orientation
}

const BOARD_SIZE = 15
const CELL_SIZE = 28

const SHIPS: Omit<Ship, 'hits' | 'sunk'>[] = [
  { id: 1, name: 'Carrier', size: 14, width: 2, length: 7 },
  { id: 2, name: 'Battleship', size: 7, width: 1, length: 7 },
  { id: 3, name: 'Cruiser', size: 5, width: 1, length: 5 },
  { id: 4, name: 'Destroyer', size: 4, width: 1, length: 4 },
  { id: 5, name: 'Submarine', size: 5, width: 1, length: 5 },
  { id: 6, name: 'Rescue', size: 4, width: 1, length: 4 },
  { id: 7, name: 'Patrol', size: 2, width: 1, length: 2 },
]

const SHIP_IMG: Record<string, string> = {
  Carrier: '/ships/ShipCarrierHull.png',
  Battleship: '/ships/ShipBattleshipHull.png',
  Cruiser: '/ships/ShipCruiserHull.png',
  Submarine: '/ships/ShipSubMarineHull.png',
  Destroyer: '/ships/ShipDestroyerHull.png',
  Rescue: '/ships/ShipRescue.png',
  Patrol: '/ships/ShipPatrolHull.png',
}

function computePlacements(board: Cell[][], ships: Ship[]): Placement[] {
  const res: Placement[] = []
  for (const ship of ships) {
    const coords: [number, number][] = []
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        if (board[r][c].shipId === ship.id) coords.push([r, c])
      }
    }
    if (coords.length === 0) continue
    const rows = coords.map(([r]) => r)
    const cols = coords.map(([, c]) => c)
    const minRow = Math.min(...rows)
    const maxRow = Math.max(...rows)
    const minCol = Math.min(...cols)
    const maxCol = Math.max(...cols)
    const heightSpan = maxRow - minRow + 1
    const widthSpan = maxCol - minCol + 1
    const orientation: Orientation = widthSpan > heightSpan ? 'horizontal' : 'vertical'
    res.push({ 
      shipId: ship.id, 
      name: ship.name, 
      size: ship.size, 
      width: ship.width, 
      length: ship.length, 
      startRow: minRow, 
      startCol: minCol, 
      orientation 
    })
  }
  return res
}

function useGridMetrics(gridRef: React.RefObject<HTMLElement>, deps: unknown[]) {
  const [metrics, setMetrics] = useState({ cell: 40, offsetLeft: 0, offsetTop: 0 })
  useLayoutEffect(() => {
    const container = gridRef.current
    if (!container) return
    const firstCell = container.querySelector('[data-cell="0-0"]') as HTMLElement | null
    if (!firstCell) return
    const cellRect = firstCell.getBoundingClientRect()
    const contRect = container.getBoundingClientRect()
    setMetrics({
      cell: cellRect.width,
      offsetLeft: cellRect.left - contRect.left,
      offsetTop: cellRect.top - contRect.top,
    })
  }, deps)
  return metrics
}

const biasCache = new Map<string, { dx: number; dy: number; w: number; h: number }>()

function measureImageBias(src: string): Promise<{ dx: number; dy: number; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    if (biasCache.has(src)) {
      resolve(biasCache.get(src)!)
      return
    }
    
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight)
      const data = imageData.data
      
      let minX = img.naturalWidth, maxX = 0, minY = img.naturalHeight, maxY = 0
      
      for (let y = 0; y < img.naturalHeight; y++) {
        for (let x = 0; x < img.naturalWidth; x++) {
          const alpha = data[(y * img.naturalWidth + x) * 4 + 3]
          if (alpha > 10) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      
      const contentCenterX = (minX + maxX) / 2
      const contentCenterY = (minY + maxY) / 2
      const imageCenterX = img.naturalWidth / 2
      const imageCenterY = img.naturalHeight / 2
      const dx = contentCenterX - imageCenterX
      const dy = contentCenterY - imageCenterY
      
      const result = { dx, dy, w: img.naturalWidth, h: img.naturalHeight }
      biasCache.set(src, result)
      resolve(result)
    }
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

function ShipOverlays({
  placements,
  gridRef,
}: {
  placements: Placement[]
  gridRef: React.RefObject<HTMLElement>
}) {
  const { cell, offsetLeft, offsetTop } = useGridMetrics(gridRef, [placements])
  const [, setBiasVersion] = useState(0)
  
  useEffect(() => {
    const uniqueSrcs = [...new Set(placements.map(p => SHIP_IMG[p.name]).filter(Boolean))]
    Promise.all(uniqueSrcs.map(src => measureImageBias(src)))
      .then(() => setBiasVersion(v => v + 1))
      .catch(err => console.error('Failed to measure image bias:', err))
  }, [placements])
  
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <div
        className="absolute"
        style={{
          left: Math.round(offsetLeft),
          top: Math.round(offsetTop),
          width: Math.round(cell * BOARD_SIZE),
          height: Math.round(cell * BOARD_SIZE),
        }}
      >
        {placements.map((p) => {
          const left = Math.round(p.startCol * cell)
          const top = Math.round(p.startRow * cell)
          const footprintWidth = p.orientation === 'horizontal' ? p.length * cell : p.width * cell
          const footprintHeight = p.orientation === 'horizontal' ? p.width * cell : p.length * cell
          const src = SHIP_IMG[p.name]
          if (!src) return null
          
          const bias = biasCache.get(src)
          let corrX = 0, corrY = 0
          
          if (bias) {
            if (p.orientation === 'horizontal') {
              const displayWidth = footprintHeight
              const displayHeight = footprintWidth
              const scaleX = displayWidth / bias.w
              const scaleY = displayHeight / bias.h
              const vx = -bias.dx * scaleX
              const vy = -bias.dy * scaleY
              corrX = vx
              corrY = vy
            } else {
              const scaleX = footprintWidth / bias.w
              const scaleY = footprintHeight / bias.h
              corrX = -bias.dx * scaleX
              corrY = -bias.dy * scaleY
            }
          }
          
          if (p.orientation === 'horizontal') {
            return (
              <div
                key={p.shipId}
                className="absolute pointer-events-none flex items-center justify-center z-10"
                style={{
                  left,
                  top,
                  width: Math.round(footprintWidth),
                  height: Math.round(footprintHeight),
                  overflow: 'visible',
                }}
              >
                <div
                  style={{
                    width: Math.round(footprintHeight),
                    height: Math.round(footprintWidth),
                    transform: `translate(${corrX}px, ${corrY}px) rotate(90deg)`,
                    transformOrigin: 'center center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={src}
                    alt={`${p.name}`}
                    className="opacity-90 select-none block"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center',
                    }}
                    draggable={false}
                  />
                </div>
              </div>
            )
          } else {
            return (
              <div
                key={p.shipId}
                className="absolute pointer-events-none flex items-center justify-center z-10"
                style={{
                  left,
                  top,
                  width: Math.round(footprintWidth),
                  height: Math.round(footprintHeight),
                  overflow: 'visible',
                }}
              >
                <img
                  src={src}
                  alt={`${p.name}`}
                  className="opacity-90 select-none block"
                  style={{
                    height: '100%',
                    width: '100%',
                    objectFit: 'contain',
                    objectPosition: 'center',
                    transform: `translate(${corrX}px, ${corrY}px)`,
                  }}
                  draggable={false}
                />
              </div>
            )
          }
        })}
      </div>
    </div>
  )
}

function MissileOverlay({
  missiles,
  playerGridRef,
  aiGridRef,
}: {
  missiles: MissileAnimation[]
  playerGridRef: React.RefObject<HTMLDivElement>
  aiGridRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <>
      {missiles.map((missile) => (
        <AnimatedMissile
          key={missile.id}
          missile={missile}
          playerGridRef={playerGridRef}
          aiGridRef={aiGridRef}
        />
      ))}
    </>
  )
}

function AnimatedMissile({
  missile,
  playerGridRef,
  aiGridRef,
}: {
  missile: MissileAnimation
  playerGridRef: React.RefObject<HTMLDivElement>
  aiGridRef: React.RefObject<HTMLDivElement>
}) {
  const [position, setPosition] = useState({ x: 0, y: 0, angle: 0 })
  const playerMetrics = useGridMetrics(playerGridRef, [missile])
  const aiMetrics = useGridMetrics(aiGridRef, [missile])
  const startTimeRef = useRef<number>(Date.now())
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const fromMetrics = missile.fromBoard === 'player' ? playerMetrics : aiMetrics
    const toMetrics = missile.fromBoard === 'player' ? aiMetrics : playerMetrics
    const fromGridRef = missile.fromBoard === 'player' ? playerGridRef : aiGridRef
    const toGridRef = missile.fromBoard === 'player' ? aiGridRef : playerGridRef

    if (!fromGridRef.current || !toGridRef.current) return

    const fromGridRect = fromGridRef.current.getBoundingClientRect()
    const toGridRect = toGridRef.current.getBoundingClientRect()

    const startX = fromGridRect.left + fromMetrics.offsetLeft + missile.fromCol * fromMetrics.cell + fromMetrics.cell / 2
    const startY = fromGridRect.top + fromMetrics.offsetTop + missile.fromRow * fromMetrics.cell + fromMetrics.cell / 2
    const endX = toGridRect.left + toMetrics.offsetLeft + missile.toCol * toMetrics.cell + toMetrics.cell / 2
    const endY = toGridRect.top + toMetrics.offsetTop + missile.toRow * toMetrics.cell + toMetrics.cell / 2

    const duration = 600
    const startTime = startTimeRef.current

    const arcHeight = -150
    const midX = (startX + endX) / 2
    const midY = (startY + endY) / 2 + arcHeight

    const fixedAngle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI + 90

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      const t = progress
      const oneMinusT = 1 - t

      const x = oneMinusT * oneMinusT * startX + 2 * oneMinusT * t * midX + t * t * endX
      const y = oneMinusT * oneMinusT * startY + 2 * oneMinusT * t * midY + t * t * endY

      setPosition({ x, y, angle: fixedAngle })

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [missile, playerMetrics, aiMetrics, playerGridRef, aiGridRef])

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0) rotate(${position.angle}deg)`,
        transformOrigin: 'center center',
      }}
    >
      <div className="missile-sprite">
        <img 
          src="/assets/missile-body.png" 
          alt="missile" 
          style={{ 
            width: '48px',
            height: 'auto',
            filter: 'drop-shadow(0 0 8px rgba(255, 100, 0, 0.8))',
          }} 
        />
        {/* Flame trail */}
        <div className="missile-flame-trail" />
      </div>
    </div>
  )
}

function SonarRadar() {
  return (
    <div className="hud-radar">
      <div className="radar-ring">
        {/* Base radar image */}
        <img 
          src="/img/sonar_radar.png" 
          alt="Sonar Radar"
          className="absolute inset-0 w-full h-full object-contain opacity-75"
        />
        {/* White sweep line from center with trace */}
        <div className="radar-sweep-trace" />
        <div className="radar-sweep-line" />
      </div>
    </div>
  )
}

function TitleScreen({ onStart }: { onStart: () => void }) {
  const [isFading, setIsFading] = useState(false)

  const handleStart = () => {
    setIsFading(true)
    setTimeout(() => {
      onStart()
    }, 700)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleStart()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div 
      className={`relative min-h-screen w-full overflow-hidden flex items-center justify-center cursor-pointer transition-opacity duration-700 ${isFading ? 'opacity-0' : 'opacity-100'}`}
      onClick={handleStart}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleStart()
        }
      }}
      style={{ background: 'transparent' }}
    >
      {/* Content - background video and vignette are rendered globally */}
      <div className="relative z-30 text-center px-8 max-w-4xl">
        {/* Main title */}
        <h1 
          className="mw2-title uppercase mb-4"
          style={{
            lineHeight: '1'
          }}
        >
          <span className="mw2-title-main">FLEET COMMAND </span>
          <span className="mw2-title-ops">OPS</span>
        </h1>
        
        {/* Subtitle */}
        <h2 
          className="mw2-subtitle uppercase mb-12"
          style={{
            fontSize: 'clamp(1rem, 2vw, 1.5rem)',
            lineHeight: '1.2'
          }}
        >
          TACTICAL STRIKE MISSION
        </h2>
        
        {/* Press START prompt */}
        <p 
          className="uppercase animate-pulse mw-press-start"
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 'clamp(0.9rem, 1.5vw, 1.25rem)',
            letterSpacing: '0.1em',
            fontWeight: 500
          }}
        >
          Press START
        </p>
      </div>
    </div>
  )
}

type EffectType = 'explosion' | 'fire'
interface CellEffect {
  type: EffectType
  startedAt: number
}

function EffectsOverlay({ gridRef, effects, onExplosionEnd }: { gridRef: React.RefObject<HTMLDivElement>, effects: Map<string, CellEffect>, onExplosionEnd: (key: string) => void }) {
  const { cell: cellSize } = useGridMetrics(gridRef, [effects.size])
  
  if (!cellSize || effects.size === 0) return null
  
  const EXPLOSION_SCALE = 8.16
  const FIRE_SCALE = 3.325
  
  return (
    <div className="effects-overlay" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 35 }}>
      {Array.from(effects.entries()).map(([key, effect]) => {
        const [row, col] = key.split('-').map(Number)
        
        const cellEl = gridRef.current?.querySelector(`[data-cell="${row}-${col}"]`) as HTMLElement | null
        if (!cellEl) return null
        
        const cellRect = cellEl.getBoundingClientRect()
        const cellCenterX = cellRect.left + cellRect.width / 2
        const cellCenterY = cellRect.top + cellRect.height / 2
        
        const isExplosion = effect.type === 'explosion'
        const size = isExplosion ? cellSize * EXPLOSION_SCALE : cellSize * FIRE_SCALE
        const left = cellCenterX - size / 2
        const top = cellCenterY - size / 2
        
        return (
          <div
            key={key}
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${size}px`,
              height: `${size}px`,
              pointerEvents: 'none'
            }}
          >
            {isExplosion ? (
              <video
                key={`${key}-explosion`}
                autoPlay
                muted
                playsInline
                preload="auto"
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'translateY(-20%)' }}
                onEnded={() => onExplosionEnd(key)}
                onLoadedData={() => setTimeout(() => onExplosionEnd(key), 1100)}
                onError={(e) => console.error(`[EffectsOverlay] Explosion video error for ${key}:`, e)}
              >
                <source src="/fx/explosion.webm" type="video/webm" />
              </video>
            ) : (
              <video
                key={`${key}-fire`}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                style={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'screen', transform: 'translateY(-20%)' }}
                onError={(e) => console.error(`[EffectsOverlay] Fire video error for ${key}:`, e)}
              >
                <source src="/fx/fire.webm" type="video/webm" />
              </video>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TargetingOverlay({ gridRef, crosshairPosition }: { gridRef: React.RefObject<HTMLDivElement>, crosshairPosition: { row: number, col: number } | null }) {
  const [overlayRect, setOverlayRect] = useState<{ left: number, top: number, width: number, height: number, gridLeft: number, gridTop: number, gridWidth: number, gridHeight: number, cellSize: number } | null>(null)

  useEffect(() => {
    const updateRect = () => {
      if (gridRef.current) {
        const rect = gridRef.current.getBoundingClientRect()
        const firstCell = gridRef.current.querySelector('[data-cell="0-0"]')
        const lastCell = gridRef.current.querySelector('[data-cell="14-14"]')
        
        if (firstCell && lastCell) {
          const r1 = firstCell.getBoundingClientRect()
          const r2 = lastCell.getBoundingClientRect()
          
          setOverlayRect({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            gridLeft: r1.left - rect.left,
            gridTop: r1.top - rect.top,
            gridWidth: r2.right - r1.left,
            gridHeight: r2.bottom - r1.top,
            cellSize: r1.width
          })
        }
      }
    }
    
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect)
    
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect)
    }
  }, [gridRef])

  if (!overlayRect) return null

  const reticleX = crosshairPosition ? overlayRect.gridLeft + (crosshairPosition.col + 0.5) * overlayRect.cellSize : 0
  const reticleY = crosshairPosition ? overlayRect.gridTop + (crosshairPosition.row + 0.5) * overlayRect.cellSize : 0

  return (
    <>
      <div className="targeting-overlay-backdrop" />
      <div 
        className="targeting-overlay-frame"
        style={{
          left: `${overlayRect.left}px`,
          top: `${overlayRect.top}px`,
          width: `${overlayRect.width}px`,
          height: `${overlayRect.height}px`
        }}
      >
        <div 
          className="targeting-grid-lines"
          style={{
            position: 'absolute',
            left: `${overlayRect.gridLeft}px`,
            top: `${overlayRect.gridTop}px`,
            width: `${overlayRect.gridWidth}px`,
            height: `${overlayRect.gridHeight}px`,
            backgroundImage: 'linear-gradient(to right, rgba(0, 255, 100, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 255, 100, 0.3) 1px, transparent 1px)',
            backgroundSize: `${overlayRect.cellSize}px ${overlayRect.cellSize}px`,
            backgroundPosition: '0 0',
            pointerEvents: 'none'
          }}
        />
        <div className="targeting-scan-line" />
        <div className="targeting-hud-text">
          [ TARGETING SYSTEM ACTIVE ]
        </div>
        {crosshairPosition && (
          <div 
            className="crosshair"
            style={{
              position: 'absolute',
              left: `${reticleX}px`,
              top: `${reticleY}px`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="coordinates-display" style={{ whiteSpace: 'nowrap' }}>
              {String.fromCharCode(65 + crosshairPosition.row)}{crosshairPosition.col + 1}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function App() {
  const [gamePhase, setGamePhase] = useState<GamePhase>('title')
  const [playerBoard, setPlayerBoard] = useState<Cell[][]>([])
  const [aiBoard, setAiBoard] = useState<Cell[][]>([])
  const [playerShips, setPlayerShips] = useState<Ship[]>([])
  const [aiShips, setAiShips] = useState<Ship[]>([])
  const [currentShipIndex, setCurrentShipIndex] = useState(0)
  const [shipOrientation, setShipOrientation] = useState<Orientation>('horizontal')
  const [previewCells, setPreviewCells] = useState<[number, number][]>([])
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null)
  const [message, setMessage] = useState('')
  const [missiles, setMissiles] = useState<MissileAnimation[]>([])
  const [crosshairPosition, setCrosshairPosition] = useState<{ row: number; col: number } | null>(null)
  const [attackInProgress, setAttackInProgress] = useState(false)
  const [playerEffects, setPlayerEffects] = useState<Map<string, CellEffect>>(new Map())
  const [aiEffects, setAiEffects] = useState<Map<string, CellEffect>>(new Map())
  
  const aiTargetQueueRef = useRef<[number, number][]>([])
  const lastHitRef = useRef<[number, number] | null>(null)
  const playerBoardRef = useRef<Cell[][]>([])
  const playerShipsRef = useRef<Ship[]>([])
  const playerGridRef = useRef<HTMLDivElement>(null)
  const aiGridRef = useRef<HTMLDivElement>(null)
  const missileIdRef = useRef(0)
  
  useEffect(() => {
    playerBoardRef.current = playerBoard
  }, [playerBoard])
  
  useEffect(() => {
    playerShipsRef.current = playerShips
  }, [playerShips])

  const playerPlacements = useMemo(
    () => computePlacements(playerBoard, playerShips),
    [playerBoard, playerShips]
  )
  
  const aiPlacements = useMemo(
    () => computePlacements(aiBoard, aiShips).filter((p) => {
      const s = aiShips.find((x) => x.id === p.shipId)
      return s?.sunk
    }),
    [aiBoard, aiShips]
  )

  useEffect(() => {
    initializeGame()
  }, [])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (gamePhase === 'placement') {
          setShipOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [gamePhase])

  const addEffect = (isPlayerBoard: boolean, row: number, col: number, type: EffectType) => {
    const key = `${row}-${col}`
    const setter = isPlayerBoard ? setPlayerEffects : setAiEffects
    console.log(`[addEffect] Adding ${type} effect at ${key} on ${isPlayerBoard ? 'player' : 'AI'} board`)
    setter(prev => {
      if (prev.has(key)) return prev
      const newMap = new Map(prev)
      newMap.set(key, { type, startedAt: Date.now() })
      return newMap
    })
  }

  const swapToFire = (isPlayerBoard: boolean, key: string) => {
    const setter = isPlayerBoard ? setPlayerEffects : setAiEffects
    console.log(`[swapToFire] Swapping to fire at ${key} on ${isPlayerBoard ? 'player' : 'AI'} board`)
    setter(prev => {
      if (!prev.has(key)) return prev
      const current = prev.get(key)
      if (current?.type !== 'explosion') return prev
      const newMap = new Map(prev)
      newMap.set(key, { type: 'fire', startedAt: Date.now() })
      return newMap
    })
  }

  const initializeGame = () => {
    const emptyBoard = Array(BOARD_SIZE).fill(null).map(() =>
      Array(BOARD_SIZE).fill(null).map(() => ({ state: 'empty' as CellState }))
    )
    setPlayerBoard(JSON.parse(JSON.stringify(emptyBoard)))
    setAiBoard(JSON.parse(JSON.stringify(emptyBoard)))
    setPlayerShips(SHIPS.map(s => ({ ...s, hits: 0, sunk: false })))
    setPlayerEffects(new Map())
    setAiEffects(new Map())
    setAiShips(SHIPS.map(s => ({ ...s, hits: 0, sunk: false })))
    setCurrentShipIndex(0)
    setIsPlayerTurn(true)
    setWinner(null)
    setMessage('')
    aiTargetQueueRef.current = []
    lastHitRef.current = null
  }

  const startGame = () => {
    setGamePhase('placement')
    setMessage(`DEPLOY ${SHIPS[0].name.toUpperCase()} - ${SHIPS[0].size} grid units`)
  }

  const canPlaceShip = (board: Cell[][], row: number, col: number, width: number, length: number, orientation: Orientation): boolean => {
    const footprintWidth = orientation === 'horizontal' ? length : width
    const footprintHeight = orientation === 'horizontal' ? width : length
    
    if (col + footprintWidth > BOARD_SIZE || row + footprintHeight > BOARD_SIZE) return false
    
    for (let r = row; r < row + footprintHeight; r++) {
      for (let c = col; c < col + footprintWidth; c++) {
        if (board[r][c].state === 'ship') return false
      }
    }
    
    for (let r = row - 1; r <= row + footprintHeight; r++) {
      for (let c = col - 1; c <= col + footprintWidth; c++) {
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
          if (board[r][c].state === 'ship') return false
        }
      }
    }
    
    return true
  }

  const placeShip = (board: Cell[][], row: number, col: number, width: number, length: number, orientation: Orientation, shipId: number): Cell[][] => {
    const newBoard = JSON.parse(JSON.stringify(board))
    const footprintWidth = orientation === 'horizontal' ? length : width
    const footprintHeight = orientation === 'horizontal' ? width : length
    
    for (let r = row; r < row + footprintHeight; r++) {
      for (let c = col; c < col + footprintWidth; c++) {
        newBoard[r][c] = { state: 'ship' as CellState, shipId }
      }
    }
    return newBoard
  }

  const handlePlayerPlacement = (row: number, col: number) => {
    if (currentShipIndex >= SHIPS.length) return
    
    const ship = SHIPS[currentShipIndex]
    if (canPlaceShip(playerBoard, row, col, ship.width, ship.length, shipOrientation)) {
      const newBoard = placeShip(playerBoard, row, col, ship.width, ship.length, shipOrientation, ship.id)
      setPlayerBoard(newBoard)
      
      if (currentShipIndex === SHIPS.length - 1) {
        const aiBoard = placeAIShips()
        setAiBoard(aiBoard)
        setGamePhase('battle')
        setMessage('⚔️ BATTLE STATIONS! Select enemy coordinates to fire!')
      } else {
        setCurrentShipIndex(currentShipIndex + 1)
        setMessage(`DEPLOY ${SHIPS[currentShipIndex + 1].name.toUpperCase()} - ${SHIPS[currentShipIndex + 1].size} grid units`)
      }
    }
  }

  const placeAIShips = (): Cell[][] => {
    const emptyBoard = Array(BOARD_SIZE).fill(null).map(() =>
      Array(BOARD_SIZE).fill(null).map(() => ({ state: 'empty' as CellState }))
    )
    let board = emptyBoard
    
    for (const ship of SHIPS) {
      let placed = false
      let attempts = 0
      while (!placed && attempts < 1000) {
        const orientation: Orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical'
        const row = Math.floor(Math.random() * BOARD_SIZE)
        const col = Math.floor(Math.random() * BOARD_SIZE)
        
        if (canPlaceShip(board, row, col, ship.width, ship.length, orientation)) {
          board = placeShip(board, row, col, ship.width, ship.length, orientation, ship.id)
          placed = true
        }
        attempts++
      }
    }
    
    return board
  }

  const handleMouseEnter = (row: number, col: number) => {
    if (gamePhase !== 'placement' || currentShipIndex >= SHIPS.length) return
    
    const ship = SHIPS[currentShipIndex]
    const cells: [number, number][] = []
    
    if (canPlaceShip(playerBoard, row, col, ship.width, ship.length, shipOrientation)) {
      const footprintWidth = shipOrientation === 'horizontal' ? ship.length : ship.width
      const footprintHeight = shipOrientation === 'horizontal' ? ship.width : ship.length
      
      for (let r = row; r < row + footprintHeight; r++) {
        for (let c = col; c < col + footprintWidth; c++) {
          cells.push([r, c])
        }
      }
    }
    
    setPreviewCells(cells)
  }

  const handleMouseLeave = () => {
    setPreviewCells([])
  }

  const launchMissile = (fromRow: number, fromCol: number, toRow: number, toCol: number, fromBoard: 'player' | 'ai') => {
    const missileId = missileIdRef.current++
    const missile: MissileAnimation = {
      id: missileId,
      fromRow,
      fromCol,
      toRow,
      toCol,
      fromBoard
    }
    setMissiles(prev => [...prev, missile])
    
    setTimeout(() => {
      setMissiles(prev => prev.filter(m => m.id !== missileId))
    }, 800)
  }

  const handleAttack = async (row: number, col: number) => {
    if (!isPlayerTurn || gamePhase !== 'battle' || aiBoard[row][col].state === 'hit' || aiBoard[row][col].state === 'miss' || attackInProgress) {
      return
    }

    setAttackInProgress(true)
    setCrosshairPosition(null)

    launchMissile(7, 7, row, col, 'player')
    
    await new Promise(resolve => setTimeout(resolve, 600))

    const newBoard = JSON.parse(JSON.stringify(aiBoard))
    const cell = newBoard[row][col]
    const updatedAiShips = [...aiShips]
    
    if (cell.state === 'ship') {
      cell.state = 'hit'
      addEffect(false, row, col, 'explosion')
      setMessage('💥 DIRECT HIT! Enemy vessel damaged!')
      
      const shipIndex = updatedAiShips.findIndex(s => s.id === cell.shipId)
      if (shipIndex !== -1) {
        updatedAiShips[shipIndex].hits++
        if (updatedAiShips[shipIndex].hits === updatedAiShips[shipIndex].size) {
          updatedAiShips[shipIndex].sunk = true
          setMessage(`🔥 ENEMY ${updatedAiShips[shipIndex].name.toUpperCase()} DESTROYED! Outstanding work, Admiral!`)
        }
      }
      setAiShips(updatedAiShips)
      
      if (updatedAiShips.every(s => s.sunk)) {
        setWinner('player')
        setGamePhase('gameOver')
        setMessage('🎉 TOTAL VICTORY! Enemy fleet annihilated!')
      }
    } else {
      cell.state = 'miss'
      setMessage('💧 MISS! Shells hit open water.')
    }
    
    setAiBoard(newBoard)

    if (cell.state === 'hit' && !updatedAiShips.every(s => s.sunk)) {
      setTimeout(() => {
        setAttackInProgress(false)
      }, 1500)
    } else if (!updatedAiShips.every(s => s.sunk)) {
      setTimeout(() => {
        setAttackInProgress(false)
        setIsPlayerTurn(false)
        aiTurn()
      }, 1500)
    } else {
      setAttackInProgress(false)
    }
  }

  const aiTurn = () => {
    setTimeout(() => {
      let targetRow: number, targetCol: number
      const currentBoard = playerBoardRef.current

      if (aiTargetQueueRef.current.length > 0) {
        const [head, ...rest] = aiTargetQueueRef.current
        aiTargetQueueRef.current = rest
        ;[targetRow, targetCol] = head
      } else if (lastHitRef.current) {
        const [lastRow, lastCol] = lastHitRef.current
        const adjacentCells = [
          [lastRow - 1, lastCol],
          [lastRow + 1, lastCol],
          [lastRow, lastCol - 1],
          [lastRow, lastCol + 1],
        ].filter(([r, c]) => 
          r >= 0 && r < BOARD_SIZE && 
          c >= 0 && c < BOARD_SIZE && 
          currentBoard[r][c].state !== 'hit' && 
          currentBoard[r][c].state !== 'miss'
        ) as [number, number][]
        
        if (adjacentCells.length > 0) {
          [targetRow, targetCol] = adjacentCells[Math.floor(Math.random() * adjacentCells.length)]
        } else {
          lastHitRef.current = null
          do {
            targetRow = Math.floor(Math.random() * BOARD_SIZE)
            targetCol = Math.floor(Math.random() * BOARD_SIZE)
          } while (currentBoard[targetRow][targetCol].state === 'hit' || currentBoard[targetRow][targetCol].state === 'miss')
        }
      } else {
        do {
          targetRow = Math.floor(Math.random() * BOARD_SIZE)
          targetCol = Math.floor(Math.random() * BOARD_SIZE)
        } while (currentBoard[targetRow][targetCol].state === 'hit' || currentBoard[targetRow][targetCol].state === 'miss')
      }

      launchMissile(7, 7, targetRow, targetCol, 'ai')
      
      setTimeout(() => {
        const newBoard = JSON.parse(JSON.stringify(currentBoard))
        const cell = newBoard[targetRow][targetCol]
        const updatedPlayerShips = [...playerShipsRef.current]
        
        if (cell.state === 'ship') {
          cell.state = 'hit'
          addEffect(true, targetRow, targetCol, 'explosion')
          setMessage('🚨 INCOMING FIRE! Our vessel is hit!')
          lastHitRef.current = [targetRow, targetCol]
          
          const adjacentCells = [
            [targetRow - 1, targetCol],
            [targetRow + 1, targetCol],
            [targetRow, targetCol - 1],
            [targetRow, targetCol + 1],
          ].filter(([r, c]) => 
            r >= 0 && r < BOARD_SIZE && 
            c >= 0 && c < BOARD_SIZE && 
            newBoard[r][c].state !== 'hit' && 
            newBoard[r][c].state !== 'miss'
          ) as [number, number][]
          
          aiTargetQueueRef.current = [...aiTargetQueueRef.current, ...adjacentCells]
          
          const shipIndex = updatedPlayerShips.findIndex(s => s.id === cell.shipId)
          if (shipIndex !== -1) {
            updatedPlayerShips[shipIndex].hits++
            if (updatedPlayerShips[shipIndex].hits === updatedPlayerShips[shipIndex].size) {
              updatedPlayerShips[shipIndex].sunk = true
              setMessage(`💀 CRITICAL DAMAGE! Our ${updatedPlayerShips[shipIndex].name.toUpperCase()} has been sunk!`)
              lastHitRef.current = null
              aiTargetQueueRef.current = []
            }
          }
          setPlayerShips(updatedPlayerShips)
          
          if (updatedPlayerShips.every(s => s.sunk)) {
            setWinner('ai')
            setGamePhase('gameOver')
            setMessage('💀 DEFEAT! Our fleet has been destroyed!')
          }
        } else {
          cell.state = 'miss'
          setMessage('💧 Enemy salvo missed! We remain unscathed.')
        }
        
        setPlayerBoard(newBoard)

        if (cell.state === 'hit' && !updatedPlayerShips.every(s => s.sunk)) {
          aiTurn()
        } else if (!updatedPlayerShips.every(s => s.sunk)) {
          setTimeout(() => {
            setIsPlayerTurn(true)
          }, 1500)
        }
      }, 600)
    }, 1000)
  }

  const resetGame = () => {
    initializeGame()
    setGamePhase('instructions')
  }

  const getCellClass = (cell: Cell, isPlayerBoard: boolean, row: number, col: number) => {
    const isPreview = previewCells.some(([r, c]) => r === row && c === col)
    const isAlreadyAttacked = cell.state === 'hit' || cell.state === 'miss'
    
    const baseClass = isAlreadyAttacked 
      ? 'cursor-not-allowed transition-all duration-300 relative overflow-hidden bg-transparent'
      : 'cursor-pointer transition-all duration-300 relative overflow-hidden bg-transparent'
    
    let stateClass = ''
    let borderStyle = 'border border-white/10'
    
    if (cell.state === 'ship' && isPlayerBoard) {
      stateClass = 'hover:bg-white/5'
      borderStyle = 'border border-white/[0.12]'
    }
    
    if (isPreview) {
      stateClass += ' ring-2 ring-yellow-400'
    }
    
    return `${baseClass} ${borderStyle} ${stateClass}`
  }

  const renderBoard = (board: Cell[][], isPlayerBoard: boolean, gridRef?: React.RefObject<HTMLDivElement>) => {
    const ships = isPlayerBoard ? playerShips : aiShips
    
    const isCellOnSunkShip = (cell: Cell): boolean => {
      if (cell.state !== 'hit' || !cell.shipId) return false
      const ship = ships.find(s => s.id === cell.shipId)
      return ship?.sunk || false
    }
    
    return (
      <div className="inline-block p-2 rounded-lg shadow-2xl grid-frame" style={{ backgroundColor: 'rgba(28, 32, 36, 0.15)' }}>
        <div ref={gridRef} className="relative inline-block">
          
          <div 
            className="grid gap-0 relative board-strategy"
            style={{ 
              gridTemplateColumns: `repeat(${BOARD_SIZE + 1}, ${CELL_SIZE}px)`,
              gridTemplateRows: `repeat(${BOARD_SIZE + 1}, ${CELL_SIZE}px)`,
              zIndex: 1
            }}
          >
          <div style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}></div>
          {Array.from({ length: BOARD_SIZE }, (_, i) => (
            <div key={i} style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px`, fontFamily: 'Rajdhani, sans-serif', color: '#ffffff', fontWeight: 700 }} className="flex items-center justify-center text-xs">
              {i + 1}
            </div>
          ))}
          {board.map((row, rowIndex) => (
            <>
              <div key={`label-${rowIndex}`} style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px`, fontFamily: 'Rajdhani, sans-serif', color: '#ffffff', fontWeight: 700 }} className="flex items-center justify-center text-xs">
                {String.fromCharCode(65 + rowIndex)}
              </div>
              {row.map((cell, colIndex) => {
                const isOnSunkShip = isCellOnSunkShip(cell)
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    data-cell={`${rowIndex}-${colIndex}`}
                    className={getCellClass(cell, isPlayerBoard, rowIndex, colIndex)}
                    style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                    onClick={() => {
                      if (gamePhase === 'placement' && isPlayerBoard) {
                        handlePlayerPlacement(rowIndex, colIndex)
                      } else if (gamePhase === 'battle' && !isPlayerBoard) {
                        handleAttack(rowIndex, colIndex)
                      }
                    }}
                    onMouseEnter={() => {
                      if (isPlayerBoard) {
                        handleMouseEnter(rowIndex, colIndex)
                      } else if (gamePhase === 'battle' && isPlayerTurn && !attackInProgress) {
                        setCrosshairPosition({ row: rowIndex, col: colIndex })
                      }
                    }}
                    onMouseLeave={() => {
                      if (isPlayerBoard) {
                        handleMouseLeave()
                      } else {
                        setCrosshairPosition(null)
                      }
                    }}
                  >
                    {isOnSunkShip && (
                      <div className="rubble-effect">
                        <div className="rubble-piece"></div>
                        <div className="rubble-piece"></div>
                        <div className="rubble-piece"></div>
                        <div className="rubble-piece"></div>
                        <div className="rubble-piece"></div>
                      </div>
                    )}
                    {cell.state === 'miss' && (
                      <div className="water-ripple-effect"></div>
                    )}
                  </div>
                )
              })}
            </>
          ))}
        </div>
        </div>
      </div>
    )
  }

  if (gamePhase === 'title') {
    return (
      <>
        <BackgroundVideo />
        <TitleScreen onStart={() => setGamePhase('instructions')} />
      </>
    )
  }

  if (gamePhase === 'instructions') {
    return (
      <>
        <BackgroundVideo />
        <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden" style={{ background: 'transparent' }}>
        <Card className="max-w-2xl w-full bg-panel-bg/80 backdrop-blur-sm border-hud-accent-soft border-2 shadow-2xl shadow-hud-accent/20">
          <CardHeader className="text-center py-4">
            <div className="flex justify-center mb-3">
              <SonarRadar />
            </div>
            <CardTitle className="mw2-title uppercase mb-2" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: '1' }}>
              <span className="mw2-title-main">FLEET COMMAND </span>
              <span className="mw2-title-ops">OPS</span>
            </CardTitle>
            <CardDescription className="mw2-subtitle uppercase mb-1">
              TACTICAL STRIKE MISSION
            </CardDescription>
            <CardDescription className="text-sm mt-2 monospace mw-type-white--muted">
              &gt; PRIMARY OBJECTIVE: Locate and neutralize all hostile vessels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-3">
              <h3 className="text-lg font-bold flex items-center gap-2 uppercase tracking-wide mw-type-green" style={{ fontFamily: 'Teko, sans-serif' }}>
                <Info className="w-4 h-4" />
                Mission Briefing
              </h3>
              <div className="space-y-2 text-sm leading-snug mw-type-white--muted">
                <p className="flex items-start gap-2">
                  <span className="font-bold mw-type-green">1.</span>
                  <span>Deploy your fleet of 7 warships across the tactical grid. Ships cannot overlap or be adjacent (including diagonally).</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold mw-type-green">2.</span>
                  <span>Press R to rotate ship orientation between horizontal and vertical during deployment.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold mw-type-green">3.</span>
                  <span>Launch missile strikes on enemy grid coordinates. Watch for arc trajectory and impact effects.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold mw-type-green">4.</span>
                  <span>Direct hits trigger explosions followed by persistent fire. Misses create white water ripple effects.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold mw-type-green">5.</span>
                  <span>Sink all enemy vessels to complete the mission. Monitor sonar radar for tactical awareness.</span>
                </p>
              </div>
            </div>
            
            <Button 
              onClick={startGame}
              className="w-full bg-gradient-to-r from-hud-accent to-hud-accent-soft hover:from-hud-accent-glow hover:to-hud-accent font-bold text-lg py-5 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-hud-accent/50 uppercase tracking-wider mw-type-white"
              style={{ fontFamily: 'Teko, sans-serif' }}
            >
              ◈ COMMENCE OPERATIONS ◈
            </Button>
            
            <div className="text-center pt-4 border-t border-panel-stroke">
              <p className="text-sm mw-type-white--muted">Created by <span className="font-semibold mw-type-green--muted">Rudi Willner</span></p>
            </div>
          </CardContent>
        </Card>
      </div>
      </>
    )
  }

  if (gamePhase === 'gameOver') {
    return (
      <>
        <BackgroundVideo />
        <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'transparent' }}>
        <Card className="max-w-2xl w-full bg-slate-800/90 backdrop-blur-sm border-cyan-500 border-2 shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {winner === 'player' ? (
                <Trophy className="w-20 h-20 text-yellow-400 animate-bounce" />
              ) : (
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-red-400 opacity-60"></div>
                  <div className="absolute inset-2 rounded-full border-2 border-red-400 opacity-80"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-8 bg-gradient-to-t from-red-400 to-transparent" style={{ transformOrigin: 'center center' }}></div>
                  </div>
                </div>
              )}
            </div>
            <CardTitle className="text-5xl font-bold text-cyan-400 mb-2 tracking-wider">
              {winner === 'player' ? '⭐ TACTICAL VICTORY ⭐' : '💀 MISSION FAILED 💀'}
            </CardTitle>
            <CardDescription className="text-slate-300 text-xl font-semibold">
              {winner === 'player' 
                ? 'Congratulations, Admiral! Total domination of enemy waters!' 
                : 'The enemy has prevailed. Our forces have been overwhelmed.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700 p-4 rounded-lg border border-slate-600">
                <h3 className="text-cyan-400 font-bold mb-3 uppercase tracking-wide">Allied Fleet Status</h3>
                {playerShips.map(ship => (
                  <div key={ship.id} className="flex justify-between text-sm mb-2">
                    <span className={ship.sunk ? 'text-red-400 line-through' : 'text-slate-200'}>
                      {ship.name}
                    </span>
                    <span className={ship.sunk ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                      {ship.sunk ? '💀 SUNK' : '✓ OPERATIONAL'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-700 p-4 rounded-lg border border-slate-600">
                <h3 className="text-red-400 font-bold mb-3 uppercase tracking-wide">Enemy Fleet Status</h3>
                {aiShips.map(ship => (
                  <div key={ship.id} className="flex justify-between text-sm mb-2">
                    <span className={ship.sunk ? 'text-red-400 line-through' : 'text-slate-200'}>
                      {ship.name}
                    </span>
                    <span className={ship.sunk ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                      {ship.sunk ? '💀 SUNK' : '✓ OPERATIONAL'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <Button 
              onClick={resetGame}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xl py-7 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/50 uppercase tracking-wider"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              NEW CAMPAIGN
            </Button>
          </CardContent>
        </Card>
      </div>
      </>
    )
  }

  return (
    <>
      <div className="theme-cod min-h-screen p-8" style={{ 
        background: 'linear-gradient(180deg, #0c0f12 0%, #0a0d10 60%, #080a0c 100%)',
        backgroundAttachment: 'fixed',
        position: 'relative'
      }}>
      {gamePhase === 'placement' && (
        <>
          <video
            className="bg-video bg-video--placement"
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: 'fixed',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 0,
              filter: 'grayscale(1) saturate(0.6) brightness(0.45) contrast(1.08)'
            }}
          >
            <source src="/video/placement_bg.mp4" type="video/mp4" />
          </video>
          <div className="tactical-hud-overlay">
            <div className="hud-scanlines" />
            <div className="hud-grid" />
            <div className="hud-radar-pulse" />
          </div>
          <div className="military-dashboard-frame">
            <div className="dashboard-corner dashboard-corner-tl" />
            <div className="dashboard-corner dashboard-corner-tr" />
            <div className="dashboard-corner dashboard-corner-bl" />
            <div className="dashboard-corner dashboard-corner-br" />
          </div>
          <div className="placement-hud-overlay">
            <div className="hud-ticker">
              <div className="ticker-content">
                LINK-16 ONLINE • IFF AUTH: GREEN • COMMS: ENCRYPTED • THREAT LEVEL: MODERATE • TACTICAL NET: ACTIVE • DATALINK: SECURE
              </div>
            </div>
            <div className="hud-systems-panel">
              <div className="system-meter">
                <div className="meter-label">PWR</div>
                <div className="meter-bar">
                  <div className="meter-fill" style={{ height: '85%' }} />
                </div>
              </div>
              <div className="system-meter">
                <div className="meter-label">COM</div>
                <div className="meter-bar">
                  <div className="meter-fill" style={{ height: '92%' }} />
                </div>
              </div>
              <div className="system-meter">
                <div className="meter-label">SNR</div>
                <div className="meter-bar">
                  <div className="meter-fill" style={{ height: '78%' }} />
                </div>
              </div>
            </div>
            <div className="hud-threat-indicator">
              <div className="threat-label">THREAT INDEX</div>
              <div className="threat-value">02</div>
              <div className="threat-bar">
                <div className="threat-fill" style={{ width: '20%' }} />
              </div>
            </div>
          </div>
        </>
      )}
      <div className="max-w-7xl mx-auto">
        <header className="header-banner mb-6">
          <div className="header-smoke-layer" />
          <div className="header-inner">
            <div className="header-text-block">
              <div className="header-text-smoke" />
              <h1 className="cod-heading header-title mw2-title" style={{ lineHeight: '1' }}>
                <span className="mw2-title-main">FLEET COMMAND </span>
                <span className="mw2-title-ops">OPS</span>
              </h1>
              <h2 className="cod-subheading header-subtitle mw2-subtitle">{message}</h2>
              {gamePhase === 'placement' && (
                <p className="header-hint mw-type-white--muted" style={{ fontSize: '12px' }}>
                  Press R to rotate • Orientation: {shipOrientation.toUpperCase()}
                </p>
              )}
            </div>
          </div>
          <div className="hud-header-separator" />
        </header>
        
        <div className="section-bridge" />
        
        <div className="flex flex-col lg:flex-row justify-center gap-8 mb-8 items-start">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4 uppercase tracking-widest mw-type-green" style={{ fontFamily: 'Teko, sans-serif' }}>◈ ALLIED SECTOR ◈</h2>
            <div className="relative inline-block">
              {gamePhase === 'battle' && (
                <img 
                  src="/img/allied_overlay.png" 
                  alt="" 
                  className="soldier-overlay soldier-overlay-allied"
                />
              )}
              {renderBoard(playerBoard, true, playerGridRef)}
              {(gamePhase === 'placement' || gamePhase === 'battle') && (
                <ShipOverlays
                  placements={playerPlacements}
                  gridRef={playerGridRef}
                />
              )}
            </div>
            {gamePhase === 'battle' && (
              <div className="mt-4 space-y-2">
                {playerShips.map(ship => (
                  <div 
                    key={ship.id} 
                    className={`text-sm font-semibold ${ship.sunk ? 'text-red-400 line-through' : 'mw-type-green--muted'}`}
                    style={{ fontFamily: 'Rajdhani, sans-serif' }}
                  >
                    {ship.name}: {ship.sunk ? '💀 SUNK' : `${ship.hits}/${ship.size} hits`}
                  </div>
                ))}
              </div>
            )}
          </div>

          {gamePhase === 'placement' && (
            <div className="w-full lg:w-[380px] xl:w-[420px] text-left space-y-6 self-start">
              <h3 className="text-xl font-bold uppercase tracking-wider mt-2 mw-type-green" style={{ fontFamily: 'Teko, sans-serif' }}>◈ FLEET STATUS ◈</h3>
              <div className="space-y-3">
                {playerShips.map(ship => (
                  <div 
                    key={ship.id} 
                    className="text-sm font-semibold fleet-status-item mw-type-green--muted"
                    style={{ fontFamily: 'Rajdhani, sans-serif' }}
                  >
                    {ship.name}: {ship.size} grid units
                  </div>
                ))}
              </div>
              <div className="pt-4 space-y-4 border-t border-white/5">
                <h3 className="text-lg font-bold uppercase tracking-wider mt-2 mw-type-green" style={{ fontFamily: 'Teko, sans-serif' }}>◈ ORIENTATION ◈</h3>
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => setShipOrientation('horizontal')}
                    className={`text-white font-bold px-4 py-3.5 w-full rounded-lg`}
                    style={{ 
                      fontFamily: 'Rajdhani, sans-serif',
                      backgroundColor: shipOrientation === 'horizontal' ? '#8cff4f' : '#475569',
                      color: shipOrientation === 'horizontal' ? '#000' : '#fff'
                    }}
                  >
                    HORIZONTAL
                  </Button>
                  <Button
                    onClick={() => setShipOrientation('vertical')}
                    className={`text-white font-bold px-4 py-3.5 w-full rounded-lg`}
                    style={{ 
                      fontFamily: 'Rajdhani, sans-serif',
                      backgroundColor: shipOrientation === 'vertical' ? '#8cff4f' : '#475569',
                      color: shipOrientation === 'vertical' ? '#000' : '#fff'
                    }}
                  >
                    VERTICAL
                  </Button>
                  <Button
                    onClick={() => setShipOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
                    className="text-white font-bold px-4 py-3.5 w-full flex items-center justify-center gap-2 rounded-lg"
                    style={{ fontFamily: 'Rajdhani, sans-serif', backgroundColor: '#f59e0b' }}
                  >
                    <RotateCw className="w-4 h-4" />
                    ROTATE
                  </Button>
                </div>
              </div>
            </div>
          )}

          {gamePhase === 'battle' && (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 uppercase tracking-widest" style={{ 
              fontFamily: 'Teko, sans-serif', 
              color: '#ef4444',
              textShadow: '0 0 2px rgba(0, 0, 0, 0.95), 0 0 6px rgba(239, 68, 68, 0.7), 0 0 12px rgba(239, 68, 68, 0.4)'
            }}>◈ HOSTILE SECTOR ◈</h2>
              <div 
                className="relative inline-block"
                onMouseMove={() => {
                  if (isPlayerTurn && !attackInProgress) {
                  }
                }}
                onMouseLeave={() => {
                }}
              >
                <img 
                  src="/img/hostile_overlay.png" 
                  alt="" 
                  className="soldier-overlay soldier-overlay-hostile"
                />
                {renderBoard(aiBoard, false, aiGridRef)}
                <ShipOverlays
                  placements={aiPlacements}
                  gridRef={aiGridRef}
                />
              </div>
              <div className="mt-4 space-y-2">
                {aiShips.map(ship => (
                  <div 
                    key={ship.id} 
                    className={`text-sm font-semibold ${ship.sunk ? '' : 'mw-type-white--muted'}`}
                    style={{ fontFamily: 'Rajdhani, sans-serif', color: ship.sunk ? '#ef4444' : undefined }}
                  >
                    {ship.name}: {ship.sunk ? '💀 SUNK' : '❓ UNKNOWN'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <Button 
            onClick={resetGame}
            className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-8 py-4 uppercase tracking-wide"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Abort Mission
          </Button>
        </div>
      </div>
      
      {gamePhase === 'battle' && (
        <>
          <MissileOverlay
            missiles={missiles}
            playerGridRef={playerGridRef}
            aiGridRef={aiGridRef}
          />
          <EffectsOverlay
            gridRef={playerGridRef}
            effects={playerEffects}
            onExplosionEnd={(key) => swapToFire(true, key)}
          />
          <EffectsOverlay
            gridRef={aiGridRef}
            effects={aiEffects}
            onExplosionEnd={(key) => swapToFire(false, key)}
          />
          <div className="sonar-bottom-left">
            <SonarRadar />
          </div>
          {isPlayerTurn && !attackInProgress && (
            <TargetingOverlay 
              gridRef={aiGridRef}
              crosshairPosition={crosshairPosition}
            />
          )}
        </>
      )}
      </div>
    </>
  )
}

export default App
