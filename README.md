# frame_viz

A standalone browser tool for authoring and visualizing rigid-body coordinate frame hierarchies in 3D. Useful for robotics, multibody dynamics, and spatial reasoning.

<!-- Screenshot: add docs/screenshot.png to show the UI here -->

**Live demo:** https://aleeper.github.io/frame_viz

Or play around in StackBlitz: https://stackblitz.com/~/github.com/aleeper/frame_viz

---

## Run locally

```bash
npm install
npm run dev
```

---

## Data model

### Pose

A `Pose` is an SE(3) rigid transform with the following fields:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Stable, auto-generated identifier (nanoid, 8 chars). Never changes after creation. |
| `name` | `string` (optional) | Display label, user-editable. |
| `position` | `{x, y, z}` | Translation in meters (or whatever unit you choose). |
| `quaternion` | `{x, y, z, w}` | Orientation as a unit quaternion. |
| `parent_id` | `string` (optional) | References another `Pose`'s `id`. Absent means this pose is a tree root. |

### Frame tree

Frames form a tree via `parent_id`. A child's transform is expressed relative to its parent. The utility `composePath` walks the ancestor chain to compute the root-relative pose of any frame.

There is no implicit global frame — the root of the tree (the frame with no `parent_id`) serves as the reference for root-relative composition.

The default scene contains:
- **World** — root frame (no parent)
- **Frame 1** — child of World
- **Frame A** — child of World, rotated ~45° about Z
- **Frame B** — child of Frame A

### AppSnapshot

`AppSnapshot` is the serialized application state, used for save/load and URL sharing:

| Field | Type | Description |
|---|---|---|
| `poses` | `Pose[]` | All frames in the scene. |
| `pinnedExpressions` | `PinnedExpression[]` (optional) | Transform expressions shown in the side panel (e.g. `frame_1_T_frame_B`). Defaults to `[]`. |
| `view` | `ViewState` (optional) | Which frame is the observer. Defaults are computed from `poses` at runtime. |
| `version` | `number` (optional) | Schema version; currently `1` when set. |

---

## Observer frame

Any frame can be designated as the observer. The 3D viewport renders all other frames relative to the observer — i.e., the observer frame is treated as the camera's reference frame and appears at the origin.

Frames that are not connected to the observer's subtree (disconnected components of the tree) cannot be expressed relative to the observer; these show a warning and are not rendered.

---

## Controls

| Input | Action |
|---|---|
| `Q` | Disable gizmo (no transform control) |
| `W` | Enable translate gizmo |
| `E` | Enable rotate gizmo |
| `S` | Toggle gizmo between local and world space |
| Click + drag gizmo | Move the selected frame |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` or `Ctrl+Y` | Redo |

---

## What this tool is not

- Not a physics simulator.
- No dynamics — mass, inertia, joint degrees of freedom, and constraints are out of scope. This is purely geometric.
- Not a general-purpose 3D scene editor.

---

## Tech stack

React 18, Three.js, TypeScript, Vite, Tailwind CSS.
