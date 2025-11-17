import { useState, useRef, useEffect } from 'react'

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

export function PlacementConsole({ ships, onPlacementComplete, canPlaceShip, placeShip }: PlacementConsoleProps) {
  const [board, setBoard] = useState<any[][]>(() => 
    Array(15).fill(null).map(() => Array(15).fill({ state: 'empty' }))
  )
  const [placements, setPlacements] = useState<Array<{ shipId: number; startRow: number; startCol: number; orientation: 'horizontal' | 'vertical' }>>([])
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [previewCells, setPreviewCells] = useState<Array<{ row: number; col: number; valid: boolean }>>([])
  
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  
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
            gridTemplateColumns: '7fr 3fr',
            gap: '2%',
            padding: '2%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              ref={gridRef}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
                gap: 0,
                width: '100%',
                maxWidth: '600px',
                aspectRatio: '1 / 1',
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
              gap: '16px',
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
                }}
              >
                <img
                  src={`/ships/Ship${ship.name}Hull.png`}
                  alt={ship.name}
                  style={{
                    maxWidth: '120px',
                    height: 'auto',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 0 8px rgba(0, 255, 102, 0.5))',
                    pointerEvents: 'none',
                  }}
                  draggable={false}
                />
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
