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

**Last Updated:** November 13, 2025  
**Maintained By:** Devin AI  
**Project Owner:** Rudi Willner
