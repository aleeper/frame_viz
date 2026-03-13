# Spec D: Pinned Expressions + Right Sidebar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right sidebar panel that shows user-pinned transform expressions (e.g. `world_T_shoulder`). Each expression is computed live from the current frame states. The panel supports adding, viewing, and removing pinned expressions.

**Architecture:** `PinnedExpression` type + `AppSnapshot.pinnedExpressions` field → `PinnedPanel` component reads from `AppSnapshot` and computes values via `composePath` → the existing right sidebar scaffold (Spec C) is wired to show `PinnedPanel` instead of the placeholder.

**Tech Stack:** React, TypeScript, Tailwind CSS, existing `transforms.ts` module.

**Prerequisite:** Spec A (transforms.ts, nanoid installed) and Spec C (right sidebar scaffold with `rightPanel` state, FrameList) must be complete. `nanoid` is already in `package.json` dependencies after Spec A — no additional install needed. The `rightPanel` state variable and activity bar are already in `App.tsx` after Spec C.

**Spec reference:** `docs/superpowers/specs/2026-03-12-frame-architecture-design.md` — Spec D section

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/types/PinnedExpression.ts` | `PinnedExpression` interface + validator |
| Modify | `src/types/AppSnapshot.ts` | Add `pinnedExpressions?: PinnedExpression[]` |
| Create | `src/components/PinnedPanel.tsx` | Right sidebar panel content: list + add form |
| Modify | `src/App.tsx` | Add CRUD handlers for `pinnedExpressions`; pass to `PinnedPanel`; replace placeholder |

---

## Chunk 1: Data model

### Task 1: Create PinnedExpression type

**Files:**
- Create: `src/types/PinnedExpression.ts`

- [ ] **Step 1: Write the type file**

  Create `src/types/PinnedExpression.ts`:

  ```ts
  /**
   * A pinned expression is a derived quantity computed from two frames that the
   * user wants to continuously observe.
   *
   * The `kind` field is extensible: 'rotation' | 'position' and future kinematic
   * types (velocity, etc.) may be added without breaking existing entries.
   */
  export interface PinnedExpression {
    id: string;               // nanoid(8), stable
    base_frame_id: string;    // the "a" in a_T_b notation
    target_frame_id: string;  // the "b" in a_T_b notation
    kind: 'transform';        // extensible; only 'transform' is supported in the UI today
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/types/PinnedExpression.ts
  git commit -m "feat(spec-d): add PinnedExpression type"
  ```

---

### Task 2: Update AppSnapshot

**Files:**
- Modify: `src/types/AppSnapshot.ts`

- [ ] **Step 1: Add pinnedExpressions field**

  Replace the file contents with:

  ```ts
  import { Poses } from './Pose';
  import { PinnedExpression } from './PinnedExpression';

  export interface AppSnapshot {
    poses: Poses;
    pinnedExpressions?: PinnedExpression[];  // defaults to [] when absent
    // Future: cameraTarget, panels, simulationConfig, etc.
  }
  ```

  The field is typed as optional so existing history snapshots (and any serialized YAML) that predate Spec D remain valid. All read sites treat `undefined` as `[]`.

- [ ] **Step 2: Check TypeScript**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: No errors. App.tsx already references `snapshot.poses`; `snapshot.pinnedExpressions` is new and optional so nothing breaks.

- [ ] **Step 3: Commit**

  ```bash
  git add src/types/AppSnapshot.ts src/types/PinnedExpression.ts
  git commit -m "feat(spec-d): add pinnedExpressions to AppSnapshot"
  ```

---

## Chunk 2: PinnedPanel component

### Task 3: Create PinnedPanel component

**Files:**
- Create: `src/components/PinnedPanel.tsx`

The panel shows:
- A list of pinned expressions: label (`base_name_T_target_name`) + computed values + × button
- An error state for entries whose referenced frames are missing
- An "Add pin" form with two dropdowns (base frame, target frame)
- Values recompute on every pose change (via props, no internal state needed for values)
- Representation follows the global toggle

- [ ] **Step 1: Write the component**

  Create `src/components/PinnedPanel.tsx`:

  ```tsx
  import { useState } from 'react';
  import { nanoid } from 'nanoid';
  import { PinnedExpression } from '../types/PinnedExpression';
  import { Poses } from '../types/Pose';
  import { Representation } from '../types/Representation';
  import { composePath, posesToMap, multiply, invert } from '../utils/transforms';
  import { poseToTransformationMatrix } from '../utils/matrixUtils';
  import { MatrixDisplay } from './PoseDisplay/MatrixDisplay';
  import { PositionQuaternionDisplay } from './PoseDisplay/PositionQuaternionDisplay';
  import { EulerAngleDisplay } from './PoseDisplay/EulerAngleDisplay';
  import type { Pose } from '../types/Pose';

  interface PinnedPanelProps {
    poses: Poses;
    pinnedExpressions: PinnedExpression[];
    representation: Representation;
    onAdd: (expr: PinnedExpression) => void;
    onRemove: (id: string) => void;
  }

  export function PinnedPanel({
    poses,
    pinnedExpressions,
    representation,
    onAdd,
    onRemove,
  }: PinnedPanelProps) {
    const [addMode, setAddMode] = useState(false);
    const [baseId, setBaseId] = useState('');
    const [targetId, setTargetId] = useState('');

    const frameMap = posesToMap(poses);

    const handleAdd = () => {
      if (!baseId || !targetId) return;
      onAdd({ id: nanoid(8), base_frame_id: baseId, target_frame_id: targetId, kind: 'transform' });
      setAddMode(false);
      setBaseId('');
      setTargetId('');
    };

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Pinned entries list */}
        <div className="flex-1 overflow-y-auto space-y-2 p-2">
          {pinnedExpressions.length === 0 && (
            <p className="text-xs text-gray-500 italic">No pinned expressions yet.</p>
          )}
          {pinnedExpressions.map(expr => (
            <PinnedEntry
              key={expr.id}
              expr={expr}
              poses={poses}
              frameMap={frameMap}
              representation={representation}
              onRemove={onRemove}
            />
          ))}
        </div>

        {/* Add form */}
        <div className="border-t border-gray-700 p-2 shrink-0">
          {addMode ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 w-8 shrink-0">Base</span>
                <select
                  className="flex-1 text-xs bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white"
                  value={baseId}
                  onChange={e => setBaseId(e.target.value)}
                >
                  <option value="">— pick —</option>
                  {poses.map(p => (
                    <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 w-8 shrink-0">Target</span>
                <select
                  className="flex-1 text-xs bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white"
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                >
                  <option value="">— pick —</option>
                  {poses.map(p => (
                    <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-1 justify-end">
                <button
                  className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                  onClick={() => setAddMode(false)}
                >
                  Cancel
                </button>
                <button
                  className="text-xs px-2 py-0.5 rounded bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-40"
                  onClick={handleAdd}
                  disabled={!baseId || !targetId}
                >
                  Pin
                </button>
              </div>
            </div>
          ) : (
            <button
              className="w-full text-xs text-green-400 hover:text-green-300 py-0.5"
              onClick={() => setAddMode(true)}
            >
              + Pin expression
            </button>
          )}
        </div>
      </div>
    );
  }

  interface PinnedEntryProps {
    expr: PinnedExpression;
    poses: Poses;
    frameMap: Map<string, Pose>;
    representation: Representation;
    onRemove: (id: string) => void;
  }

  function PinnedEntry({ expr, poses, frameMap, representation, onRemove }: PinnedEntryProps) {
    const baseFrame = poses.find(p => p.id === expr.base_frame_id);
    const targetFrame = poses.find(p => p.id === expr.target_frame_id);

    const missingBase = !baseFrame;
    const missingTarget = !targetFrame;
    const hasError = missingBase || missingTarget;

    const baseName = baseFrame?.name ?? expr.base_frame_id;
    const targetName = targetFrame?.name ?? expr.target_frame_id;
    const label = `${baseName}_T_${targetName}`;

    // Compute the transform: base_T_target = invert(global_T_base) × global_T_target
    let computedPose = null;
    if (!hasError) {
      try {
        const global_T_base = composePath(expr.base_frame_id, frameMap);
        const global_T_target = composePath(expr.target_frame_id, frameMap);
        computedPose = multiply(invert(global_T_base), global_T_target);
      } catch {
        // composePath can throw for dangling refs — treat as error
      }
    }

    return (
      <div className={`rounded border p-2 space-y-1 ${hasError ? 'border-yellow-800 bg-yellow-950' : 'border-gray-700 bg-gray-900'}`}>
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className={`font-mono text-xs font-bold ${hasError ? 'text-yellow-500' : 'text-blue-400'}`}>
            {label}
          </span>
          <button
            className="text-gray-500 hover:text-red-400 text-xs shrink-0 ml-1"
            onClick={() => onRemove(expr.id)}
            aria-label={`Remove ${label}`}
          >
            ×
          </button>
        </div>

        {/* Value or error */}
        {hasError ? (
          <p className="text-xs text-yellow-600">
            ⚠ frame not found ({missingBase ? `base: ${expr.base_frame_id}` : ''}{missingBase && missingTarget ? ', ' : ''}{missingTarget ? `target: ${expr.target_frame_id}` : ''})
          </p>
        ) : computedPose ? (
          <div className="text-xs">
            {renderPinnedValue(computedPose, representation)}
          </div>
        ) : (
          <p className="text-xs text-red-500">⚠ computation error</p>
        )}
      </div>
    );
  }

  function renderPinnedValue(pose: Pose, representation: Representation) {
    if (representation === 'Matrix') {
      return <MatrixDisplay matrix={poseToTransformationMatrix(pose)} />;
    } else if (representation === 'Quaternion') {
      return <PositionQuaternionDisplay pose={pose} />;
    } else if (representation.startsWith('Euler')) {
      return <EulerAngleDisplay pose={pose} representation={representation} />;
    }
    return null;
  }
  ```

- [ ] **Step 2: Check TypeScript**

  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/PinnedPanel.tsx
  git commit -m "feat(spec-d): add PinnedPanel component"
  ```

---

## Chunk 3: Wire everything into App.tsx

### Task 4: Update App.tsx with pinned expressions CRUD and panel wiring

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add PinnedExpression import and PinnedPanel import**

  In the imports section, add:

  ```ts
  import type { PinnedExpression } from './types/PinnedExpression';
  import { PinnedPanel } from './components/PinnedPanel';
  ```

- [ ] **Step 2: Update useUndoRedo initial value**

  The `useUndoRedo` initial value should include `pinnedExpressions`:

  ```ts
  const { snapshot, set, undo, redo, canUndo, canRedo } =
    useUndoRedo<AppSnapshot>({ poses: defaultPoses, pinnedExpressions: [] });
  ```

- [ ] **Step 3: Add pinned expressions CRUD handlers**

  Add these callbacks after the existing handlers in App:

  ```ts
  const pinnedExpressions = snapshot.pinnedExpressions ?? [];

  const handleAddPin = useCallback((expr: PinnedExpression) =>
    set({ ...snapshot, pinnedExpressions: [...(snapshot.pinnedExpressions ?? []), expr] }),
    [snapshot, set]);

  const handleRemovePin = useCallback((id: string) =>
    set({ ...snapshot, pinnedExpressions: (snapshot.pinnedExpressions ?? []).filter(e => e.id !== id) }),
    [snapshot, set]);
  ```

  Note: pinned expression changes go through `set()` and are therefore undoable. This is intentional — if a user accidentally pins the wrong expression, they can undo.

- [ ] **Step 4: Replace right sidebar placeholder with PinnedPanel**

  Verify `rightPanel` state and the right sidebar JSX shell are already present in `App.tsx` (added in Spec C). If not, complete Spec C first.

  Find the right panel JSX added in Spec C:

  ```tsx
  <div className="flex-1 p-2 text-xs text-gray-500 italic">
    Coming in Spec D…
  </div>
  ```

  Replace with:

  ```tsx
  {rightPanel === 'pinned' && (
    <PinnedPanel
      poses={poses}
      pinnedExpressions={pinnedExpressions}
      representation={representation}
      onAdd={handleAddPin}
      onRemove={handleRemovePin}
    />
  )}
  ```

  Also update the panel title in the header to read "Pinned" when `rightPanel === 'pinned'`.

- [ ] **Step 5: Also update handleRemove to clean up pinnedExpressions**

  When a frame is deleted, pinned entries that reference it should NOT be auto-removed — per the spec, they show an error state instead. So no change is needed here. The `⚠ frame not found` error in `PinnedEntry` handles this case.

- [ ] **Step 6: Check TypeScript**

  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: No errors.

- [ ] **Step 7: End-to-end smoke test**

  ```bash
  npm run dev
  ```

  Test the full workflow:
  1. Open the app with two default frames.
  2. Open right sidebar (click ⇄ activity bar icon).
  3. Click "+ Pin expression". Select base = Pose1, target = Pose 2. Click Pin.
  4. Verify the pinned entry shows label `Pose1_T_Pose 2` with correct position values.
  5. Drag Pose 2 — verify the pinned entry updates live.
  6. Change the global representation (Quaternion / Matrix / Euler) — verify the pinned entry format changes.
  7. Delete Pose 2 — verify the pinned entry shows `⚠ frame not found` in yellow, and is NOT auto-removed.
  8. Click × on the pinned entry — it is removed.
  9. Undo — pinned entry reappears (it's part of AppSnapshot).
  10. Collapse the sidebar (click ⇄ again) — 3D view expands to fill the space.

- [ ] **Step 8: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(spec-d): wire PinnedPanel into App with CRUD handlers"
  ```

---

## Summary

After completing Spec D:
- Users can pin any `a_T_b` transform between any two frames and see it update live as they drag
- Pinned expressions are part of `AppSnapshot` and therefore participate in undo/redo
- Missing-frame error state gives a clear warning without silent data loss
- The right sidebar activity bar pattern is established for future panel additions
- Representation toggle applies globally to both the frame list and pinned panel values

**All four specs are now complete.** The app has gone from a flat pose editor to a full scene graph editor with frame hierarchy, explicit transform math, a pinned expressions panel, and a comprehensive unit test suite.
