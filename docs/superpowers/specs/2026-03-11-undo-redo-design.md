# Undo/Redo Design

**Date:** 2026-03-11
**Status:** Approved

## Goal

Add undo/redo to the pose editor so users can step back through pose changes without losing work. Triggered via UI buttons in the header and standard keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z).

## Scope

- Undo/redo for pose changes only (add, remove, rename, drag, JSON edits)
- UI buttons in app header (`Undo2`/`Redo2` from lucide-react)
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y and Ctrl+Shift+Z (redo)
- History capped at 50 entries

## Out of Scope

- Undoing scene option changes (Up Direction, Representation, view mode)
- Undo during simulation (deferred; simulation is a future feature)
- Per-action labels in the undo stack ("undo rename", "undo delete")

---

## Data Model

### `AppSnapshot`

```typescript
// src/types/AppSnapshot.ts
export interface AppSnapshot {
  poses: Poses;
  // Future: cameraTarget, panels, simulationConfig, parentage, etc.
}
```

`AppSnapshot` is the unit of history. It currently wraps only `poses`, but the named interface makes future extensions a localized change.

---

## `useUndoRedo<T>` Hook

```typescript
// src/hooks/useUndoRedo.ts
function useUndoRedo<T>(initial: T): {
  snapshot: T;
  set: (next: T) => void;       // push new history entry
  setSilent: (next: T) => void; // update current entry in-place, no new entry
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}
```

### Internal implementation

History state (`T[]` array and `number` index) lives in a `useRef` to avoid triggering re-renders on every drag frame. A separate `useState` tick counter forces a re-render when the visible snapshot actually changes. **`undo()` and `redo()` also increment the tick counter** so that `canUndo`, `canRedo`, and `snapshot` all update correctly after stepping through history.

`undo` and `redo` are wrapped in `useCallback` with empty dependency arrays (safe because they close over refs, not state). This ensures they are **stable references** and the keyboard shortcut `useEffect` in `App.tsx` does not re-register on every render.

History management:
- `set(next)` — truncates entries after `index`, appends `next`, advances `index`, increments tick. If history exceeds 50, drops the oldest entry.
- `setSilent(next)` — replaces `history[index]` in place. No truncation, no index change, no tick increment. The history cap is unaffected (in-place replacement, not an append).
- `undo()` — decrements `index`, increments tick (no-op if `index === 0`)
- `redo()` — increments `index`, increments tick (no-op if `index === history.length - 1`)
- `canUndo` — `index > 0` (computed from refs at render time)
- `canRedo` — `index < history.length - 1` (computed from refs at render time)

---

## Integration in `App.tsx`

Replace:
```typescript
const [poses, setPoses] = useState<Poses>(defaultPoses);
```

With:
```typescript
const { snapshot, set, setSilent, undo, redo, canUndo, canRedo } =
  useUndoRedo<AppSnapshot>({ poses: defaultPoses });
const poses = snapshot.poses;
```

### Setting poses — per mutation source

| Caller | Method | Rationale |
|--------|--------|-----------|
| `handleAdd` | `set({ poses: ... })` | Discrete action, push immediately |
| `handleRemove` | `set({ poses: ... })` | Discrete action, push immediately |
| `handleRename` | `set({ poses: ... })` | Fires on blur/Enter (already committed), push immediately |
| JSON editor `onChange` | `set({ poses })` | Already debounced 1000 ms internally; only fires on valid JSON |
| 3D drag `onChange` | `setSilent({ poses })` | Per-frame; live update only, no history entry |
| 3D drag `onChangeCommit` | `set({ poses })` | Pointer-up; commit to history |

**JSON editor note:** `JsonEditor` already maintains its own 1000 ms `useDebounce` and only calls `onChange` when the parsed JSON is valid. No additional debounce is needed in `App.tsx` — `handleJsonChange` simply calls `set({ poses })`.

### 3D drag commit — `onChangeCommit`

`PoseVisualizer` gains an optional `onChangeCommit?: (newPoses: Poses) => void` prop that fires once on pointer-up after a real drag (i.e., when `_hasDragged` is true and `activeDragControl` was set). The full data flow:

1. **`Controls.ts` (`MyControls`)** — add `public onDragCommit: (() => void) | null = null`. In `_onPointerUp`, after `activeDragControl.pointerUp()` and before clearing `activeDragControl`, add:
   ```typescript
   if (this._hasDragged && this.activeDragControl !== null) {
     this.onDragCommit?.();
   }
   ```

2. **`Scene.ts`** — add `public onDragCommit: (() => void) | null = null`. In the constructor, after creating `this.controls`:
   ```typescript
   this.controls.onDragCommit = () => this.onDragCommit?.();
   ```

3. **`PoseVisualizer/index.tsx`** — wire `scene.onDragCommit` inside the **`useEffect([poses, handleTransformChange])`** block (the same effect that re-adds frames), not at scene-creation time. This ensures the callback always closes over the current `poses` (so `...poses[index]` picks up the latest name etc.) rather than the stale value from scene construction:
   ```typescript
   scene.onDragCommit = () => {
     if (!onChangeCommit) return;
     const newPoses = scene.frames.map((frame, index) => ({
       ...poses[index],
       position: { x: frame.position.x, y: frame.position.y, z: frame.position.z },
       quaternion: { x: frame.quaternion.x, y: frame.quaternion.y, z: frame.quaternion.z, w: frame.quaternion.w },
     }));
     onChangeCommit(newPoses);
   };
   ```
   (`scene.frames` is already accessed directly in the existing `handleTransformChange`. Placing `onDragCommit` in the same effect follows that same pattern.)

4. **`App.tsx`**:
   ```tsx
   <PoseVisualizer
     poses={poses}
     onChange={poses => setSilent({ poses })}
     onChangeCommit={poses => set({ poses })}
     upDirection={upDirection}
     showWorldAxes={showWorldAxes}
   />
   ```

---

## Keyboard shortcuts

Global `keydown` listener in `App.tsx`. Note: `PoseVisualizer` already registers a global keydown listener for Q/W/E/S. There is no key conflict with Ctrl+Z/Y — these listeners coexist safely.

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y')                 { e.preventDefault(); redo(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'z')   { e.preventDefault(); redo(); }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [undo, redo]);
```

Because `undo` and `redo` are stable references, this effect registers once and never re-registers.

---

## UI

### Header buttons

`Undo2` and `Redo2` icons from lucide-react placed in the app header, right of the title:

```
┌─────────────────────────────────────────────────┐
│  ⊞  3D Pose Visualizer          [↩]  [↪]        │
└─────────────────────────────────────────────────┘
```

Disabled state when `!canUndo` / `!canRedo`: `opacity-40 cursor-not-allowed` on the button, `disabled` attribute set, and `aria-disabled="true"` for accessibility.

---

## File Changes

| File | Change |
|------|--------|
| `src/types/AppSnapshot.ts` | **Create** — `AppSnapshot` interface |
| `src/hooks/useUndoRedo.ts` | **Create** — generic undo/redo hook |
| `src/App.tsx` | **Modify** — wire hook, keyboard shortcuts, header buttons |
| `src/components/PoseVisualizer/index.tsx` | **Modify** — add `onChangeCommit` prop, wire `scene.onDragCommit` |
| `src/components/PoseVisualizer/Scene.ts` | **Modify** — add `onDragCommit` public callback, wire from controls |
| `src/components/PoseVisualizer/controls/Controls.ts` | **Modify** — add `onDragCommit` callback, fire from `_onPointerUp` after drag |
