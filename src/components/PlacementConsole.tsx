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
  const [gridOffsetTop, setGridOffsetTop] = useState(0)
  const [gridOffsetLeft, setGridOffsetLeft] = useState(0)
  const [selectedShipId, setSelectedShipId] = useState<number | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const leftColumnRef = useRef<HTMLDivElement>(null)
  const openingRef = useRef<HTMLDivElement>(null)
  
  const BOARD_SIZE = 15
  const FRAME_WIDTH = 1456
  const FRAME_HEIGHT = 816
  const OPENING_LEFT = 163
  const OPENING_TOP = 105
  const OPENING_WIDTH = 1135
  const OPENING_HEIGHT = 603

  const placedShipIds = new Set(placements.map(p => p.shipId))
  const availableShips = ships.filter(ship => !placedShipIds.has(ship.id))

  const playPlacementSound = () => {
    const audioEnabled = localStorage.getItem('audio-enabled')
    if (audioEnabled !== 'true' && audioEnabled !== null) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      const lowOsc = audioContext.createOscillator()
      const lowGain = audioContext.createGain()
      lowOsc.type = 'sine'
      lowOsc.frequency.setValueAtTime(800, audioContext.currentTime)
      lowGain.gain.setValueAtTime(0.3, audioContext.currentTime)
      lowGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05)
      lowOsc.connect(lowGain)
      lowGain.connect(audioContext.destination)
      lowOsc.start(audioContext.currentTime)
      lowOsc.stop(audioContext.currentTime + 0.05)

      const bufferSize = audioContext.sampleRate * 0.03
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3))
      }

      const noiseSource = audioContext.createBufferSource()
      noiseSource.buffer = buffer

      const bandpass = audioContext.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.frequency.setValueAtTime(3000, audioContext.currentTime)
      bandpass.Q.setValueAtTime(2, audioContext.currentTime)

      const noiseGain = audioContext.createGain()
      noiseGain.gain.setValueAtTime(0.2, audioContext.currentTime)

      noiseSource.connect(bandpass)
      bandpass.connect(noiseGain)
      noiseGain.connect(audioContext.destination)

      noiseSource.start(audioContext.currentTime)

      setTimeout(() => {
        audioContext.close()
      }, 100)
    } catch (error) {
      console.log('Placement sound failed:', error)
    }
  }

  useEffect(() => {
    if (placements.length === ships.length) {
      onPlacementComplete(placements)
    }
  }, [placements, ships.length, onPlacementComplete])

  useEffect(() => {
    if (!openingRef.current) return

    const computeGridSize = () => {
      if (!openingRef.current) return
      
      const openingRect = openingRef.current.getBoundingClientRect()
      const s = getComputedStyle(openingRef.current)
      const padY = parseFloat(s.paddingTop) + parseFloat(s.paddingBottom)
      const padX = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight)
      
      const labelPadTop = 20
      const labelPadLeft = 20
      const labelPadBottom = 20
      const frameGutter = 10
      
      const leftWidth = (openingRect.width - padX) * 0.7
      
      const availableHeight = (openingRect.height - padY) - (labelPadTop + labelPadBottom + 2 * frameGutter)
      const availableWidth = leftWidth - (labelPadLeft + 2 * frameGutter)
      
      const cell = Math.max(1, Math.floor(Math.min(availableWidth, availableHeight) / BOARD_SIZE))
      const gridPx = cell * BOARD_SIZE
      
      setGridSize(gridPx)
      setGridOffsetTop(frameGutter + labelPadTop)
      setGridOffsetLeft(frameGutter + labelPadLeft)
    }

    computeGridSize()
    window.addEventListener('resize', computeGridSize)
    return () => window.removeEventListener('resize', computeGridSize)
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
    setSelectedShipId(ship.id)
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
        playPlacementSound()
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
          ref={openingRef}
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

          <div ref={leftColumnRef} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <div style={{ position: 'relative', marginTop: `${gridOffsetTop}px`, marginLeft: `${gridOffsetLeft}px` }}>
              {/* Coordinate labels - Top (numbers 1-15) */}
              <div
                style={{
                  position: 'absolute',
                  top: '-20px',
                  left: 0,
                  right: 0,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
                  pointerEvents: 'none',
                }}
              >
                {Array.from({ length: BOARD_SIZE }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: 'Rajdhani, sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#00FF66',
                      textAlign: 'center',
                      textShadow: '0 0 4px rgba(0, 255, 120, 0.6)',
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Coordinate labels - Left (letters A-O) */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '-20px',
                  bottom: 0,
                  display: 'grid',
                  gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
                  pointerEvents: 'none',
                }}
              >
                {Array.from({ length: BOARD_SIZE }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: 'Rajdhani, sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#00FF66',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: '4px',
                      textShadow: '0 0 4px rgba(0, 255, 120, 0.6)',
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>

              {/* Grid */}
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
          </div>

          {/* Right Column: Naval Assets Panel */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: `${gridOffsetTop}px`,
            }}
          >
            {/* Naval Assets Panel */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                overflowY: 'auto',
                height: '100%',
                padding: '12px',
                background: 'rgba(0, 20, 10, 0.4)',
                border: '1px solid rgba(0, 255, 102, 0.4)',
                borderRadius: '4px',
                boxShadow: '0 0 12px rgba(0, 255, 102, 0.2)',
              }}
            >
              {/* Panel Title with Info Button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontFamily: 'Rajdhani, sans-serif',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#00FF66',
                  letterSpacing: '0.15em',
                  textShadow: '0 0 6px rgba(0, 255, 102, 0.6)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}
              >
                Naval Assets
                <button
                  onClick={() => setShowInstructions(!showInstructions)}
                  style={{
                    background: 'rgba(0, 255, 102, 0.2)',
                    border: '2px solid rgba(0, 255, 102, 0.6)',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    color: '#00FF66',
                    transition: 'all 0.3s ease',
                    flexShrink: 0,
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
                  <Info size={14} />
                </button>
              </div>

            {/* Ship Cards */}
            {availableShips.map(ship => {
              const isSelected = selectedShipId === ship.id
              return (
                <div
                  key={ship.id}
                  onPointerDown={(e) => handleShipPointerDown(e, ship)}
                  onClick={() => setSelectedShipId(ship.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '56px 1fr auto',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px',
                    background: isSelected ? 'rgba(0, 255, 102, 0.15)' : 'rgba(0, 255, 102, 0.05)',
                    border: `1px solid ${isSelected ? 'rgba(0, 255, 102, 0.6)' : 'rgba(0, 255, 102, 0.25)'}`,
                    borderRadius: '4px',
                    cursor: 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 0 12px rgba(0, 255, 102, 0.4)' : 'none',
                  }}
                >
                  {/* Ship Sprite */}
                  <div
                    style={{
                      width: '56px',
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '56px',
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
                          filter: isSelected 
                            ? 'drop-shadow(0 0 8px rgba(0, 255, 102, 0.8))' 
                            : 'drop-shadow(0 0 4px rgba(0, 255, 102, 0.4))',
                          pointerEvents: 'none',
                        }}
                        draggable={false}
                      />
                    </div>
                  </div>

                  {/* Ship Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div
                      style={{
                        fontFamily: 'Rajdhani, sans-serif',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: isSelected ? '#00FF66' : '#00CC55',
                        letterSpacing: '0.08em',
                        textShadow: isSelected ? '0 0 6px rgba(0, 255, 102, 0.6)' : 'none',
                        textTransform: 'uppercase',
                      }}
                    >
                      {ship.name}
                    </div>
                    <div
                      style={{
                        fontFamily: 'Rajdhani, sans-serif',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'rgba(0, 255, 102, 0.7)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Hull Length: {ship.length}
                    </div>
                  </div>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#00FF66',
                        boxShadow: '0 0 8px rgba(0, 255, 102, 0.8)',
                      }}
                    />
                  )}
                </div>
              )
            })}
            </div>
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
