# Pose Panel Management

**Date:** 2026-03-11
**Status:** Approved

## Goal

Make it easy to add and remove poses directly from the representation panel UI, and allow inline renaming of pose labels. Currently poses can only be added or removed by editing the JSON editor.

## Scope

- Add ✕ (remove) button to each representation panel
- Add "+ Add Pose" button at the bottom of the panel list
- Inline editable name on each panel header
- Immediate delete, no confirmation dialog
- No undo stack (deferred to a future feature)

## Data Model

`Pose.name` is already `string | undefined` (optional per schema). No changes to the type.

A new pose added via the UI has no `name` field set (`undefined`), keeping the JSON minimal and avoiding `name: undefined` as an explicit key in the serialized output. The display falls back to `"Pose ${index + 1}"` when name is absent.

The identity quaternion `{ x: 0, y: 0, z: 0, w: 1 }` is used for new poses — this is the correct no-rotation quaternion (not `w: 0`).

## Component Changes

### `PoseDisplay` — new optional props

```typescript
interface PoseDisplayProps {
  poses: Poses;
  representation: Representation;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onRename?: (index: number, name: string | undefined) => void;
}
```

All three callbacks are optional. Existing call sites without them remain valid.

### Per-panel layout

`PoseDisplay`'s map loop wraps each sub-component in a container `div` that adds a header row above the existing display content. The existing `label` prop is no longer passed down to child components (`MatrixDisplay`, `PositionQuaternionDisplay`, `EulerAngleDisplay`) — the header row in `PoseDisplay` takes over the label responsibility.

Each container uses `key={index}`.

**Header row (inside the wrapper div):**
- Left: controlled `<input>` for the pose name
  - `value={pose.name ?? ""}` bound to local edit state (see below)
  - `placeholder={\`Pose ${index + 1}\`}` shown when name is absent
  - On blur or Enter: trim value → if non-empty, call `onRename(index, trimmed)`; if empty or whitespace-only, call `onRename(index, undefined)` (whitespace-only is treated as empty, which is intentional)
- Right: ✕ button — calls `onRemove(index)` immediately. Hidden if `onRemove` not provided.

**Controlled input & sync with external edits:**

The rename input uses a local `editValue` state per panel to avoid calling `onRename` on every keystroke. Since the JSON editor can change `pose.name` externally, the input must re-initialize when the source value changes. This is handled by a `useEffect` that resets `editValue` when `pose.name` changes:

```typescript
const [editValue, setEditValue] = useState(pose.name ?? "");
useEffect(() => { setEditValue(pose.name ?? ""); }, [pose.name]);
```

This logic belongs in a small `PosePanelHeader` component (or inline in the map with a dedicated sub-component) so that each panel has its own independent state and effect.

### Removing the last pose

`handleRemove` on the last remaining pose produces an empty array. The visualizer will show an empty scene and the panel list will show only the "+ Add Pose" button. This is intentional — the user can re-add a pose immediately.

### Add button

Rendered below all panels as a dashed full-width button styled with Tailwind:
```
className="w-full border border-dashed border-gray-600 rounded-lg p-2 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
```
Hidden (not rendered) if `onAdd` is not provided.

### `App.tsx` — callback implementations

```typescript
const handleAdd = () =>
  setPoses(prev => [...prev, {
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    // no name field — keeps JSON minimal, display falls back to "Pose N"
  }]);

const handleRemove = (index: number) =>
  setPoses(prev => prev.filter((_, i) => i !== index));

// Destructuring removes the name key entirely when clearing, so the serialized
// JSON never contains `name: undefined` as an explicit property.
const handleRename = (index: number, name: string | undefined) =>
  setPoses(prev => prev.map((pose, i) => {
    if (i !== index) return pose;
    const { name: _removed, ...rest } = pose;
    return name !== undefined ? { ...rest, name } : rest;
  }));
```

Pass to `PoseDisplay`:
```tsx
<PoseDisplay
  poses={poses}
  representation={representation}
  onAdd={handleAdd}
  onRemove={handleRemove}
  onRename={handleRename}
/>
```

## Layout

Option A: ✕ on each panel header, "+ Add Pose" dashed button below all panels.

```
┌─────────────────────────────┐
│ [Pose1____________]      ✕  │  ← controlled input + remove button
│ [ matrix display data ]     │
└─────────────────────────────┘
┌─────────────────────────────┐
│ [world_____________]     ✕  │
│ [ matrix display data ]     │
└─────────────────────────────┘
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
         + Add Pose
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

## Out of Scope

- Undo/redo (future feature; `AppSnapshot` interface identified as the right shape when added)
- Reordering poses (drag-to-reorder)
- Bulk delete
