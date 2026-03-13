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
multiply(a_T_b: Pose, b_T_c: Pose): Pose   // returns a_T_c
invert(a_T_b: Pose): Pose                   // returns b_T_a
identity(): Pose                            // global_T_global (zero translation, unit quaternion)
composePath(frameId: string, frames: Pose[]): Pose  // returns global_T_frame
```

This notation is also used in display labels: `world_T_shoulder`, `base_T_elbow`, etc. The UI renders these as `base_T_target` using frame names (falling back to IDs when name is absent).

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

**ID generation:** `nanoid(8)` on `handleAdd`. Short enough to be readable in YAML, collision-resistant for any realistic scene size.

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

**Backward compatibility:** `id` and `parent_id` are optional in the validator (`isValidPose`). Existing YAML without these fields remains valid; missing IDs are auto-generated on load.

### Transform Math Module

New file: `src/utils/transforms.ts`

Houses all pure transform math. No Three.js imports. Fully unit-testable.

```ts
export function identity(): Pose
export function multiply(a_T_b: Pose, b_T_c: Pose): Pose   // quaternion multiplication + position transform
export function invert(a_T_b: Pose): Pose                   // conjugate quaternion + transformed position
export function composePath(frameId: string, frames: Pose[]): Pose
  // Walks parent_id chain root→leaf, multiplies transforms.
  // Throws descriptive error on missing parent_id or cycle detection.
```

The existing `src/utils/matrixUtils.ts` (quaternion → rotation matrix) is imported by this module.

### Three.js Scene Architecture

**The Three.js scene stays flat.** All frame `THREE.Group` objects are direct children of the scene root, regardless of logical parent-child relationships in the data.

When rendering a frame, its world position is computed explicitly:
```ts
const global_T_frame = composePath(frame.id, frames);
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
- `identity()` returns zero translation, unit quaternion
- `multiply(identity, p)` = `p`; `multiply(p, identity)` = `p`
- `multiply` known chain: translate then rotate = expected result
- `invert(a_T_b)` composed with `a_T_b` = identity
- `composePath` single frame (no parent) = pose unchanged
- `composePath` two-frame chain = `multiply(parent, child)`
- `composePath` three-frame chain
- `composePath` missing `parent_id` throws descriptive error
- `composePath` cycle (A→B→A) throws

### `src/utils/matrixUtils.test.ts`
- Identity quaternion → identity rotation matrix
- 90° rotation around Z → expected matrix values
- Round-trip stability: known quaternion → matrix → back

### `src/hooks/useUndoRedo.test.ts`
- `set` pushes entry and increments index
- `set` truncates redo history on new entry
- `setSilent` updates in-place without adding entry
- `undo` decrements index, returns previous snapshot
- `redo` increments index
- `canUndo` / `canRedo` correct at boundaries (index=0, index=length-1)
- MAX_HISTORY cap: oldest entry dropped, index stable

### `src/types/Pose.test.ts`
- Valid pose (with and without optional fields) passes `isValidPose`
- Missing required fields fail
- Wrong types fail
- Extra fields pass (validator is permissive)

**Target:** ~40 tests total. All should run in < 1 second.

---

## Spec C: Frame Parenting Feature

### Panel UI

The left panel section is renamed "Frames" (was "Poses"). The `PoseDisplay` component is renamed `FrameList`.

**Collapsed frame row:** chevron + name (or id fallback) + chain badge if depth > 2 (`↳ parent_name`)

**Expanded frame panel:**
- Parent picker: `<select>` dropdown listing all other frames by name (id fallback). Excludes self and own descendants (cycle prevention). Option "none" = no parent.
- Pose numbers: always shown as parent-relative (position and orientation relative to `parent_id` frame, or global if no parent)
- Existing representation toggle (quaternion / matrix / euler) applies

**Indentation:** Capped at 2 visual levels. Depth 3+ frames show inline `↳ parent_name` badge instead of further indentation. Depth cap is a named constant for future configurability.

**Re-parent mode toggle** (global, in panel header area):
- `"preserve world"` — recalculates `pose` so `global_T_frame` is unchanged: `new_pose = invert(new_parent_global_T) × old_global_T`
- `"preserve local"` — keeps `pose` numbers unchanged; frame moves in world space

### Three.js Integration

- `Scene.ts` calls `composePath(frame.id, frames)` for each frame during rebuild to set world position
- `handleTransformChange` (drag): reads dragged frame's current world transform from `group.position/quaternion`, converts to parent-relative: `parent_relative = invert(composePath(parent_id, frames)) × world_T_frame`
- `onDragCommit` commits the parent-relative pose to history

### YAML / Validation

- `isValidPose` updated to accept (not require) `id` and `parent_id`
- On load: frames missing `id` get one auto-generated
- `JsonEditor` round-trips `id` and `parent_id` transparently

### Right Sidebar Scaffold

Spec C builds the sidebar shell (used by Spec D for content):
- 32px activity bar on far right; icons select which panel to show
- Clicking the active icon collapses the panel
- Panel width ~200px
- First icon slot reserved for pinned expressions (Spec D)
- `AppSnapshot` does **not** yet gain sidebar state — that is Spec D

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

`AppSnapshot` gains: `pinnedExpressions: PinnedExpression[]` — so the pinned list survives undo/redo.

### UI

The right sidebar activity bar's first icon opens the **Pinned** panel.

Each pinned entry displays:
- Label: `base_T_target` (names, falling back to IDs)
- Computed value: `invert(composePath(base_frame_id)) × composePath(target_frame_id)`
- Values recompute live on every pose change
- Representation follows the global representation toggle
- × button removes the entry

"+ Pin expression" button opens two dropdowns: base frame, target frame. Any frame (including implicit global) is valid for either.

### Out of scope for Spec D
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
