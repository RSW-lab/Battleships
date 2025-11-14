# Debug Log - Battleships Game Development

This document tracks all errors encountered during development and the solutions implemented. This serves as a reference for anyone reviewing the project to understand the debugging process and technical decisions made.

---

## Error 1: AI Turn Freeze Bug

**Date:** November 13, 2025  
**Severity:** Critical  
**Status:** ✅ Fixed

### Problem
The game would freeze during the AI's turn after hitting the player's ship. The AI would not continue attacking and the game became unresponsive.

### Root Cause
Stale closure issue in the `aiTurn()` function. When using `setTimeout` callbacks, the function was capturing old state values instead of current ones, causing the AI to reference outdated board state and ship data.

### Solution
Converted state management to use `useRef` for mutable values that need to persist across renders:
- `aiTargetQueueRef` - Queue of cells to target after a hit
- `lastHitRef` - Last successful hit coordinates
- Used refs in `setTimeout` callbacks to access current values

### Code Changes
```typescript
const aiTargetQueueRef = useRef<[number, number][]>([])
const lastHitRef = useRef<[number, number] | null>(null)

// In aiTurn function, use refs instead of state
aiTargetQueueRef.current = [...aiTargetQueueRef.current, ...adjacentCells]
```

### Testing
Verified AI continues attacking after hits and successfully sinks all ships without freezing.

---

## Error 2: White Screen After "Commence Operations"

**Date:** November 13, 2025  
**Severity:** Critical  
**Status:** ✅ Fixed

### Problem
After clicking "Commence Operations" button, the screen would turn completely white and the game would not render.

### Root Cause
React Rules of Hooks violation. The `useMemo` hook was being called conditionally inside JSX rendering logic, which violates React's requirement that hooks must be called in the same order on every render.

### Solution
Moved all hook calls (including `useMemo` for computing ship placements) to the top level of the component, before any conditional rendering logic.

### Code Changes
```typescript
// BEFORE (incorrect):
{gamePhase === 'placement' && (
  <ShipOverlays placements={useMemo(...)} /> // ❌ Conditional hook
)}

// AFTER (correct):
const playerPlacements = useMemo(() => 
  computePlacements(playerBoard, playerShips), 
  [playerBoard, playerShips]
)

{gamePhase === 'placement' && (
  <ShipOverlays placements={playerPlacements} /> // ✅ Hook at top level
)}
```

### Testing
Verified game renders correctly after clicking "Commence Operations" and ship placement phase works properly.

---

## Error 3: Ship Image Rotation Stretching

**Date:** November 13, 2025  
**Severity:** Medium  
**Status:** ✅ Fixed

### Problem
When ships were rotated to horizontal orientation, the images appeared stretched and distorted instead of maintaining their natural aspect ratio.

### Root Cause
The rotation logic was applying CSS transform to the container while also constraining both width and height, causing the aspect ratio to be forced into the wrong dimensions.

### Solution
Implemented a two-layer approach:
1. Outer container: sized to the ship's footprint (e.g., 5 cells wide × 1 cell tall for horizontal)
2. Inner rotator: applies the 90-degree rotation
3. Image: fills the rotator with proper aspect ratio maintained

### Code Changes
Separated rotation transform from sizing constraints to preserve aspect ratio during rotation.

### Testing
Verified ships maintain proper proportions in both horizontal and vertical orientations.

---

## Error 4: Board Labels Showing Wrong Values

**Date:** November 13, 2025  
**Severity:** Medium  
**Status:** ✅ Fixed

### Problem
After expanding to 12×12 board, the column labels showed "11, 12, A, B, C" instead of "A, B, C, D, E, F, G, H, I, J, K, L" and row labels were misaligned.

### Root Cause
The grid was using hardcoded `grid-cols-11` Tailwind class which only works for 10×10 boards (10 cells + 1 label column = 11 columns). With a 12×12 board, we need 13 columns (12 cells + 1 label column).

### Solution
Replaced hardcoded Tailwind class with dynamic inline style:
```typescript
style={{ gridTemplateColumns: `repeat(${BOARD_SIZE + 1}, minmax(0, 1fr))` }}
```

This ensures the grid automatically adjusts to any board size.

### Testing
Verified labels show correctly for 12×12 board: columns 1-12 across top, rows A-L down left side.

---

## Error 5: Horizontal Ships Rendering Tiny

**Date:** November 13, 2025  
**Severity:** High  
**Status:** ✅ Fixed (Multiple Iterations)

### Problem
Horizontal ships appeared much smaller than vertical ships, even though they should be the same size.

### Root Cause (Iteration 1)
When rotating 90 degrees, the image's `height: 100%` constraint became its visual width after rotation. For a 1-cell-tall horizontal ship, this meant the image was only 40px wide visually, even though the container was 200px wide (5 cells × 40px).

### Solution Attempt 1
Moved rotation to the `<img>` element and swapped sizing:
- Horizontal: `width: 100%`, `height: auto`, `maxHeight: 100%`, `rotate(90deg)`
- Vertical: `height: 100%`, `width: auto`, `maxWidth: 100%`

**Result:** Still too small! ❌

### Root Cause (Iteration 2)
The `maxHeight: 100%` constraint was still limiting the horizontal ships before rotation, causing them to be squeezed.

### Solution Attempt 2 (Final Fix)
Implemented "wrapper-swap" approach:
1. Outer footprint container: `width = length × cell`, `height = width × cell`
2. Inner rotator (for horizontal only): `width = footprintHeight`, `height = footprintWidth`, `rotate(90deg)`
3. Image inside rotator: `width: 100%`, `height: 100%`, `object-fit: contain`

This ensures the rotated inner box dimensions map correctly to the footprint after rotation.

### Code Changes
```typescript
// Horizontal ships
<div style={{ width: footprintWidth, height: footprintHeight }}>
  <div style={{ 
    width: footprintHeight,  // Swap!
    height: footprintWidth,  // Swap!
    transform: 'rotate(90deg)' 
  }}>
    <img style={{ width: '100%', height: '100%' }} />
  </div>
</div>
```

### Testing
Verified horizontal ships now render at the same size as vertical ships across all 7 ship types.

---

## Error 6: Ship Orientation Detection Incorrect for Rectangular Ships

**Date:** November 13, 2025  
**Severity:** High  
**Status:** ✅ Fixed

### Problem
The `computePlacements()` function was incorrectly detecting ship orientation for rectangular ships like the Carrier (2 cells wide × 7 cells long).

### Root Cause
The orientation detection logic used:
```typescript
const orientation = new Set(rows).size === 1 ? 'horizontal' : 'vertical'
```

This only works for single-width ships (1 cell wide). For a horizontal Carrier occupying rows 5-6 and columns 2-8, `new Set(rows).size` would be 2, incorrectly marking it as vertical.

### Solution
Implemented bounding box logic that compares width span vs height span:
```typescript
const minRow = Math.min(...rows), maxRow = Math.max(...rows)
const minCol = Math.min(...cols), maxCol = Math.max(...cols)
const heightSpan = maxRow - minRow + 1
const widthSpan = maxCol - minCol + 1
const orientation = widthSpan > heightSpan ? 'horizontal' : 'vertical'
```

### Testing
Verified orientation detection works correctly for all ships in both orientations, including the 2-wide Carrier.

---

## Error 7: Red Hit Markers Hidden Behind Ship Images

**Date:** November 13, 2025  
**Severity:** Medium  
**Status:** ✅ Fixed

### Problem
When ships were hit, the red target icons (hit markers) appeared behind the ship images, making it difficult to see where hits occurred.

### Root Cause
Incorrect z-index layering. Ship overlays had no explicit z-index, defaulting to z-0, same as the cell contents. Since ship overlays were rendered after cells in the DOM, they appeared on top.

### Solution
Implemented proper z-index layering:
- Cells: z-0 (base layer)
- Ship overlays: z-10 (middle layer)
- Hit/miss markers: z-30 (top layer)

Also added `pointer-events-none` to markers to ensure clicks pass through to cells.

### Code Changes
```typescript
// Ship overlays
<div className="absolute pointer-events-none flex items-center justify-center z-10">

// Hit markers
<div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
  <Target className="w-6 h-6 text-white animate-spin" />
</div>
```

### Testing
Verified red target icons and blue wave icons now appear on top of ship images.

---

## Error 8: Boards Not Fitting Side-by-Side

**Date:** November 13, 2025  
**Severity:** Medium  
**Status:** ✅ Fixed

### Problem
After expanding to 15×15 boards with 56px cells, both boards were too wide to fit side-by-side on desktop screens and were stacking vertically.

### Root Cause
Two issues:
1. Cell size too large: 15 cells × 56px + 1 label × 56px = 896px per board. Two boards = 1792px + gaps, exceeding 1920px screen width.
2. Layout using `flex-wrap` which allows wrapping to next line instead of forcing side-by-side.

### Solution
1. Reduced cell size from 56px (w-14 h-14) to 48px (w-12 h-12)
   - New calculation: 15 × 48 + 1 × 48 = 768px per board
   - Two boards: 1536px + gaps = fits comfortably on 1920px screens
2. Changed layout from `flex flex-wrap` to `flex flex-col lg:flex-row`
   - Mobile: stacks vertically (flex-col)
   - Desktop (lg+): side-by-side (flex-row)

### Code Changes
```typescript
// Cell size
const baseClass = 'w-12 h-12 ...' // Changed from w-14 h-14

// Layout
<div className="flex flex-col lg:flex-row justify-center gap-8 mb-8 items-start">
```

### Testing
Verified boards appear side-by-side on desktop screens (1920px+) and stack on mobile/tablet.

---

## Error 9: Git Repository Not Initialized

**Date:** November 13, 2025  
**Severity:** Low  
**Status:** ✅ Fixed

### Problem
User requested to commit and push to main, but the project directory was not a git repository.

### Root Cause
The project was created using `create_react_app` which doesn't automatically initialize git.

### Solution
1. Initialized git repo: `git init`
2. Renamed default branch from master to main: `git branch -m main`
3. Added remote: `git remote add origin https://github.com/RSW-lab/Battleships.git`
4. Created feature branch: `git checkout -b devin/1763075966-checkpoint-before-session-reset`
5. Added and committed all files
6. Pushed to remote

### Testing
Verified code successfully pushed to GitHub repository.

---

## Error 10: Cannot Create PR - No Base Branch

**Date:** November 13, 2025  
**Severity:** Low  
**Status:** ✅ Fixed

### Problem
After pushing feature branch, could not create pull request because the remote repository had no main branch (brand new repo).

### Root Cause
The GitHub repository was newly created and empty. Pull requests require a base branch to compare against, but main didn't exist yet.

### Solution
User manually renamed the feature branch to "main" on GitHub's web interface, which initialized the main branch with all the code.

### Alternative Solutions Considered
1. Push directly to main (blocked by safety restrictions)
2. Create empty main branch first (would require direct push)
3. Use GitHub API to create main from feature branch (same restriction)

### Testing
Verified main branch exists on remote and contains all committed code.

---

## Summary Statistics

**Total Errors Encountered:** 10  
**Critical Errors:** 2 (AI freeze, white screen)  
**High Severity:** 2 (horizontal ships, orientation detection)  
**Medium Severity:** 4 (rotation stretching, labels, hit markers, board layout)  
**Low Severity:** 2 (git setup, PR creation)

**All Errors Resolved:** ✅ Yes  
**Game Status:** Fully functional and deployed

---

## Key Learnings

1. **React Hooks Rules:** Always call hooks at the top level, never conditionally
2. **Stale Closures:** Use refs for mutable values accessed in async callbacks
3. **CSS Transforms:** Rotation swaps dimensions - account for this in sizing logic
4. **Z-Index Layering:** Explicit z-index values prevent rendering order issues
5. **Dynamic Sizing:** Use inline styles with variables instead of hardcoded Tailwind classes for scalability
6. **Responsive Design:** Use Tailwind's responsive prefixes (lg:, md:) for adaptive layouts
7. **Git Workflow:** New repos require initial branch setup before PRs can be created

---

## Tools & Techniques Used

- **React DevTools:** Inspecting component state and props
- **Browser DevTools:** Debugging CSS layout and z-index issues
- **Console Logging:** Tracking AI state and targeting logic
- **Git Bisect:** (Not needed, but available for regression debugging)
- **Smart Friend Consultation:** Technical guidance on complex issues
- **Incremental Testing:** Testing each fix before moving to next issue

---

## Error 11: Missing Closing Brace in aiTurn Function

**Date:** November 13, 2025  
**Severity:** High  
**Status:** ✅ Fixed

### Problem
After implementing missile launch animation in the aiTurn function, the code had a syntax error: "Expected ')' but found 'const'". The build failed with esbuild error pointing to the resetGame function declaration.

### Root Cause
When adding the missile launch animation to the aiTurn function, I added a new setTimeout wrapper around the attack logic but forgot to close it with the proper closing brace and parenthesis. The function had:
- Opening setTimeout at line 564: `setTimeout(() => {`
- Inner setTimeout at line 604: `setTimeout(() => {`
- Only one closing at line 667: `}, 600)`
- Missing the outer setTimeout closing: `}, 1000)`

### Solution
Added the missing closing brace and parenthesis for the outer setTimeout:
```typescript
      }, 600)
    }, 1000)  // Added this line
  }
```

### Testing
Verified the dev server starts successfully and the game loads without errors.

---

## Error 12: Premature Ship Sinking Bug

**Date:** November 13, 2025  
**Severity:** Critical  
**Status:** ✅ Fixed

### Problem
Ships were being marked as sunk before all their cells were hit. User reported seeing fire effects on partially-hit ships in the deployed game.

### Root Cause
The `handleAttack` function had a race condition. During the 600ms missile animation delay, the `isPlayerTurn` flag remained true and the board state wasn't updated yet, allowing multiple clicks on the same cell or different cells of the same ship. Each click would increment the ship's hit counter, causing the ship to be marked as sunk prematurely.

### Solution
Added an `attackInProgress` state flag to prevent multiple attacks during the animation:
```typescript
const [attackInProgress, setAttackInProgress] = useState(false)

const handleAttack = async (row: number, col: number) => {
  if (!isPlayerTurn || gamePhase !== 'battle' || ... || attackInProgress) {
    return
  }
  setAttackInProgress(true)
  // ... attack logic ...
  // Reset flag after attack completes or AI turn starts
  setAttackInProgress(false)
}
```

Also updated `aiTurn` to reset the flag when the AI finishes its turn.

### Testing
Verified that clicking multiple times during missile animation no longer increments hit counter multiple times.

---

## Error 13: Rectangular Grid Cells Instead of Squares

**Date:** November 13, 2025  
**Severity:** High  
**Status:** ✅ Fixed

### Problem
Grid cells were appearing rectangular/stretched instead of square, making the game look distorted.

### Root Cause
The grid was using `gridTemplateColumns: repeat(BOARD_SIZE + 1, minmax(0, 1fr))` which creates fluid columns that adapt to available space. Without explicit row heights, the cells became rectangular. Individual cells had `w-12 h-12` classes, but CSS Grid track sizing takes precedence over child element sizing.

### Solution
Changed to explicit pixel-based square cells:
1. Added `CELL_SIZE = 40` constant
2. Updated grid template to use fixed pixel sizes:
```typescript
style={{ 
  gridTemplateColumns: `repeat(${BOARD_SIZE + 1}, ${CELL_SIZE}px)`,
  gridTemplateRows: `repeat(${BOARD_SIZE + 1}, ${CELL_SIZE}px)`
}}
```
3. Removed `w-12 h-12` from cell classes since grid tracks now enforce size
4. Updated all header cells to use explicit pixel sizing

### Testing
Verified that all grid cells are now perfect squares.

---

## Error 14: Ship Image Positioning Offset

**Date:** November 13, 2025  
**Severity:** High  
**Status:** ✅ Fixed

### Problem
Ship images were appearing offset to the right of their actual grid positions, sometimes extending outside the grid boundaries.

### Root Cause
The `gridRef` was attached to a wrapper div (`<div className="relative inline-block" ref={playerGridRef}>`) instead of the actual grid container. When `useGridMetrics` calculated offsets, it measured from the wrapper's bounding rect, but the actual grid was inside that wrapper with additional padding/margins. This caused `ShipOverlays` to position ships relative to the wrong element, creating a consistent rightward offset.

### Solution
1. Modified `renderBoard` to accept an optional `gridRef` parameter
2. Attached the ref directly to the grid container (the div with `gridTemplateColumns/Rows`)
3. Removed ref from the wrapper div
4. Updated all `renderBoard` calls to pass the appropriate gridRef

```typescript
const renderBoard = (board: Cell[][], isPlayerBoard: boolean, gridRef?: React.RefObject<HTMLDivElement>) => {
  return (
    <div className="inline-block">
      <div ref={gridRef} className="grid ...">
        {/* grid content */}
      </div>
    </div>
  )
}

// Usage:
{renderBoard(playerBoard, true, playerGridRef)}
```

### Testing
Verified that ship images now align perfectly with their grid cells during placement and battle phases.

---

## Error 15: Grid Taking Too Much Screen Space

**Date:** November 13, 2025  
**Severity:** Medium  
**Status:** ✅ Fixed

### Problem
The grids were taking up too much screen real estate, making it difficult to see content below the grids.

### Root Cause
Cells were using `w-12 h-12` (48px / 3rem) which made the 15x15 grid very large: 15 * 48 = 720px per grid, plus headers and padding.

### Solution
Reduced `CELL_SIZE` from 48px to 40px, making the grid more compact:
- Grid size reduced from ~720px to ~600px per board
- Total space savings: ~240px across both boards
- Still large enough for comfortable interaction on desktop and mobile

### Testing
Verified that the smaller grid size improves layout while maintaining usability.

---

## Error 16: AI Re-attacking Already-Hit Cells

**Date:** November 14, 2025  
**Severity:** Critical  
**Status:** ✅ Fixed

### Problem
The AI was attacking cells that had already been hit, and when it did, the cell state would change from 'hit' (red) back to 'empty' (blue), effectively erasing previous hits. This made it appear as if ships were being un-damaged.

### Root Cause
Two issues in the `aiTurn` function:

1. **Queue filtering**: When dequeuing from `aiTargetQueueRef`, the code didn't check if the cell had already been attacked. Adjacent cells were added to the queue when a ship was hit, but if those cells were attacked before being dequeued, they would still be in the queue.

2. **State overwriting**: The attack logic had:
```typescript
if (cell.state === 'ship') {
  cell.state = 'hit'
} else {
  cell.state = 'miss'  // This overwrites 'hit' cells!
}
```
When the AI attacked an already-hit cell, `cell.state === 'ship'` was false, so it fell into the else block and set the cell to 'miss', overwriting the previous 'hit' state.

### Solution
Implemented two fixes:

1. **Skip already-attacked cells in queue**:
```typescript
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
  // Fall back to random if all queued cells are already attacked
  if (!foundTarget) {
    // ... random targeting ...
  }
}
```

2. **Only set 'miss' for empty cells**:
```typescript
if (cell.state === 'ship') {
  cell.state = 'hit'
  // ... hit logic ...
} else if (cell.state === 'empty') {
  cell.state = 'miss'
  // ... miss logic ...
}
// If cell is already hit or miss, don't change it
```

### Testing
Verified that the AI no longer attacks already-hit cells, and if it somehow does, the cell state is not overwritten.

---

## Error 17: Excessive Screen Space Usage

**Date:** November 14, 2025  
**Severity:** High  
**Status:** ✅ Fixed

### Problem
The game grids were taking up too much screen space, requiring users to scroll up and down to see content below the grids. Even after reducing cell size from 48px to 40px in the previous fix, the grids were still too large for comfortable viewing on typical laptop screens.

### Root Cause
The `CELL_SIZE` constant was set to 40px, which for a 15x15 grid resulted in a board size of 600px (plus padding and borders). Combined with two boards side-by-side and headers, this exceeded the comfortable viewport height for most users.

### Solution
Reduced `CELL_SIZE` from 40px to 34px:
```typescript
const CELL_SIZE = 34  // Previously 40
```

This reduces each board's height by 90px (6px × 15 cells), providing 180px more vertical space for the overall layout. The 34px cell size still maintains good visibility and usability while fitting better on standard laptop screens (typically 768-900px viewport height).

### Testing
Verified that the smaller grid size improves screen layout and reduces the need for scrolling while maintaining playability and readability.

---

## Error 18: Player Turn Logic Asymmetry

**Date:** November 14, 2025  
**Severity:** Critical  
**Status:** ✅ Fixed

### Problem
When the player hit an enemy ship, they only got one shot before the AI took its turn. However, when the AI hit a player ship, the AI continued shooting until it missed. This created an unfair gameplay asymmetry where the AI had a significant advantage.

### Root Cause
In the `handleAttack` function (lines 553-567), both branches of the conditional called `aiTurn()`:

```typescript
if (cell.state === 'hit' && !updatedAiShips.every(s => s.sunk)) {
  setTimeout(() => {
    setIsPlayerTurn(false)  // Wrong! Should stay player's turn
    setAttackInProgress(false)
    aiTurn()  // Wrong! Should let player shoot again
  }, 1500)
} else if (!updatedAiShips.every(s => s.sunk)) {
  setTimeout(() => {
    setIsPlayerTurn(false)
    setAttackInProgress(false)
    aiTurn()
  }, 1500)
}
```

The AI's `aiTurn` function correctly implemented consecutive shots on hit (line 683-684), but the player's logic didn't mirror this behavior.

### Solution
Modified the first branch to keep the player's turn active after a hit:

```typescript
if (cell.state === 'hit' && !updatedAiShips.every(s => s.sunk)) {
  setTimeout(() => {
    setIsPlayerTurn(true)  // Keep player's turn!
    setAttackInProgress(false)
    // Don't call aiTurn() - let player shoot again
  }, 1500)
} else if (!updatedAiShips.every(s => s.sunk)) {
  setTimeout(() => {
    setIsPlayerTurn(false)
    setAttackInProgress(false)
    aiTurn()
  }, 1500)
}
```

Now the player gets consecutive shots after hitting enemy ships, just like the AI does, creating fair and balanced gameplay.

### Testing
Verified that the player can now take multiple consecutive shots after hitting enemy ships, and the turn only switches to the AI after a miss.

---

## Error 19: Sunk Ship Images Hidden Behind Fire Effects

**Date:** November 14, 2025  
**Severity:** High  
**Status:** ✅ Fixed

### Problem
When enemy ships were sunk, the ship images should have appeared on top of the fire effects to show which ship was destroyed. Instead, the ship images were rendering behind the fire effects, making them invisible or barely visible.

### Root Cause
Z-index stacking order was inverted:
- `ShipOverlays` component had `z-10` (line 130)
- Fire effect overlay had `z-20` (line 772)

This meant fire effects (z-20) appeared above ship images (z-10), hiding the ships.

### Solution
Inverted the z-index values to create proper layering:

1. **Increased ShipOverlays z-index** from z-10 to z-30:
```typescript
<div className="absolute inset-0 pointer-events-none z-30">
```

2. **Decreased fire effect z-index** from z-20 to z-10:
```typescript
<div className="absolute inset-0 z-10 pointer-events-none">
  <div className="fire-effect absolute inset-0 bg-gradient-to-t from-orange-600 via-red-500 to-yellow-400 opacity-60"></div>
</div>
```

The final stacking order is now:
- Grid cells: z-0 (base layer)
- Fire effects: z-10
- Hit/miss icons: z-30
- Ship images: z-30 (same level as icons, appears above fire)
- Missiles: z-40 (MissileOverlay component)

### Testing
Verified that sunk ship images now appear clearly above fire effects on the enemy board, making it easy to see which ships have been destroyed.

---

**Last Updated:** November 14, 2025  
**Maintained By:** Devin AI  
**Project Owner:** Rudi Willner
