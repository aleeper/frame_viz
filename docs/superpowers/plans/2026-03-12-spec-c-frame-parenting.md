# Spec C: Frame Parenting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `PoseDisplay` to `FrameList` with hierarchical frame display and parent picker. Update the Three.js scene to compute world positions via `composePath`. Add a right sidebar scaffold with a 32px activity bar (populated by Spec D).

**Architecture:** Three independent subsystems: (1) `FrameList` component — hierarchy tree UI, parent picker, re-parent toggle; (2) `PoseVisualizer` — world positions via `composePath`, drag converts world→parent-relative; (3) Right sidebar — shell structure only, no content yet.

**Tech Stack:** React, TypeScript, Tailwind CSS, existing `transforms.ts` module.

**Prerequisite:** Spec A must be complete (`id`/`parent_id` on Pose, `transforms.ts` exists).

**Spec reference:** `docs/superpowers/specs/2026-03-12-frame-architecture-design.md` — Spec C section

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/FrameList/index.tsx` | Hierarchical frame list, replaces PoseDisplay as the left panel component |
| Create | `src/components/FrameList/frameTreeUtils.ts` | Pure utilities: depth computation, tree traversal, valid-parent filtering |
| Modify | `src/App.tsx` | Import FrameList; add `reparentMode` state; update `handleRemove` to clear orphaned `parent_id`s |
| Modify | `src/components/PoseVisualizer/index.tsx` | Scene rebuild uses `composePath`; drag uses world→parent-relative conversion |
| Delete | `src/components/PoseDisplay.tsx` | Re-export shim no longer needed after FrameList replaces it |

The existing files under `src/components/PoseDisplay/` (`MatrixDisplay`, `EulerAngleDisplay`, `PositionQuaternionDisplay`, `PosePanelHeader`) are **kept unchanged** — `FrameList` imports them for pose data display.

---

## Chunk 1: FrameList tree utilities

### Task 1: Create frameTreeUtils.ts

**Files:**
- Create: `src/components/FrameList/frameTreeUtils.ts`

- [ ] **Step 1: Write the utility file**

  Create `src/components/FrameList/frameTreeUtils.ts`:

  ```ts
  import { Pose, Poses } from '../../types/Pose';

  export const PANEL_MAX_INDENT_DEPTH = 2;

  /** One row in the flat display list produced by buildDisplayList. */
  export interface FrameListEntry {
    pose: Pose;
    depth: number;
  }

  /**
   * Converts a flat Poses array into a depth-first display order with depth info.
   * Frames with no parent_id are roots (depth 0). Children are ordered by their
   * position in the original array within each parent group.
   *
   * Frames whose parent_id points to a frame not in the list are treated as roots
   * (dangling references, e.g. after a parent was deleted).
   */
  export function buildDisplayList(frames: Poses): FrameListEntry[] {
    const idSet = new Set(frames.map(f => f.id));
    // Build parent → children[] map. Dangling parent_id treated as undefined.
    const childMap = new Map<string | undefined, Pose[]>();

    for (const pose of frames) {
      const parentKey = pose.parent_id && idSet.has(pose.parent_id)
        ? pose.parent_id
        : undefined;
      if (!childMap.has(parentKey)) childMap.set(parentKey, []);
      childMap.get(parentKey)!.push(pose);
    }

    const result: FrameListEntry[] = [];

    function visit(parentId: string | undefined, depth: number) {
      const children = childMap.get(parentId) ?? [];
      for (const child of children) {
        result.push({ pose: child, depth });
        visit(child.id, depth + 1);
      }
    }

    visit(undefined, 0);
    return result;
  }

  /**
   * Returns the frames that are valid parent candidates for the given frameId.
   * Excludes:
   *   - The frame itself (self-parent)
   *   - Any descendant of the frame (would create a cycle)
   */
  export function getValidParents(frameId: string, frames: Poses): Poses {
    // Build a set of all descendant IDs of frameId using DFS.
    const childMap = new Map<string, Pose[]>();
    for (const pose of frames) {
      if (!pose.parent_id) continue;
      if (!childMap.has(pose.parent_id)) childMap.set(pose.parent_id, []);
      childMap.get(pose.parent_id)!.push(pose);
    }

    const descendants = new Set<string>();
    function collectDescendants(id: string) {
      for (const child of childMap.get(id) ?? []) {
        descendants.add(child.id);
        collectDescendants(child.id);
      }
    }
    collectDescendants(frameId);

    return frames.filter(f => f.id !== frameId && !descendants.has(f.id));
  }
  ```

- [ ] **Step 2: Check TypeScript**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/FrameList/frameTreeUtils.ts
  git commit -m "feat(spec-c): add FrameList tree utilities (buildDisplayList, getValidParents)"
  ```

---

## Chunk 2: FrameList component

### Task 2: Create FrameList/index.tsx

**Files:**
- Create: `src/components/FrameList/index.tsx`

The FrameList component replaces `PoseDisplay` as the left-panel frame list. Key behaviors:
- Hierarchical display (DFS order via `buildDisplayList`)
- Visual indentation capped at `PANEL_MAX_INDENT_DEPTH` (2 levels); deeper frames show `↳ parent_name` badge
- Each row: chevron + name (or `id` fallback) + badge + remove button
- Expanded frame panel shows: parent picker `<select>`, pose numbers (always parent-relative), representation toggle
- Representation toggle is per the `representation` prop (global toggle in App.tsx)
- `+ Add Frame` button at the bottom

- [ ] **Step 1: Write the component**

  Create `src/components/FrameList/index.tsx`:

  ```tsx
  import { useState } from 'react';
  import type { ReactNode } from 'react';
  import { Pose, Poses } from '../../types/Pose';
  import { Representation } from '../../types/Representation';
  import { MatrixDisplay } from '../PoseDisplay/MatrixDisplay';
  import { PositionQuaternionDisplay } from '../PoseDisplay/PositionQuaternionDisplay';
  import { EulerAngleDisplay } from '../PoseDisplay/EulerAngleDisplay';
  import { poseToTransformationMatrix } from '../../utils/matrixUtils';
  import { buildDisplayList, getValidParents, PANEL_MAX_INDENT_DEPTH } from './frameTreeUtils';

  export type ReparentMode = 'preserve world' | 'preserve local';

  interface FrameListProps {
    poses: Poses;
    representation: Representation;
    reparentMode: ReparentMode;
    onAdd?: () => void;
    onRemove?: (id: string) => void;
    onRename?: (id: string, name: string | undefined) => void;
    onSetParent?: (id: string, parentId: string | undefined) => void;
  }

  export function FrameList({
    poses,
    representation,
    reparentMode,
    onAdd,
    onRemove,
    onRename,
    onSetParent,
  }: FrameListProps) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const displayList = buildDisplayList(poses);

    const toggleExpand = (id: string) => {
      setExpandedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    return (
      <div className="text-sm text-gray-900 space-y-0.5">
        {displayList.map(({ pose, depth }) => {
          const isExpanded = expandedIds.has(pose.id);
          const displayName = pose.name ?? pose.id;
          const visualDepth = Math.min(depth, PANEL_MAX_INDENT_DEPTH);
          const showBadge = depth > PANEL_MAX_INDENT_DEPTH;
          const parentPose = poses.find(p => p.id === pose.parent_id);
          const parentName = parentPose?.name ?? parentPose?.id;

          return (
            <div
              key={pose.id}
              style={{ marginLeft: `${visualDepth * 14}px` }}
            >
              {/* Row header */}
              <div
                className="flex items-center gap-1 px-2 py-1 bg-white rounded cursor-pointer hover:bg-gray-50 border border-gray-200"
                onClick={() => toggleExpand(pose.id)}
              >
                <span className="text-gray-400 text-xs w-3">{isExpanded ? '▼' : '▶'}</span>
                <span className="flex-1 font-medium text-gray-800 truncate">{displayName}</span>
                {showBadge && parentName && (
                  <span className="text-xs bg-gray-200 text-blue-600 px-1.5 py-0.5 rounded shrink-0">
                    ↳ {parentName}
                  </span>
                )}
                {onRemove && (
                  <button
                    className="text-gray-400 hover:text-red-500 text-xs px-1 shrink-0"
                    onClick={e => { e.stopPropagation(); onRemove(pose.id); }}
                    aria-label={`Remove ${displayName}`}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div className="mt-0.5 ml-3 bg-gray-50 border border-gray-200 rounded p-2 space-y-2">
                  {/* Name editor */}
                  {onRename && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 w-10 shrink-0">Name</span>
                      <input
                        className="flex-1 text-xs border border-gray-300 rounded px-1 py-0.5"
                        value={pose.name ?? ''}
                        placeholder={pose.id}
                        onChange={e => onRename(pose.id, e.target.value || undefined)}
                      />
                    </div>
                  )}

                  {/* Parent picker */}
                  {onSetParent && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 w-10 shrink-0">Parent</span>
                      <select
                        className="flex-1 text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                        value={pose.parent_id ?? ''}
                        onChange={e => onSetParent(pose.id, e.target.value || undefined)}
                      >
                        <option value="">none (global)</option>
                        {getValidParents(pose.id, poses).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name ?? p.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Re-parent mode info (shown when parent exists or picker is visible) */}
                  {onSetParent && (
                    <div className="text-xs text-gray-400">
                      Re-parent mode: <span className="text-blue-500">{reparentMode}</span>
                    </div>
                  )}

                  {/* Pose display (always shows parent-relative values) */}
                  <div className="text-xs text-gray-600 mb-1">
                    {pose.parent_id ? (
                      <span className="font-mono">
                        {(poses.find(p => p.id === pose.parent_id)?.name ?? pose.parent_id)}_T_{pose.name ?? pose.id}
                      </span>
                    ) : (
                      <span className="font-mono">global_T_{pose.name ?? pose.id}</span>
                    )}
                  </div>
                  {renderPoseData(pose, representation)}
                </div>
              )}
            </div>
          );
        })}

        {onAdd && (
          <button
            className="w-full border border-dashed border-gray-500 rounded px-2 py-1.5 text-gray-400 hover:text-white hover:border-gray-300 transition-colors text-xs"
            onClick={onAdd}
          >
            + Add Frame
          </button>
        )}
      </div>
    );
  }

  function renderPoseData(pose: Pose, representation: Representation): ReactNode {
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
  git add src/components/FrameList/index.tsx
  git commit -m "feat(spec-c): add FrameList component with hierarchy display and parent picker"
  ```

---

## Chunk 3: Wire FrameList into App.tsx

### Task 3: Update App.tsx

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/PoseDisplay.tsx`

Changes:
1. Import `FrameList` and `ReparentMode` instead of `PoseDisplay`
2. Add `reparentMode` state
3. Add `handleSetParent` callback with preserve-world / preserve-local logic
4. Update `handleRemove` to clear `parent_id` on orphaned children
5. Update `handleRename` to be id-based (rather than index-based) for FrameList compatibility
6. Update JSX to use `<FrameList />`
7. Remove the `Representation` toggle from the left panel header (it's still in the same spot)

- [ ] **Step 1: Add FrameList import and remove PoseDisplay import**

  In the imports section of `App.tsx`:

  Remove:
  ```ts
  import { PoseDisplay } from './components/PoseDisplay';
  ```

  Add:
  ```ts
  import { FrameList, ReparentMode } from './components/FrameList';
  import { composePath, posesToMap, multiply, invert } from './utils/transforms';
  ```

- [ ] **Step 2: Add reparentMode state**

  In the App function body, add:

  ```ts
  const [reparentMode, setReparentMode] = useState<ReparentMode>('preserve world');
  ```

- [ ] **Step 3: Update handleRemove to clear orphaned parent_ids**

  Replace the existing `handleRemove`:

  ```ts
  const handleRemove = useCallback((id: string) => {
    set({
      poses: poses
        .filter(p => p.id !== id)
        .map(p => p.parent_id === id ? { ...p, parent_id: undefined } : p),
    });
  }, [poses, set]);
  ```

- [ ] **Step 4: Update handleRename to be id-based**

  Replace the existing `handleRename`:

  ```ts
  const handleRename = useCallback((id: string, name: string | undefined) =>
    set({
      poses: poses.map(pose => {
        if (pose.id !== id) return pose;
        const { name: _removed, ...rest } = pose;
        return name !== undefined ? { ...rest, name } : rest;
      }),
    }), [poses, set]);
  ```

- [ ] **Step 5: Add handleSetParent callback**

  Add after handleRename:

  ```ts
  const handleSetParent = useCallback((id: string, newParentId: string | undefined) => {
    set({
      poses: poses.map(pose => {
        if (pose.id !== id) return pose;

        if (reparentMode === 'preserve world') {
          // Recalculate pose so global_T_frame stays the same regardless of new parent.
          const frameMap = posesToMap(poses);
          const global_T_frame = composePath(id, frameMap);

          if (newParentId !== undefined) {
            // Re-parenting to another frame: new_parent_T_frame = invert(global_T_new_parent) × global_T_frame
            const global_T_new_parent = composePath(newParentId, frameMap);
            const new_parent_T_frame = multiply(invert(global_T_new_parent), global_T_frame);
            return {
              ...pose,
              parent_id: newParentId,
              position: new_parent_T_frame.position,
              quaternion: new_parent_T_frame.quaternion,
            };
          } else {
            // Clearing parent (re-parenting to global): new pose IS the world pose.
            const { parent_id: _removed, ...rest } = pose;
            return {
              ...rest,
              position: global_T_frame.position,
              quaternion: global_T_frame.quaternion,
            };
          }
        }

        // preserve local: keep existing position/quaternion numbers unchanged.
        return newParentId !== undefined
          ? { ...pose, parent_id: newParentId }
          : (() => { const { parent_id: _removed, ...rest } = pose; return rest; })();
      }),
    });
  }, [poses, set, reparentMode]);
  ```

- [ ] **Step 6: Replace PoseDisplay JSX with FrameList**

  In the JSX, find the block rendering `<PoseDisplay ...>` and replace with:

  ```tsx
  <FrameList
    poses={poses}
    representation={representation}
    reparentMode={reparentMode}
    onAdd={handleAdd}
    onRemove={handleRemove}
    onRename={handleRename}
    onSetParent={handleSetParent}
  />
  ```

  Also add a small re-parent mode toggle above the Frames list (inside the left column, below the representation toggle):

  ```tsx
  {viewMode === 'panels' && (
    <div className="flex items-center space-x-2">
      <p className="w-32 text-right text-xs">Re-parent: </p>
      <select
        className="text-xs border border-gray-600 rounded bg-gray-700 text-white px-1 py-0.5"
        value={reparentMode}
        onChange={e => setReparentMode(e.target.value as ReparentMode)}
      >
        <option value="preserve world">preserve world</option>
        <option value="preserve local">preserve local</option>
      </select>
    </div>
  )}
  ```

- [ ] **Step 7: Delete the PoseDisplay re-export shim**

  ```bash
  git rm src/components/PoseDisplay.tsx
  ```

- [ ] **Step 8: Check TypeScript**

  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: No errors.

- [ ] **Step 9: Smoke test**

  ```bash
  npm run dev
  ```

  Verify:
  - Frames list shows with chevron expand/collapse
  - Expanded panel shows parent picker dropdown
  - Adding a frame works
  - Removing a frame works (and doesn't leave orphaned parent_ids in other frames)
  - Renaming works via the name input in the expanded panel
  - Representation toggle still affects pose display

- [ ] **Step 10: Commit**

  ```bash
  git add src/App.tsx src/components/FrameList/index.tsx
  git commit -m "feat(spec-c): wire FrameList into App with handleSetParent and reparentMode"
  ```

---

## Chunk 4: Update PoseVisualizer for composePath

### Task 4: Update PoseVisualizer to use composePath for world positions

**Files:**
- Modify: `src/components/PoseVisualizer/index.tsx`

Two changes:
1. **Scene rebuild**: compute `global_T_frame` via `composePath` for each frame and pass world pose to `createFrame`
2. **handleTransformChange**: convert Three.js world position back to parent-relative before emitting

- [ ] **Step 1: Add transforms imports**

  At the top of `src/components/PoseVisualizer/index.tsx`, add:

  ```ts
  import { composePath, posesToMap, multiply, invert } from '../../utils/transforms';
  ```

- [ ] **Step 2: Update the scene rebuild effect**

  Find the `useEffect` that calls `scene.clearFrames()` and `poses.forEach(...)`. Replace the `poses.forEach` loop with:

  ```ts
  const frameMap = posesToMap(poses);
  poses.forEach((pose) => {
    // Compute world pose for Three.js (scene is flat — all groups at root).
    const global_T_frame = composePath(pose.id, frameMap);
    const worldPose = { ...pose, position: global_T_frame.position, quaternion: global_T_frame.quaternion };
    const frame = createFrame(worldPose, upDirection);
    scene.addFrame(frame, handleTransformChange);
  });
  ```

- [ ] **Step 3: Update handleTransformChange to convert world→parent-relative**

  Replace the `handleTransformChange` useCallback with:

  ```ts
  const handleTransformChange = useCallback(() => {
    if (!sceneRef.current || !onChange) return;

    const scene = sceneRef.current;
    const currentPoses = posesRef.current;
    const frameMap = posesToMap(currentPoses);

    const newPoses = scene.frames.map((frame, index) => {
      const pose = currentPoses[index];
      const worldPos = { x: frame.position.x, y: frame.position.y, z: frame.position.z };
      const worldQuat = { x: frame.quaternion.x, y: frame.quaternion.y, z: frame.quaternion.z, w: frame.quaternion.w };

      if (pose.parent_id) {
        // Convert world transform → parent-relative.
        const global_T_parent = composePath(pose.parent_id, frameMap);
        const world_T_frame = { ...pose, position: worldPos, quaternion: worldQuat };
        const parent_T_frame = multiply(invert(global_T_parent), world_T_frame);
        return { ...pose, position: parent_T_frame.position, quaternion: parent_T_frame.quaternion };
      } else {
        return { ...pose, position: worldPos, quaternion: worldQuat };
      }
    });

    if (JSON.stringify(newPoses) !== JSON.stringify(currentPoses)) {
      setPrevPoses(newPoses);
      onChange(newPoses);
    }
  }, [onChange]);
  ```

  Note: `setPrevPoses(newPoses)` is called here to prevent the scene rebuild effect from triggering again immediately after an onChange event — the Three.js state already reflects `newPoses`.

- [ ] **Step 4: Update onDragCommit similarly**

  The `onDragCommit` handler inside the scene rebuild effect uses the same world→parent-relative logic. Replace the inner `newPoses` computation:

  ```ts
  scene.onDragCommit = () => {
    if (!onChangeCommit) return;
    const currentPoses = posesRef.current;
    const frameMap = posesToMap(currentPoses);

    const newPoses = scene.frames.map((frame, index) => {
      const pose = currentPoses[index];
      const worldPos = { x: frame.position.x, y: frame.position.y, z: frame.position.z };
      const worldQuat = { x: frame.quaternion.x, y: frame.quaternion.y, z: frame.quaternion.z, w: frame.quaternion.w };

      if (pose.parent_id) {
        const global_T_parent = composePath(pose.parent_id, frameMap);
        const world_T_frame = { ...pose, position: worldPos, quaternion: worldQuat };
        const parent_T_frame = multiply(invert(global_T_parent), world_T_frame);
        return { ...pose, position: parent_T_frame.position, quaternion: parent_T_frame.quaternion };
      } else {
        return { ...pose, position: worldPos, quaternion: worldQuat };
      }
    });

    onChangeCommit(newPoses);
  };
  ```

- [ ] **Step 5: Check TypeScript**

  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: No errors.

- [ ] **Step 6: Smoke test with parented frames**

  ```bash
  npm run dev
  ```

  1. Add two frames. Open Frame 2's panel and set Parent to Frame 1.
  2. Drag Frame 1 — verify Frame 2 follows along in world space (because Frame 2's parent-relative pose is preserved, its world position tracks Frame 1).
  3. Drag Frame 2 directly — verify it moves independently relative to Frame 1's local frame.
  4. Undo/redo works correctly through drag operations.
  5. YAML view shows parent-relative position/quaternion for Frame 2 (smaller numbers reflecting local offset from Frame 1).

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/PoseVisualizer/index.tsx
  git commit -m "feat(spec-c): use composePath for world positions in PoseVisualizer"
  ```

---

## Chunk 5: Right sidebar scaffold

### Task 5: Add right sidebar scaffold to App.tsx

**Files:**
- Modify: `src/App.tsx`

The right sidebar is a 32px activity bar (far right) + optional 200px panel. In Spec C, the panel content is a placeholder. Spec D will populate it with the pinned expressions panel.

- [ ] **Step 1: Add right sidebar state to App.tsx**

  In the App function body, add:

  ```ts
  const [rightPanel, setRightPanel] = useState<'pinned' | null>(null);
  ```

- [ ] **Step 2: Update the main layout JSX**

  The current layout is:
  ```tsx
  <main className="container mx-auto p-4 flex gap-4 h-[calc(100vh-5rem)]">
    {/* Left column */}
    ...
    {/* Middle Column */}
    ...
  </main>
  ```

  Replace with:
  ```tsx
  <main className="container mx-auto p-4 flex gap-4 h-[calc(100vh-5rem)]">
    {/* Left column */}
    <div className="flex flex-col w-1/4 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* ... existing left column content unchanged ... */}
    </div>

    {/* 3D view — flex-1 so it fills remaining space */}
    <div className="flex-1 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <PoseVisualizer
        poses={poses}
        onChange={handleDragChange}
        onChangeCommit={handleDragCommit}
        upDirection={upDirection}
        showWorldAxes={showWorldAxes}
      />
    </div>

    {/* Right panel (Spec D content goes here) */}
    {rightPanel !== null && (
      <div className="w-48 bg-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
          <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">
            {rightPanel === 'pinned' ? 'Pinned' : rightPanel}
          </span>
          <button
            className="text-gray-500 hover:text-white text-xs"
            onClick={() => setRightPanel(null)}
          >
            ✕
          </button>
        </div>
        <div className="flex-1 p-2 text-xs text-gray-500 italic">
          Coming in Spec D…
        </div>
      </div>
    )}

    {/* Activity bar */}
    <div className="w-8 bg-gray-900 rounded-lg shadow-lg flex flex-col items-center py-2 gap-1 shrink-0">
      <button
        title="Pinned expressions"
        className={`w-6 h-6 flex items-center justify-center rounded text-sm transition-colors
          ${rightPanel === 'pinned'
            ? 'bg-gray-700 text-blue-400'
            : 'text-gray-500 hover:text-gray-200'}`}
        onClick={() => setRightPanel(p => p === 'pinned' ? null : 'pinned')}
      >
        ⇄
      </button>
    </div>
  </main>
  ```

  Important: change the Middle Column from `w-3/4` to `flex-1` so the 3D view fills the available space after the activity bar is accounted for.

- [ ] **Step 3: Check TypeScript**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: No errors.

- [ ] **Step 4: Smoke test**

  ```bash
  npm run dev
  ```

  - Verify activity bar appears on the right edge as a narrow icon column
  - Click ⇄ icon — right panel appears with "Coming in Spec D…" placeholder
  - Click ⇄ again — panel collapses, 3D view reclaims the space
  - The 3D view should not have a fixed width anymore — it flexes to fill available space

- [ ] **Step 5: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat(spec-c): add right sidebar scaffold with activity bar"
  ```

---

## Summary

After completing Spec C:
- `FrameList` replaces `PoseDisplay` with hierarchical display, parent picker, and chain badges
- Frames can be parented via the dropdown; re-parent mode controls preserve-world vs preserve-local behavior
- Three.js scene computes world positions via `composePath` — all scene groups are still direct children of the scene root (flat scene)
- Dragging a child frame correctly stores parent-relative pose in history
- Dragging a parent frame carries its children along in world space
- Right sidebar scaffold is present; populated by Spec D

The next step is Spec D (pinned expressions), which populates the right sidebar with live transform viewers.
