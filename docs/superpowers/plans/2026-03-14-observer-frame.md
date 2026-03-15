# Observer Frame Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the implicit global origin with a named "observer frame" concept — the frame nailed to the renderer origin — so all 3D display is relative to a user-selected frame, and frames disconnected from the observer tree show warnings.

**Architecture:** `observerFrameId` lives in a new `ViewState` struct (display concept, not data model). Rendering changes to `observer_T_frame = invert(composePath(observerId)) × composePath(id)`. Frames in disconnected trees are flagged but not rendered. No tree inversion or forced identity on stored pose data.

**Tech Stack:** TypeScript, React, Three.js, Tailwind CSS, Vitest

---

## Chunk 1: Foundations — types, helpers, and default data

### Task 1: Topology notes + ViewState type

**Files:**
- Create: `docs/notes/topology-view.md` ✅ (already done)
- Create: `src/types/ViewState.ts`
- Modify: `src/types/AppSnapshot.ts`

- [ ] **Step 1: Create ViewState type**

```typescript
// src/types/ViewState.ts
/**
 * Per-view display settings. Each 3D view has its own ViewState.
 * Currently there is one view; future: views: ViewState[] in AppSnapshot.
 *
 * observerFrameId: the frame nailed to the renderer origin.
 * All other frames are shown relative to it.
 * Frames not connected to this frame's tree are not rendered.
 */
export interface ViewState {
  observerFrameId: string;
}
```

- [ ] **Step 2: Add ViewState to AppSnapshot**

In `src/types/AppSnapshot.ts`, add `view: ViewState`:

```typescript
import { Poses } from './Pose';
import { PinnedExpression } from './PinnedExpression';
import { ViewState } from './ViewState';

export interface AppSnapshot {
  poses: Poses;
  pinnedExpressions?: PinnedExpression[];  // defaults to [] when absent; optional for backward compat
  view?: ViewState;  // optional for backward compat; defaults computed from poses at runtime
  // Future: views: ViewState[] for multi-view
}
```

- [ ] **Step 3: Update Pose.ts comment** — the `parent_id` comment says "Absent = root in global space". Change to "Absent = tree root (no implicit global)":

```typescript
parent_id?: string;  // references another Pose's id. Absent = tree root (no implicit global frame).
```

- [ ] **Step 4: Commit**

```bash
git add src/types/ViewState.ts src/types/AppSnapshot.ts src/types/Pose.ts docs/notes/topology-view.md
git commit -m "feat: add ViewState type with observerFrameId to AppSnapshot"
```

---

### Task 2: getTreeRoot helper + isConnectedToObserver

**Files:**
- Modify: `src/components/FrameList/frameTreeUtils.ts`
- Modify: (tests are inline in the same test file if one exists, or create `src/components/FrameList/frameTreeUtils.test.ts`)

- [ ] **Step 1: Write failing tests**

Create `src/components/FrameList/frameTreeUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTreeRoot, isConnectedToObserver } from './frameTreeUtils';
import { Pose } from '../../types/Pose';

const p = (id: string, parent_id?: string): Pose => ({
  id, parent_id,
  position: { x: 0, y: 0, z: 0 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
});

describe('getTreeRoot', () => {
  it('returns self when no parent', () => {
    const frames = [p('a')];
    expect(getTreeRoot('a', frames)).toBe('a');
  });

  it('walks up to the root', () => {
    const frames = [p('a'), p('b', 'a'), p('c', 'b')];
    expect(getTreeRoot('c', frames)).toBe('a');
    expect(getTreeRoot('b', frames)).toBe('a');
    expect(getTreeRoot('a', frames)).toBe('a');
  });

  it('treats dangling parent_id as root', () => {
    // parent_id references a frame not in the list
    const frames = [p('b', 'missing')];
    expect(getTreeRoot('b', frames)).toBe('b');
  });
});

describe('isConnectedToObserver', () => {
  it('returns true when same tree', () => {
    const frames = [p('world'), p('a', 'world'), p('b', 'a')];
    expect(isConnectedToObserver('b', 'world', frames)).toBe(true);
    expect(isConnectedToObserver('a', 'world', frames)).toBe(true);
    expect(isConnectedToObserver('world', 'world', frames)).toBe(true);
  });

  it('returns false when different tree', () => {
    const frames = [p('world'), p('a', 'world'), p('isolated')];
    expect(isConnectedToObserver('isolated', 'world', frames)).toBe(false);
  });

  it('observer frame itself is always connected', () => {
    const frames = [p('world'), p('orphan')];
    expect(isConnectedToObserver('world', 'world', frames)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/FrameList/frameTreeUtils.test.ts
```
Expected: FAIL — `getTreeRoot` and `isConnectedToObserver` not found.

- [ ] **Step 3: Add helpers to frameTreeUtils.ts**

```typescript
/**
 * Returns the id of the tree root for the given frame.
 * Walks parent_id chain until no parent (or dangling reference).
 */
export function getTreeRoot(frameId: string, frames: Poses): string {
  const idSet = new Set(frames.map(f => f.id));
  const frameMap = new Map(frames.map(f => [f.id, f]));

  let currentId = frameId;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(currentId)) break; // cycle guard — treat as root
    visited.add(currentId);
    const frame = frameMap.get(currentId);
    if (!frame) break;
    const parentId = frame.parent_id;
    if (!parentId || !idSet.has(parentId)) break; // no parent or dangling
    currentId = parentId;
  }
  return currentId;
}

/**
 * Returns true if frameId is in the same tree as observerFrameId.
 * Uses getTreeRoot: same root = connected.
 */
export function isConnectedToObserver(
  frameId: string,
  observerFrameId: string,
  frames: Poses,
): boolean {
  return getTreeRoot(frameId, frames) === getTreeRoot(observerFrameId, frames);
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npx vitest run src/components/FrameList/frameTreeUtils.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FrameList/frameTreeUtils.ts src/components/FrameList/frameTreeUtils.test.ts
git commit -m "feat: add getTreeRoot and isConnectedToObserver to frameTreeUtils"
```

---

### Task 3: Default data — add World frame, default view

**Files:**
- Modify: `src/App.tsx` (defaultPoses + default snapshot)

This task only touches the data defaults — no UI yet.

- [ ] **Step 1: Add world frame to defaultPoses**

In `src/App.tsx`, prepend "world" frame to `defaultPoses` and update pinned default to
reference `worldxxx` so it still works:

```typescript
const WORLD_ID = 'worldxxx';

const defaultPoses: Poses = [
  {
    id: WORLD_ID,
    name: 'World',
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
  },
  {
    id: 'frame1xxx',
    name: 'Frame 1',
    position: { x: 0, y: 3, z: 1 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
  },
  {
    id: 'frameAxxx',
    name: 'Frame A',
    position: { x: 2, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: -0.383, w: 0.924 },
  },
  {
    id: 'frameBxxx',
    name: 'Frame B',
    parent_id: 'frameAxxx',
    position: { x: 1.5, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
  },
];
```

- [ ] **Step 2: Update default snapshot to include view**

In the `useUndoRedo` call:

```typescript
const { snapshot, set, undo, redo, canUndo, canRedo } =
  useUndoRedo<AppSnapshot>({
    poses: defaultPoses,
    pinnedExpressions: defaultPinnedExpressions,
    view: { observerFrameId: WORLD_ID },
  });
```

- [ ] **Step 3: Add a helper to resolve the effective ViewState**

Near the top of the `App` function, add a resolved observer ID that falls back to the first frame if `view` is absent or the frame is missing:

```typescript
const effectiveObserverFrameId = (() => {
  const id = snapshot.view?.observerFrameId;
  if (id && poses.some(p => p.id === id)) return id;
  return poses[0]?.id ?? '';
})();
```

- [ ] **Step 4: Verify app still runs** — open dev server, confirm World frame appears in FrameList and scene.

```bash
npm run dev
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add World frame to defaults and view.observerFrameId to AppSnapshot"
```

---

## Chunk 2: UI — observer dropdown and deletion fallback

### Task 4: Observer Frame dropdown + deletion fallback

**Files:**
- Modify: `src/App.tsx` (dropdown + handleRemove update)

- [ ] **Step 1: Add handleSetObserver callback**

```typescript
const handleSetObserver = useCallback((id: string) => {
  set({ ...snapshotRef.current, view: { observerFrameId: id } });
}, [set]);
```

- [ ] **Step 2: Update handleRemove to fall back when observer is deleted**

```typescript
const handleRemove = useCallback((id: string) => {
  const newPoses = poses
    .filter(p => p.id !== id)
    .map(p => p.parent_id === id ? { ...p, parent_id: undefined } : p);

  // If observer frame is deleted, fall back to first remaining frame
  const currentObserverId = snapshotRef.current.view?.observerFrameId;
  const newObserverId =
    currentObserverId === id
      ? (newPoses[0]?.id ?? '')
      : (currentObserverId ?? newPoses[0]?.id ?? '');

  set({
    ...snapshotRef.current,
    poses: newPoses,
    view: { observerFrameId: newObserverId },
  });
}, [poses, set]);
```

- [ ] **Step 3: Add Observer Frame dropdown to Scene Options**

In the Scene Options section of `App.tsx` JSX, after the Up Direction dropdown:

```tsx
<div className="flex items-center gap-2 px-2 py-1.5">
  <p className="text-gray-300 text-xs shrink-0">Observer</p>
  <select
    className="flex-1 text-xs border border-gray-600 rounded bg-gray-700 text-white px-1 py-0.5"
    value={effectiveObserverFrameId}
    onChange={e => handleSetObserver(e.target.value)}
  >
    {poses.map(p => (
      <option key={p.id} value={p.id}>
        {p.name ?? p.id}
      </option>
    ))}
  </select>
</div>
```

- [ ] **Step 4: Pass observerFrameId to PoseVisualizer and FrameList** (prop threads; not yet consumed — that's the next tasks):

PoseVisualizer:
```tsx
<PoseVisualizer
  poses={poses}
  onChange={handleDragChange}
  onChangeCommit={handleDragCommit}
  upDirection={upDirection}
  showWorldAxes={showWorldAxes}
  showParentLines={showParentLines}
  observerFrameId={effectiveObserverFrameId}
/>
```

FrameList:
```tsx
<FrameList
  poses={poses}
  representation={representation}
  reparentMode={reparentMode}
  observerFrameId={effectiveObserverFrameId}
  onAdd={handleAdd}
  onRemove={handleRemove}
  onRename={handleRename}
  onSetParent={handleSetParent}
/>
```

- [ ] **Step 5: Add `observerFrameId` to both components' prop interfaces** (TypeScript: just add the prop, mark as optional for now so nothing breaks):

In `src/components/PoseVisualizer/index.tsx`:
```typescript
interface PoseVisualizerProps {
  // ... existing props ...
  observerFrameId?: string;
}
```

In `src/components/FrameList/index.tsx`:
```typescript
interface FrameListProps {
  // ... existing props ...
  observerFrameId?: string;
}
```

- [ ] **Step 6: Verify app compiles and observer dropdown appears**

```bash
npm run dev
```

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/PoseVisualizer/index.tsx src/components/FrameList/index.tsx
git commit -m "feat: observer frame dropdown in Scene Options with deletion fallback"
```

---

## Chunk 3: PoseVisualizer — observer-relative rendering

### Task 5: Update PoseVisualizer rendering to use observer-relative poses

**Files:**
- Modify: `src/components/PoseVisualizer/index.tsx`

`★ Key insight:` Three.js world space now IS observer space. Frame objects are placed at `observer_T_frame`. When reading back positions after drag, we must first convert from observer-space to global, then to parent-relative.

- [ ] **Step 1: Update the prop interface to require observerFrameId**

Change from optional to required (since App.tsx always passes it now):

```typescript
interface PoseVisualizerProps {
  poses: Poses;
  upDirection: UpDirection;
  showWorldAxes?: boolean;
  showParentLines?: boolean;
  observerFrameId: string;
  onChange?: (newPoses: Poses) => void;
  onChangeCommit?: (newPoses: Poses) => void;
}
```

- [ ] **Step 2: Add an observerFrameIdRef** for use in stable callbacks:

After `posesRef`:
```typescript
const observerFrameIdRef = useRef<string>(observerFrameId);
observerFrameIdRef.current = observerFrameId;
```

- [ ] **Step 3: Update the frame placement loop in the poses effect**

Find the section in the `poses` effect that calls `composePath` to compute `global_T_frame`. Change it to compute `observer_T_frame`:

```typescript
const frameMap = posesToMap(poses);
const global_T_observer = observerFrameId
  ? (() => {
      try { return composePath(observerFrameId, frameMap); }
      catch { return identity(); }
    })()
  : identity();

poses.forEach((pose) => {
  // Skip frames disconnected from the observer tree
  if (observerFrameId && !isConnectedToObserver(pose.id, observerFrameId, poses)) return;

  const global_T_frame = composePath(pose.id, frameMap);
  const observer_T_frame = multiply(invert(global_T_observer), global_T_frame);
  const worldPose = { ...pose, position: observer_T_frame.position, quaternion: observer_T_frame.quaternion };
  // observer frame itself is not interactive (it's pinned at scene origin)
  const isObserver = pose.id === observerFrameId;
  const frame = createFrame(worldPose, upDirection);
  scene.addFrame(frame, isObserver ? undefined : handleTransformChange);
});
```

Note: `identity()` is already exported from `../../utils/transforms`. Also import `isConnectedToObserver` from `../../components/FrameList/frameTreeUtils` — wait, that's a cross-component import. Better to move the helper import or inline. Since `isConnectedToObserver` uses `Poses` from types, it's fine to import from its current location.

Add import at top:
```typescript
import { isConnectedToObserver } from '../FrameList/frameTreeUtils';
import { identity } from '../../utils/transforms';
```

- [ ] **Step 4: Update the live position refresh during drag**

In the `forEach` that updates Three.js objects after drag (`scene.frames.forEach(...)`), update to observer-relative:

```typescript
const newFrameMap = posesToMap(newPoses);
const global_T_obs_new = observerFrameIdRef.current
  ? (() => {
      try { return composePath(observerFrameIdRef.current, newFrameMap); }
      catch { return identity(); }
    })()
  : identity();

scene.frames.forEach((threeFrame, index) => {
  const pose = newPoses[index];
  const global_T_frame = composePath(pose.id, newFrameMap);
  const observer_T_frame = multiply(invert(global_T_obs_new), global_T_frame);
  threeFrame.position.set(
    observer_T_frame.position.x,
    observer_T_frame.position.y,
    observer_T_frame.position.z,
  );
  threeFrame.quaternion.set(
    observer_T_frame.quaternion.x,
    observer_T_frame.quaternion.y,
    observer_T_frame.quaternion.z,
    observer_T_frame.quaternion.w,
  );
});
```

- [ ] **Step 5: Update handleTransformChange to convert observer→global before parent-relative**

In `handleTransformChange`, the Three.js positions are now in observer space. Convert back:

```typescript
const handleTransformChange = useCallback(() => {
  if (!sceneRef.current || !onChange) return;
  const scene = sceneRef.current;
  const currentPoses = posesRef.current;
  const frameMap = posesToMap(currentPoses);
  const draggedIndex = scene.getDraggedFrameIndex();

  // Convert observer-space position back to global
  const global_T_observer = (() => {
    try { return composePath(observerFrameIdRef.current, frameMap); }
    catch { return identity(); }
  })();

  const newPoses = scene.frames.map((frame, index) => {
    const pose = currentPoses[index];

    if (pose.parent_id && index !== draggedIndex) {
      return pose;
    }

    // frame.position is in observer space — convert to global first
    const observerPos = { x: frame.position.x, y: frame.position.y, z: frame.position.z };
    const observerQuat = { x: frame.quaternion.x, y: frame.quaternion.y, z: frame.quaternion.z, w: frame.quaternion.w };
    const observer_T_frame = { id: '', position: observerPos, quaternion: observerQuat };
    const global_T_frame = multiply(global_T_observer, observer_T_frame);

    if (pose.parent_id) {
      const global_T_parent = composePath(pose.parent_id, frameMap);
      const parent_T_frame = multiply(invert(global_T_parent), global_T_frame);
      return { ...pose, position: parent_T_frame.position, quaternion: parent_T_frame.quaternion };
    } else {
      return { ...pose, position: global_T_frame.position, quaternion: global_T_frame.quaternion };
    }
  });

  // ... rest of handleTransformChange unchanged (setPrevPoses, onChange) ...
}, [onChange]);
```

- [ ] **Step 6: Apply same observer conversion in onDragCommit**

`onDragCommit` has the same pattern as `handleTransformChange`. Apply the identical conversion (use `observerFrameIdRef.current`).

- [ ] **Step 7: Add observerFrameId to frames effect deps**

The frames effect deps array currently ends with `[poses, handleTransformChange, onChangeCommit, sceneKey]`. Add `observerFrameId`:

```typescript
}, [poses, handleTransformChange, onChangeCommit, sceneKey, observerFrameId]);
```

- [ ] **Step 8: Verify manually** — change observer frame in dropdown, confirm 3D view shifts correctly. Drag a non-observer frame, confirm position is correctly saved.

- [ ] **Step 9: Commit**

```bash
git add src/components/PoseVisualizer/index.tsx
git commit -m "feat: render all frames relative to observer frame in PoseVisualizer"
```

---

## Chunk 4: FrameList — disconnected warning + label cleanup

### Task 6: Disconnected warning icon + label fixes

**Files:**
- Modify: `src/components/FrameList/index.tsx`

- [ ] **Step 1: Destructure observerFrameId in FrameList**

```typescript
export function FrameList({
  poses,
  representation,
  reparentMode,
  observerFrameId,
  onAdd,
  onRemove,
  onRename,
  onSetParent,
}: FrameListProps) {
```

- [ ] **Step 2: Compute disconnected set**

After `const displayList = buildDisplayList(poses);`:

```typescript
const disconnectedIds = new Set(
  observerFrameId
    ? poses
        .filter(p => !isConnectedToObserver(p.id, observerFrameId, poses))
        .map(p => p.id)
    : []
);
```

Add import: `import { buildDisplayList, getValidParents, getTreeRoot, isConnectedToObserver, PANEL_MAX_INDENT_DEPTH } from './frameTreeUtils';`

- [ ] **Step 3: Add warning icon to disconnected frame row headers**

In the row header JSX, after the `displayName` span:

```tsx
{disconnectedIds.has(pose.id) && (
  <span
    className="text-yellow-400 text-xs shrink-0 cursor-help"
    title={`Not connected to observer frame${observerFrameId ? ` "${poses.find(p => p.id === observerFrameId)?.name ?? observerFrameId}"` : ''} — not rendered in 3D view`}
  >
    ⚠
  </span>
)}
```

Place this between the `displayName` span and the `showBadge` conditional.

- [ ] **Step 4: Fix "none (global)" label in parent picker**

Change:
```tsx
<option value="">none (global)</option>
```
To:
```tsx
<option value="">(tree root)</option>
```

- [ ] **Step 5: Fix "global_T_..." label for root frames**

Currently: `<span className="font-mono">global_T_{toFrameLabel(pose.name ?? pose.id)}</span>`

Change to show the observer frame name as the prefix when the frame is a root and connected to observer:

```tsx
{pose.parent_id ? (
  <span className="font-mono">
    {toFrameLabel(poses.find(p => p.id === pose.parent_id)?.name ?? pose.parent_id)}_T_{toFrameLabel(pose.name ?? pose.id)}
  </span>
) : (
  <span className="font-mono text-gray-400">
    (root)_T_{toFrameLabel(pose.name ?? pose.id)}
  </span>
)}
```

The `renderPoseData` call currently passes `parentName ?? 'global'`. Change `'global'` to `'root'`:

```typescript
{renderPoseData(pose, representation, pose.name ?? pose.id, parentName ?? 'root')}
```

- [ ] **Step 6: Verify manually** — add a second root frame with no relationship to world. Confirm warning icon appears on it and it's not rendered in the 3D view.

- [ ] **Step 7: Commit**

```bash
git add src/components/FrameList/index.tsx
git commit -m "feat: disconnected-frame warning icon in FrameList, fix global label"
```

---

## Final verification

- [ ] Change observer frame to Frame A — world should swing behind A, B should be close in front
- [ ] Add a new root frame with no parent — confirm warning icon, not rendered
- [ ] Delete observer frame — confirm fallback to first frame, no crash
- [ ] Undo/redo across observer frame changes — confirm snapshot round-trips correctly
- [ ] Drag Frame 1 while World is observer — confirm position saves correctly (not offset)
- [ ] Run all tests:

```bash
npx vitest run
```

Expected: all PASS (existing tests unbroken, new tests pass).
