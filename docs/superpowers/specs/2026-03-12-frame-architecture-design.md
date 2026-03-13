# Frame Architecture Design

**Date:** 2026-03-12
**Status:** Approved
**Scope:** Four sequential implementation specs — architecture vocabulary, unit tests, frame parenting, pinned expressions.

---

## Overview

This document describes the architecture for evolving frame_viz from a flat pose editor into a scene graph editor with frame hierarchy, explicit transform math, and a pinned expressions panel. It is structured as four specs to be implemented in order, each building on the previous.

| Spec | Topic |
|------|-------|
| A | Architecture vocabulary + data model foundation |
| B | Unit test suite (Vitest) |
| C | Frame parenting feature |
| D | Pinned expressions + right sidebar |

---

## Spec A: Architecture Vocabulary + Data Model Foundation

### Coordinate Frame Vocabulary

Four named frames are used throughout the codebase. Comments, variable names, and function signatures should use these names consistently.

| Name | Meaning | Current code |
|------|---------|-------------|
| `global` | The Newtonian world frame — the root reference all user-defined frames are ultimately expressed in | Three.js world space (implicit) |
| `renderer` | The Three.js scene origin. Currently coincident with `global`. In the future may be offset for floating-point precision near large coordinates. | `scene.position` (always identity today) |
| `control` | The camera orbit center. Panning shifts this; zoom and orbit radius do not. | `OrbitControls.target` |
| `camera` | The viewpoint — position and orientation of the rendered view. | `THREE.PerspectiveCamera` |

**Future note:** Today there is one renderer/control/camera triplet. The architecture should treat these as logically singular but not structurally unique — future support for multiple simultaneous 3D viewports (each with its own control + camera frame) should not require rearchitecting the scene model.

### Notation

Transform notation throughout the codebase: `a_T_b` means "the transform that expresses the origin and orientation of frame B in frame A." Equivalently, it is the matrix that left-multiplies a point in B to yield a point in A.

Function signatures must make frame semantics explicit:

```ts
multiply(a_T_b: Pose, b_T_c: Pose): Pose       // returns a_T_c
invert(a_T_b: Pose): Pose                       // returns b_T_a
identity(): Pose                                // zero translation, unit quaternion
composePath(frameId: string, frameMap: Map<string, Pose>): Pose  // returns global_T_frame
```

This notation is also used in display labels: `world_T_shoulder`, `base_T_elbow`, etc. The UI renders these using frame names, falling back to IDs when name is absent.

### Data Model Changes

The `Pose` type gains two new fields. **The type name `Pose` is not renamed yet** — the right generic supertype name (`SceneObject`, `Entity`, `Node`) will become clear when Points, Bodies, or other non-pose objects are introduced. Premature renaming risks coupling the name to an assumption we may want to discard.

```ts
interface Pose {
  id: string;           // NEW — stable, auto-generated (nanoid 8 chars). Never changes after creation.
  name?: string;        // existing — display only, user-editable
  parent_id?: string;   // NEW — references another Pose's id. Absent = no parent (lives in global space).
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
}
```

**ID generation:** `nanoid(8)` on `handleAdd` and in `defaultPoses`. Short enough to be readable in YAML, collision-resistant for any realistic scene size. Every code path that creates a `Pose` must supply an `id` — the validator requires it.

**Multiple roots are allowed.** Any `Pose` with no `parent_id` lives directly in global space. There is no required root frame. This naturally supports multiple disjoint frame trees that may later be connected.

**YAML representation stays flat:**

```yaml
- id: "a1b2c3d4"
  name: base_link
  position: {x: 0, y: 0, z: 0}
  quaternion: {x: 0, y: 0, z: 0, w: 1}
- id: "e5f6g7h8"
  name: shoulder
  parent_id: "a1b2c3d4"
  position: {x: 0.5, y: 0, z: 0}
  quaternion: {x: 0, y: 0, z: 0, w: 1}
```

`id` is required; `parent_id` and `name` are optional. YAML missing `id` is invalid and rejected by `isValidPose`.

### Transform Math Module

New file: `src/utils/transforms.ts`. No Three.js imports. Fully unit-testable.

```ts
export function identity(): Pose
// Returns zero translation, unit quaternion.

export function multiply(a_T_b: Pose, b_T_c: Pose): Pose
// Returns a_T_c. Quaternion multiplication + position transform: a_pos + a_rot * b_pos.

export function invert(a_T_b: Pose): Pose
// Returns b_T_a. Conjugate quaternion + negated/rotated position.

export function posesToMap(frames: Pose[]): Map<string, Pose>
// Convenience: converts Pose[] to Map<id, Pose> for O(1) lookup.

export function composePath(frameId: string, frameMap: Map<string, Pose>): Pose
// Returns global_T_frame by walking the parent_id chain from the given frame up to the root,
// then multiplying transforms root→leaf: global_T_root × root_T_parent × ... × parent_T_frame.
//
// Contract:
// - A frame with no parent_id returns its own pose unchanged (it already lives in global space).
// - A missing parent_id reference (dangling) throws: `Unknown parent_id "${id}" for frame "${frameId}"`.
// - A cycle throws: `Cycle detected in parent chain at frame "${frameId}"`.
//   Cycle detection uses a visited Set<string>; if frameId appears twice during chain traversal, throw.
```

The existing `src/utils/matrixUtils.ts` (quaternion → rotation matrix) is imported by this module where needed; it is not replaced or merged.

### Three.js Scene Architecture

**The Three.js scene stays flat.** All frame `THREE.Group` objects are direct children of the scene root, regardless of logical parent-child relationships in the data.

When rendering a frame, its world position is computed explicitly:
```ts
const frameMap = posesToMap(frames);
const global_T_frame = composePath(frame.id, frameMap);
group.position.copy(global_T_frame.position);
group.quaternion.copy(global_T_frame.quaternion);
```

**Rationale:** Three.js native parent-child hierarchy (`Object3D.add(child)`) would need to be removed the moment we introduce:
- Decoupled position/orientation parents (steadicam: position from frame A, orientation from frame B)
- Constraints (P1 == P2 across separate chains, e.g. four-bar linkages)

Neither of these fits a tree. Keeping the scene flat and owning the math explicitly keeps the rendering layer decoupled from the data model's evolving complexity.

---

## Spec B: Unit Test Suite

**Framework:** Vitest (zero config with existing Vite setup, Jest-compatible API)

Four test files, pure functions only. No DOM, no Three.js mocking, no React.

### `src/utils/transforms.test.ts`
- `identity()` returns zero translation `{x:0,y:0,z:0}` and unit quaternion `{x:0,y:0,z:0,w:1}`
- `multiply(identity(), p)` equals `p`; `multiply(p, identity())` equals `p`
- `multiply` known chain: pure translation then pure rotation = expected result (verify numerically)
- `invert(a_T_b)` composed with `a_T_b` via `multiply` equals `identity()`
- `composePath` single frame with no `parent_id` returns the frame's own pose unchanged (not `identity()`)
- `composePath` two-frame chain equals `multiply(parent_pose, child_pose)`
- `composePath` three-frame chain: verify result numerically with known inputs
- `composePath` missing `parent_id` reference throws with message containing the missing ID
- `composePath` cycle (A→B→A) throws with message containing the cycle frame ID

### `src/utils/matrixUtils.test.ts`
- Identity quaternion → 3×3 identity rotation matrix (verify each element)
- 90° rotation around Z axis → expected matrix values (numerically)
- Known quaternion → matrix values match hand-computed reference (one-way correctness; no inverse function exists)

### `src/hooks/useUndoRedo.test.ts`
- `set` pushes entry and increments index
- `set` truncates redo history on new entry
- `setSilent` updates in-place without adding entry
- `undo` decrements index, returns previous snapshot
- `redo` increments index
- `canUndo` / `canRedo` correct at boundaries (index=0, index=length-1)
- MAX_HISTORY cap: oldest entry dropped, index stays at last entry

### `src/types/Pose.test.ts`
- Valid pose with all fields passes `isValidPose`
- Valid pose with only required fields (`id`, `position`, `quaternion`) passes
- Missing `id` fails; missing `position` fails; missing `quaternion` fails
- Wrong types (e.g. `position` is a number) fail
- Extra unknown fields pass (validator is permissive)

**Target:** ~40 tests total. All should run in < 1 second.

---

## Spec C: Frame Parenting Feature

### Panel UI

The left panel section is renamed "Frames" (was "Poses"). The `PoseDisplay` component is renamed `FrameList`.

**Collapsed frame row:** chevron + name (or id fallback) + chain badge if depth > 2 (`↳ parent_name`)

**Expanded frame panel:**
- Parent picker: `<select>` dropdown listing all other frames by name (id fallback). Excludes self and own descendants (cycle prevention — use `composePath` traversal to identify descendants). Option "none" = no parent.
- Pose numbers: always shown as `parent_T_frame` (parent-relative). If no parent, shown as `global_T_frame`.
- Existing representation toggle (quaternion / matrix / euler) applies.

**Indentation:** Capped at 2 visual levels. Depth 3+ frames show inline `↳ parent_name` badge instead of further indentation. Depth cap is a named constant `PANEL_MAX_INDENT_DEPTH = 2` for future configurability.

**Re-parent mode toggle** (global, lives in `App.tsx` as local `useState`, threaded down to `FrameList`):
- `"preserve world"` — recalculates `parent_T_frame` so `global_T_frame` is unchanged:
  ```
  new_parent_T_frame = invert(global_T_new_parent) × global_T_frame
  ```
  where `global_T_new_parent = composePath(new_parent_id, frameMap)` and `global_T_frame = composePath(frame.id, frameMap)`.
- `"preserve local"` — keeps the existing `parent_T_frame` pose numbers unchanged; the frame moves to a new world position.

### Three.js Integration

- During scene rebuild, build `frameMap = posesToMap(frames)` once, then call `composePath(frame.id, frameMap)` for each frame to set its world position/orientation on the `THREE.Group`.
- `handleTransformChange` (drag): the dragged frame's world transform is read from `group.position` / `group.quaternion`. Convert to parent-relative using `posesRef.current` (the mid-drag state, not the committed snapshot):
  ```
  parent_T_frame = invert(composePath(frame.parent_id, posesToMap(posesRef.current))) × world_T_frame
  ```
  If the frame has no `parent_id`, the world transform is stored directly as the pose.
- `onDragCommit` commits the parent-relative pose to history via `onChangeCommit`.

### YAML / Validation

- `isValidPose` requires `id`; rejects frames without it. `parent_id` and `name` remain optional.
- `JsonEditor` round-trips `id` and `parent_id` transparently (they are preserved in the JSON text).

### Deleted Frame Edge Case

When a frame is deleted, any frame whose `parent_id` references the deleted frame's `id` has its `parent_id` cleared (set to `undefined`). It becomes a root frame in global space. This is handled in the `handleRemove` callback before pushing to history.

### Right Sidebar Scaffold

Spec C builds the sidebar shell (populated with content in Spec D):
- 32px activity bar on the far right; each icon selects a right panel.
- Clicking the active icon collapses the panel to zero width; clicking an inactive icon opens it.
- Panel width ~200px.
- First icon slot reserved for pinned expressions (Spec D); rendered as a placeholder in Spec C.
- `AppSnapshot` does **not** yet gain sidebar state — that is Spec D.

---

## Spec D: Pinned Expressions + Right Sidebar

### Concept

A **pinned expression** is a derived quantity computed from two frames that the user wants to continuously observe. Initial support is for full transforms only; the data model is designed to extend to rotations, positions, velocities, and other kinematic quantities without a breaking change.

```ts
interface PinnedExpression {
  id: string;
  base_frame_id: string;    // the "a" in a_T_b notation
  target_frame_id: string;  // the "b" in a_T_b notation
  kind: 'transform';        // extensible: 'rotation' | 'position' | future kinematic types
}
```

`AppSnapshot` gains `pinnedExpressions: PinnedExpression[]`. The field defaults to `[]` when absent (backward-compatible with existing history entries and YAML). It is typed as optional in `AppSnapshot` (`pinnedExpressions?: PinnedExpression[]`) and all read sites treat `undefined` as `[]`.

### Deleted Frame Edge Case

If a frame referenced by a `PinnedExpression` (`base_frame_id` or `target_frame_id`) is deleted, the pinned entry is displayed in an error state: label shown in muted color, value replaced with "⚠ frame not found." The entry is not auto-removed — the user must delete it manually. This avoids silent data loss.

### UI

The right sidebar's first icon opens the **Pinned** panel.

Each pinned entry displays:
- Label: `base_name_T_target_name` (using `name` fields, falling back to IDs)
- Computed value: `invert(composePath(base_frame_id, frameMap)) × composePath(target_frame_id, frameMap)`
- Values recompute live on every pose change
- Representation follows the global representation toggle
- × button removes the entry
- Error state (see above) if either frame is missing

"+ Pin expression" button opens two dropdowns: base frame, target frame. Any frame is valid for either role.

### Out of Scope for Spec D
- Drag-and-drop reordering of pinned entries
- Highlighting corresponding frames in the 3D view on hover
- `kind: 'rotation'` and `kind: 'position'` (data model supports them; UI deferred)
- Velocity or higher-order kinematic quantities

---

## Open Questions / Future Work

- **Naming:** `Pose` type will eventually be renamed to a generic supertype once Points, Bodies, or other non-pose scene objects are introduced. Candidate names: `SceneObject`, `Entity`, `Node`.
- **Decoupled parents:** A frame whose position is expressed relative to one frame and orientation relative to another (steadicam use case). Data model is open to this; not in scope for any of the above specs.
- **Constraints:** P1 == P2 across separate chains (parallel mechanisms). Requires constraint solver; out of scope but architecturally compatible with flat scene + explicit math.
- **Drag-and-drop re-parenting:** Deferred; dropdown is the initial UI. The Logic Pro track-nesting UX challenge (last-child vs next-sibling ambiguity) applies here.
- **Multiple viewports:** Multiple simultaneous 3D views with independent control/camera frames. Architecture supports it; not in current scope.
- **Google Doc notation reference:** Company-internal notation doc to be cross-referenced once accessible; expected to be largely consistent with `a_T_b` convention above.
