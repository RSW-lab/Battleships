import { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import './App.css'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Anchor, Waves, Target, Trophy, RotateCcw, Info, RotateCw, Rocket } from 'lucide-react'

type CellState = 'empty' | 'ship' | 'hit' | 'miss'
type GamePhase = 'instructions' | 'placement' | 'battle' | 'gameOver'
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
const CELL_SIZE = 40

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

function ShipOverlays({
  placements,
  gridRef,
}: {
  placements: Placement[]
  gridRef: React.RefObject<HTMLElement>
}) {
  const { cell, offsetLeft, offsetTop } = useGridMetrics(gridRef, [placements])
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <div
        className="absolute"
        style={{
          left: offsetLeft,
          top: offsetTop,
          width: cell * BOARD_SIZE,
          height: cell * BOARD_SIZE,
        }}
      >
        {placements.map((p) => {
          const left = p.startCol * cell
          const top = p.startRow * cell
          const footprintWidth = p.orientation === 'horizontal' ? p.length * cell : p.width * cell
          const footprintHeight = p.orientation === 'horizontal' ? p.width * cell : p.length * cell
          const src = SHIP_IMG[p.name]
          if (!src) return null
          
          if (p.orientation === 'horizontal') {
            return (
              <div
                key={p.shipId}
                className="absolute pointer-events-none flex items-center justify-center z-10"
                style={{
                  left,
                  top,
                  width: footprintWidth,
                  height: footprintHeight,
                  overflow: 'visible',
                }}
              >
                <div
                  style={{
                    width: footprintHeight,
                    height: footprintWidth,
                    transform: 'rotate(90deg)',
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
                  width: footprintWidth,
                  height: footprintHeight,
                  overflow: 'visible',
                }}
              >
                <img
                  src={src}
                  alt={`${p.name}`}
                  className="opacity-90 select-none block"
                  style={{
                    height: '100%',
                    width: 'auto',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    objectPosition: 'center',
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
  const playerMetrics = useGridMetrics(playerGridRef, [missiles])
  const aiMetrics = useGridMetrics(aiGridRef, [missiles])

  return (
    <>
      {missiles.map((missile) => {
        const fromMetrics = missile.fromBoard === 'player' ? playerMetrics : aiMetrics
        const toMetrics = missile.fromBoard === 'player' ? aiMetrics : playerMetrics
        const fromGridRef = missile.fromBoard === 'player' ? playerGridRef : aiGridRef
        const toGridRef = missile.fromBoard === 'player' ? aiGridRef : playerGridRef

        if (!fromGridRef.current || !toGridRef.current) return null

        const fromGridRect = fromGridRef.current.getBoundingClientRect()
        const toGridRect = toGridRef.current.getBoundingClientRect()

        const fromX = fromGridRect.left + fromMetrics.offsetLeft + missile.fromCol * fromMetrics.cell + fromMetrics.cell / 2
        const fromY = fromGridRect.top + fromMetrics.offsetTop + missile.fromRow * fromMetrics.cell + fromMetrics.cell / 2

        const toX = toGridRect.left + toMetrics.offsetLeft + missile.toCol * toMetrics.cell + toMetrics.cell / 2
        const toY = toGridRect.top + toMetrics.offsetTop + missile.toRow * toMetrics.cell + toMetrics.cell / 2

        const deltaX = toX - fromX
        const deltaY = toY - fromY

        return (
          <div
            key={missile.id}
            className="fixed pointer-events-none z-50"
            style={{
              left: fromX,
              top: fromY,
              '--missile-x': `${deltaX}px`,
              '--missile-y': `${deltaY}px`,
            } as React.CSSProperties}
          >
            <div className="missile-animation">
              <Rocket className="w-6 h-6 text-red-500" style={{ transform: `rotate(${Math.atan2(deltaY, deltaX) * 180 / Math.PI + 90}deg)` }} />
            </div>
          </div>
        )
      })}
    </>
  )
}

function SonarRadar() {
  return (
    <div className="fixed bottom-8 right-8 w-32 h-32 pointer-events-none z-40">
      <div className="relative w-full h-full">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-500 opacity-50"></div>
        <div className="absolute inset-2 rounded-full border border-cyan-400 opacity-40"></div>
        <div className="absolute inset-4 rounded-full border border-cyan-300 opacity-30"></div>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="radar-arm absolute w-1 h-16 bg-gradient-to-t from-cyan-400 to-transparent origin-bottom" style={{ transformOrigin: 'center center', bottom: '50%' }}></div>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="radar-ping absolute w-2 h-2 bg-cyan-400 rounded-full"></div>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-cyan-400 text-xs font-bold opacity-70">SONAR</div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [gamePhase, setGamePhase] = useState<GamePhase>('instructions')
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
  const [attackInProgress, setAttackInProgress] = useState(false)
  
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

  const initializeGame = () => {
    const emptyBoard = Array(BOARD_SIZE).fill(null).map(() =>
      Array(BOARD_SIZE).fill(null).map(() => ({ state: 'empty' as CellState }))
    )
    setPlayerBoard(JSON.parse(JSON.stringify(emptyBoard)))
    setAiBoard(JSON.parse(JSON.stringify(emptyBoard)))
    setPlayerShips(SHIPS.map(s => ({ ...s, hits: 0, sunk: false })))
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
    launchMissile(7, 7, row, col, 'player')
    
    await new Promise(resolve => setTimeout(resolve, 600))

    const newBoard = JSON.parse(JSON.stringify(aiBoard))
    const cell = newBoard[row][col]
    const updatedAiShips = [...aiShips]
    
    if (cell.state === 'ship') {
      cell.state = 'hit'
      cell.animation = 'hit'
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
      cell.animation = 'miss'
      setMessage('💧 MISS! Shells hit open water.')
    }
    
    setAiBoard(newBoard)
    
    setTimeout(() => {
      const updatedBoard = JSON.parse(JSON.stringify(newBoard))
      updatedBoard[row][col].animation = undefined
      setAiBoard(updatedBoard)
    }, 1000)

    if (cell.state === 'hit' && !updatedAiShips.every(s => s.sunk)) {
      setTimeout(() => {
        setIsPlayerTurn(false)
        setAttackInProgress(false)
        aiTurn()
      }, 1500)
    } else if (!updatedAiShips.every(s => s.sunk)) {
      setTimeout(() => {
        setIsPlayerTurn(false)
        setAttackInProgress(false)
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
        let foundTarget = false
        while (aiTargetQueueRef.current.length > 0 && !foundTarget) {
          const [head, ...rest] = aiTargetQueueRef.current
          aiTargetQueueRef.current = rest
          const [r, c] = head
          if (currentBoard[r][c].state !== 'hit' && currentBoard[r][c].state !== 'miss') {
            targetRow = r
            targetCol = c
            foundTarget = true
          }
        }
        
        if (!foundTarget) {
          do {
            targetRow = Math.floor(Math.random() * BOARD_SIZE)
            targetCol = Math.floor(Math.random() * BOARD_SIZE)
          } while (currentBoard[targetRow][targetCol].state === 'hit' || currentBoard[targetRow][targetCol].state === 'miss')
        }
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
          cell.animation = 'hit'
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
        } else if (cell.state === 'empty') {
          cell.state = 'miss'
          cell.animation = 'miss'
          setMessage('💧 Enemy salvo missed! We remain unscathed.')
        }
        
        setPlayerBoard(newBoard)
        
        setTimeout(() => {
          const updatedBoard = JSON.parse(JSON.stringify(newBoard))
          updatedBoard[targetRow][targetCol].animation = undefined
          setPlayerBoard(updatedBoard)
        }, 1000)

        if (cell.state === 'hit' && !updatedPlayerShips.every(s => s.sunk)) {
          aiTurn()
        } else if (!updatedPlayerShips.every(s => s.sunk)) {
          setTimeout(() => {
            setIsPlayerTurn(true)
            setAttackInProgress(false)
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
    const baseClass = 'border border-slate-600 cursor-pointer transition-all duration-300 relative overflow-hidden'
    const isPreview = previewCells.some(([r, c]) => r === row && c === col)
    
    let stateClass = 'bg-blue-900 hover:bg-blue-800'
    
    if (cell.state === 'ship' && isPlayerBoard) {
      stateClass = 'bg-slate-700 hover:bg-slate-600'
    } else if (cell.state === 'hit') {
      stateClass = 'bg-red-600'
    } else if (cell.state === 'miss') {
      stateClass = 'bg-blue-400'
    }
    
    if (isPreview) {
      stateClass += ' ring-2 ring-yellow-400'
    }
    
    if (cell.animation === 'hit') {
      stateClass += ' animate-pulse'
    }
    
    return `${baseClass} ${stateClass}`
  }

  const renderBoard = (board: Cell[][], isPlayerBoard: boolean, gridRef?: React.RefObject<HTMLDivElement>) => {
    const ships = isPlayerBoard ? playerShips : aiShips
    
    const isCellOnSunkShip = (cell: Cell): boolean => {
      if (cell.state !== 'hit' || !cell.shipId) return false
      const ship = ships.find(s => s.id === cell.shipId)
      return ship?.sunk || false
    }
    
    return (
      <div className="inline-block">
        <div 
          ref={gridRef}
          className="grid gap-0 bg-slate-800 p-2 rounded-lg shadow-2xl overflow-hidden"
          style={{ 
            gridTemplateColumns: `repeat(${BOARD_SIZE + 1}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${BOARD_SIZE + 1}, ${CELL_SIZE}px)`
          }}
        >
          <div style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}></div>
          {Array.from({ length: BOARD_SIZE }, (_, i) => (
            <div key={i} style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }} className="flex items-center justify-center text-cyan-400 font-bold text-sm">
              {i + 1}
            </div>
          ))}
          {board.map((row, rowIndex) => (
            <>
              <div key={`label-${rowIndex}`} style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }} className="flex items-center justify-center text-cyan-400 font-bold text-sm">
                {String.fromCharCode(65 + rowIndex)}
              </div>
              {row.map((cell, colIndex) => {
                const isOnSunkShip = isCellOnSunkShip(cell)
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    data-cell={`${rowIndex}-${colIndex}`}
                    className={getCellClass(cell, isPlayerBoard, rowIndex, colIndex)}
                    onClick={() => {
                      if (gamePhase === 'placement' && isPlayerBoard) {
                        handlePlayerPlacement(rowIndex, colIndex)
                      } else if (gamePhase === 'battle' && !isPlayerBoard) {
                        handleAttack(rowIndex, colIndex)
                      }
                    }}
                    onMouseEnter={() => isPlayerBoard && handleMouseEnter(rowIndex, colIndex)}
                    onMouseLeave={() => isPlayerBoard && handleMouseLeave()}
                  >
                    {isOnSunkShip && (
                      <div className="absolute inset-0 z-20 pointer-events-none">
                        <div className="fire-effect absolute inset-0 bg-gradient-to-t from-orange-600 via-red-500 to-yellow-400 opacity-60"></div>
                      </div>
                    )}
                    {cell.state === 'hit' && (
                      <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                        <Target className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                    {cell.state === 'miss' && (
                      <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                        <Waves className="w-5 h-5 text-white opacity-70" />
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>
    )
  }

  if (gamePhase === 'instructions') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8">
        <Card className="max-w-2xl w-full bg-slate-800 border-cyan-500 border-2 shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Anchor className="w-16 h-16 text-cyan-400 animate-pulse" />
            </div>
            <CardTitle className="text-5xl font-bold text-cyan-400 mb-2 tracking-wider">
              ⚓ NAVAL COMMAND ⚓
            </CardTitle>
            <CardDescription className="text-slate-300 text-xl font-semibold mb-2">
              BATTLESHIPS
            </CardDescription>
            <CardDescription className="text-amber-400 text-sm font-bold uppercase tracking-widest">
              Admiral on Deck
            </CardDescription>
            <CardDescription className="text-slate-400 text-base mt-4 italic">
              Command your fleet. Destroy the enemy. Claim victory on the high seas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-slate-200">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-cyan-400 flex items-center gap-2 uppercase tracking-wide">
                <Info className="w-5 h-5" />
                Mission Briefing
              </h3>
              <div className="space-y-3 text-base">
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">1.</span>
                  <span>Deploy your naval fleet of 5 warships across the tactical grid. Maintain operational spacing - vessels cannot be adjacent, even diagonally.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">2.</span>
                  <span>Press R to rotate ship orientation between horizontal and vertical during deployment phase.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">3.</span>
                  <span>Engage in tactical combat. Select coordinates on enemy waters to launch strikes.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">4.</span>
                  <span>💥 Direct hits marked in red. 💧 Missed shots marked in blue.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">5.</span>
                  <span>Sink the entire enemy armada to achieve total naval supremacy!</span>
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-cyan-400 uppercase tracking-wide">Your Naval Armada</h3>
              <div className="grid grid-cols-1 gap-2">
                {SHIPS.map(ship => (
                  <div key={ship.id} className="flex items-center gap-3 bg-slate-700 p-3 rounded-lg border border-slate-600 hover:border-cyan-500 transition-colors">
                    <Anchor className="w-5 h-5 text-cyan-400" />
                    <span className="font-semibold text-slate-100">{ship.name}</span>
                    <span className="text-slate-400">({ship.size} grid units)</span>
                  </div>
                ))}
              </div>
            </div>
            
            <Button 
              onClick={startGame}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xl py-7 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-cyan-500/50 uppercase tracking-wider"
            >
              ⚓ COMMENCE OPERATIONS ⚓
            </Button>
            
            <div className="text-center pt-4 border-t border-slate-700">
              <p className="text-slate-500 text-sm">Created by <span className="text-cyan-400 font-semibold">Rudi Willner</span></p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gamePhase === 'gameOver') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8">
        <Card className="max-w-2xl w-full bg-slate-800 border-cyan-500 border-2 shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {winner === 'player' ? (
                <Trophy className="w-20 h-20 text-yellow-400 animate-bounce" />
              ) : (
                <Anchor className="w-20 h-20 text-red-400" />
              )}
            </div>
            <CardTitle className="text-5xl font-bold text-cyan-400 mb-2 tracking-wider">
              {winner === 'player' ? '⭐ NAVAL SUPREMACY ⭐' : '💀 FLEET DESTROYED 💀'}
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
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-cyan-400 mb-2 flex items-center justify-center gap-3 tracking-wider">
            <Anchor className="w-12 h-12 animate-pulse" />
            NAVAL COMMAND
            <Anchor className="w-12 h-12 animate-pulse" />
          </h1>
          <p className="text-2xl text-slate-200 font-semibold">{message}</p>
          {gamePhase === 'placement' && (
            <p className="text-lg text-yellow-400 mt-2 font-bold">
              Press R to rotate • Orientation: {shipOrientation.toUpperCase()}
            </p>
          )}
        </div>

        <div className="flex flex-col lg:flex-row justify-center gap-8 mb-8 items-start">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4 uppercase tracking-widest">⚓ Allied Waters ⚓</h2>
            <div className="relative inline-block">
              {renderBoard(playerBoard, true, playerGridRef)}
              {(gamePhase === 'placement' || gamePhase === 'battle') && (
                <ShipOverlays
                  placements={playerPlacements}
                  gridRef={playerGridRef}
                />
              )}
            </div>
            <div className="mt-4 space-y-2">
              {playerShips.map(ship => (
                <div 
                  key={ship.id} 
                  className={`text-sm font-semibold ${ship.sunk ? 'text-red-400 line-through' : 'text-green-400'}`}
                >
                  {ship.name}: {ship.sunk ? '💀 SUNK' : `${ship.hits}/${ship.size} hits`}
                </div>
              ))}
            </div>
            {gamePhase === 'placement' && (
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  onClick={() => setShipOrientation('horizontal')}
                  className={`${
                    shipOrientation === 'horizontal'
                      ? 'bg-cyan-600 hover:bg-cyan-700'
                      : 'bg-slate-600 hover:bg-slate-500'
                  } text-white font-bold px-4 py-2`}
                >
                  Horizontal
                </Button>
                <Button
                  onClick={() => setShipOrientation('vertical')}
                  className={`${
                    shipOrientation === 'vertical'
                      ? 'bg-cyan-600 hover:bg-cyan-700'
                      : 'bg-slate-600 hover:bg-slate-500'
                  } text-white font-bold px-4 py-2`}
                >
                  Vertical
                </Button>
                <Button
                  onClick={() => setShipOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {gamePhase === 'battle' && (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-400 mb-4 uppercase tracking-widest">🎯 Enemy Waters 🎯</h2>
              <div className="relative inline-block">
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
                    className={`text-sm font-semibold ${ship.sunk ? 'text-red-400' : 'text-slate-400'}`}
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
          <SonarRadar />
        </>
      )}
    </div>
  )
}

export default App
