import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

interface Ship {
  id: number
  name: string
  size: number
  width: number
  length: number
  hits: number
  sunk: boolean
}

interface PlacementConsoleProps {
  ships: Ship[]
  onPlacementComplete: (placements: Array<{ shipId: number; startRow: number; startCol: number; orientation: 'horizontal' | 'vertical' }>) => void
  canPlaceShip: (board: any[][], row: number, col: number, ship: Ship, orientation: 'horizontal' | 'vertical') => boolean
  placeShip: (board: any[][], row: number, col: number, ship: Ship, orientation: 'horizontal' | 'vertical') => any[][]
}

interface DragState {
  shipId: number
  offsetX: number
  offsetY: number
  orientation: 'horizontal' | 'vertical'
}

const SHIP_IMG: Record<string, string> = {
  Carrier: '/ships/ShipCarrierHull.png',
  Battleship: '/ships/ShipBattleshipHull.png',
  Cruiser: '/ships/ShipCruiserHull.png',
  Submarine: '/ships/ShipSubMarineHull.png',
  Destroyer: '/ships/ShipDestroyerHull.png',
  Rescue: '/ships/ShipRescue.png',
  Patrol: '/ships/ShipPatrolHull.png',
}

export function PlacementConsole({ ships, onPlacementComplete, canPlaceShip, placeShip }: PlacementConsoleProps) {
  const [board, setBoard] = useState<any[][]>(() => 
    Array(15).fill(null).map(() => Array(15).fill({ state: 'empty' }))
  )
  const [placements, setPlacements] = useState<Array<{ shipId: number; startRow: number; startCol: number; orientation: 'horizontal' | 'vertical' }>>([])
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [previewCells, setPreviewCells] = useState<Array<{ row: number; col: number; valid: boolean }>>([])
  const [showInstructions, setShowInstructions] = useState(false)
  const [gridSize, setGridSize] = useState(600)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const leftColumnRef = useRef<HTMLDivElement>(null)
  
  const BOARD_SIZE = 15
  const FRAME_WIDTH = 1456
  const FRAME_HEIGHT = 816
  const OPENING_LEFT = 163
  const OPENING_TOP = 105
  const OPENING_WIDTH = 1135
  const OPENING_HEIGHT = 603

  const placedShipIds = new Set(placements.map(p => p.shipId))
  const availableShips = ships.filter(ship => !placedShipIds.has(ship.id))

  useEffect(() => {
    if (placements.length === ships.length) {
      onPlacementComplete(placements)
    }
  }, [placements, ships.length, onPlacementComplete])

  useEffect(() => {
    if (!leftColumnRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const size = Math.min(width, height) * 0.9
        setGridSize(size)
      }
    })

    resizeObserver.observe(leftColumnRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    if (!dragState) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setDragState(prev => prev ? {
          ...prev,
          orientation: prev.orientation === 'horizontal' ? 'vertical' : 'horizontal'
        } : null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dragState])

  const handleShipPointerDown = (e: React.PointerEvent, ship: Ship) => {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    
    const rect = target.getBoundingClientRect()
    setDragState({
      shipId: ship.id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      orientation: 'horizontal'
    })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState || !gridRef.current) return

    const gridRect = gridRef.current.getBoundingClientRect()
    const cellSize = gridRect.width / BOARD_SIZE
    
    const col = Math.floor((e.clientX - gridRect.left) / cellSize)
    const row = Math.floor((e.clientY - gridRect.top) / cellSize)

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      setPreviewCells([])
      return
    }

    const ship = ships.find(s => s.id === dragState.shipId)
    if (!ship) return

    const cells: Array<{ row: number; col: number; valid: boolean }> = []
    const isValid = canPlaceShip(board, row, col, ship, dragState.orientation)

    if (dragState.orientation === 'horizontal') {
      for (let c = col; c < col + ship.length && c < BOARD_SIZE; c++) {
        for (let r = row; r < row + ship.width && r < BOARD_SIZE; r++) {
          cells.push({ row: r, col: c, valid: isValid })
        }
      }
    } else {
      for (let r = row; r < row + ship.length && r < BOARD_SIZE; r++) {
        for (let c = col; c < col + ship.width && c < BOARD_SIZE; c++) {
          cells.push({ row: r, col: c, valid: isValid })
        }
      }
    }

    setPreviewCells(cells)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState || !gridRef.current) {
      setDragState(null)
      setPreviewCells([])
      return
    }

    const gridRect = gridRef.current.getBoundingClientRect()
    const cellSize = gridRect.width / BOARD_SIZE
    
    const col = Math.floor((e.clientX - gridRect.left) / cellSize)
    const row = Math.floor((e.clientY - gridRect.top) / cellSize)

    const ship = ships.find(s => s.id === dragState.shipId)
    if (!ship) {
      setDragState(null)
      setPreviewCells([])
      return
    }

    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
      if (canPlaceShip(board, row, col, ship, dragState.orientation)) {
        const newBoard = placeShip(board, row, col, ship, dragState.orientation)
        setBoard(newBoard)
        setPlacements(prev => [...prev, {
          shipId: ship.id,
          startRow: row,
          startCol: col,
          orientation: dragState.orientation
        }])
      }
    }

    setDragState(null)
    setPreviewCells([])
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #0c0f12 0%, #0a0d10 60%, #080a0c 100%)',
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(95vw, 1456px)',
          aspectRatio: '1456 / 816',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${(OPENING_LEFT / FRAME_WIDTH) * 100}%`,
            top: `${(OPENING_TOP / FRAME_HEIGHT) * 100}%`,
            width: `${(OPENING_WIDTH / FRAME_WIDTH) * 100}%`,
            height: `${(OPENING_HEIGHT / FRAME_HEIGHT) * 100}%`,
            display: 'grid',
            gridTemplateRows: 'auto 1fr',
            gridTemplateColumns: '7fr 3fr',
            gap: '2%',
            padding: '2%',
          }}
        >
          {/* Title and Info Widget */}
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              marginBottom: '8px',
              position: 'relative',
            }}
          >
            <h1
              style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: 'clamp(24px, 3vw, 36px)',
                fontWeight: 800,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                background: 'linear-gradient(to bottom, #ffffff 0%, #f5fff2 40%, #b4ffb5 70%, #4bff6f 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                textShadow: '0 0 2px rgba(0, 0, 0, 0.95), 0 0 4px rgba(255, 255, 255, 0.8), 0 0 10px rgba(0, 255, 120, 0.85), 0 0 22px rgba(0, 255, 120, 0.6)',
                margin: 0,
              }}
            >
              Strategy Console
            </h1>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              style={{
                background: 'rgba(0, 255, 102, 0.2)',
                border: '2px solid rgba(0, 255, 102, 0.6)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                pointerEvents: 'auto',
                color: '#00FF66',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 255, 102, 0.4)'
                e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 102, 0.6)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 255, 102, 0.2)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <Info size={20} />
            </button>
          </div>

          {/* Instructions Dialog */}
          {showInstructions && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.8)',
                zIndex: 1000,
                pointerEvents: 'auto',
              }}
              onClick={() => setShowInstructions(false)}
            >
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(10, 20, 15, 0.95), rgba(5, 15, 10, 0.95))',
                  border: '2px solid rgba(0, 255, 102, 0.6)',
                  borderRadius: '8px',
                  padding: '32px',
                  maxWidth: '500px',
                  boxShadow: '0 0 40px rgba(0, 255, 102, 0.4)',
                  pointerEvents: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h2
                  style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontSize: '28px',
                    fontWeight: 700,
                    color: '#00FF66',
                    marginTop: 0,
                    marginBottom: '20px',
                    textShadow: '0 0 10px rgba(0, 255, 102, 0.6)',
                  }}
                >
                  Deployment Instructions
                </h2>
                <div
                  style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontSize: '16px',
                    color: '#e0e0e0',
                    lineHeight: '1.6',
                  }}
                >
                  <p>1. Drag each ship from the right panel onto the strategy grid</p>
                  <p>2. Press <strong style={{ color: '#00FF66' }}>R</strong> while dragging to rotate ship orientation</p>
                  <p>3. Ships cannot overlap or be adjacent to each other</p>
                  <p>4. Green cells indicate valid placement, red cells indicate invalid</p>
                  <p>5. Once all 7 ships are deployed, battle phase will commence</p>
                </div>
                <button
                  onClick={() => setShowInstructions(false)}
                  style={{
                    marginTop: '24px',
                    background: 'rgba(0, 255, 102, 0.2)',
                    border: '2px solid rgba(0, 255, 102, 0.6)',
                    borderRadius: '4px',
                    padding: '12px 24px',
                    color: '#00FF66',
                    fontFamily: 'Rajdhani, sans-serif',
                    fontSize: '16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 255, 102, 0.4)'
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 102, 0.6)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 255, 102, 0.2)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  UNDERSTOOD
                </button>
              </div>
            </div>
          )}

          {/* Sweeping Radar Effect */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
              mixBlendMode: 'screen',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'conic-gradient(rgba(0, 255, 120, 0.15) 0deg 30deg, transparent 30deg 360deg)',
                transformOrigin: '50% 50%',
                animation: 'radarSweep 4s linear infinite',
              }}
            />
          </div>

          <div ref={leftColumnRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              ref={gridRef}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
                gap: 0,
                width: `${gridSize}px`,
                height: `${gridSize}px`,
                border: '2px solid rgba(0, 255, 102, 0.6)',
                boxShadow: '0 0 20px rgba(0, 255, 102, 0.3)',
              }}
            >
              {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
                const row = Math.floor(i / BOARD_SIZE)
                const col = i % BOARD_SIZE
                const cell = board[row][col]
                const previewCell = previewCells.find(p => p.row === row && p.col === col)
                
                return (
                  <div
                    key={`${row}-${col}`}
                    style={{
                      border: '1px solid rgba(0, 255, 102, 0.3)',
                      backgroundColor: previewCell 
                        ? previewCell.valid 
                          ? 'rgba(0, 255, 102, 0.2)' 
                          : 'rgba(255, 0, 0, 0.2)'
                        : cell.state === 'ship'
                        ? 'rgba(0, 255, 102, 0.4)'
                        : 'transparent',
                    }}
                  />
                )
              })}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'center',
              overflowY: 'auto',
              padding: '8px',
            }}
          >
            {availableShips.map(ship => (
              <div
                key={ship.id}
                onPointerDown={(e) => handleShipPointerDown(e, ship)}
                style={{
                  cursor: 'grab',
                  touchAction: 'none',
                  userSelect: 'none',
                  width: '180px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '180px',
                    transform: 'rotate(90deg)',
                    transformOrigin: 'center',
                  }}
                >
                  <img
                    src={SHIP_IMG[ship.name] || `/ships/Ship${ship.name}Hull.png`}
                    alt={ship.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 0 8px rgba(0, 255, 102, 0.5))',
                      pointerEvents: 'none',
                    }}
                    draggable={false}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <img
          src="/img/hud_frame_overlay.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        />
      </div>
    </div>
  )
}
