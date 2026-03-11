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

A new pose added via the UI has no `name` field set (`undefined`), keeping the JSON minimal. The display falls back to `"Pose ${index + 1}"` when name is absent.

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

**Per-panel header row:**
- Left: inline `<input>` showing `pose.name` (or empty with placeholder `"Pose ${index+1}"`)
  - On blur or Enter: trim value → if non-empty call `onRename(index, trimmed)`, if empty call `onRename(index, undefined)`
- Right: ✕ button — calls `onRemove(index)` immediately. Hidden if `onRemove` not provided.

**Add button:**
- Rendered below all panels as a dashed full-width `"+ Add Pose"` button
- Hidden if `onAdd` not provided

### `App.tsx` — callback implementations

```typescript
const handleAdd = () =>
  setPoses(prev => [...prev, {
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
  }]);

const handleRemove = (index: number) =>
  setPoses(prev => prev.filter((_, i) => i !== index));

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

Option A was selected: ✕ on each panel, "+ Add Pose" dashed button below all panels.

```
┌─────────────────────────────┐
│ Pose1                    ✕  │  ← inline editable name
│ [ matrix display data ]     │
└─────────────────────────────┘
┌─────────────────────────────┐
│ world                    ✕  │
│ [ matrix display data ]     │
└─────────────────────────────┘
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
         + Add Pose
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

## Out of Scope

- Undo/redo (future feature; `AppSnapshot` interface identified as the right shape)
- Reordering poses (drag-to-reorder)
- Bulk delete
