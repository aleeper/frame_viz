# Pose Panel Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline add/remove/rename controls to the PoseDisplay panel list so users can manage poses without touching the JSON editor.

**Architecture:** Three callbacks (`onAdd`, `onRemove`, `onRename`) are added as optional props to `PoseDisplay`. A new `PosePanelHeader` sub-component owns the controlled name input and its local edit state. `App.tsx` implements all three handlers against the existing `poses` state.

**Tech Stack:** React 18, TypeScript, Tailwind CSS. No new dependencies.

---

## Chunk 1: `PosePanelHeader` component + `PoseDisplay` wiring

### File structure

- **Create:** `src/components/PoseDisplay/PosePanelHeader.tsx` — controlled name input + ✕ button for one panel
- **Modify:** `src/components/PoseDisplay/index.tsx` — add optional callbacks, wrap each panel with header, add "+ Add Pose" button
- **Modify:** `src/App.tsx` — implement and wire `handleAdd`, `handleRemove`, `handleRename`

---

### Task 1: Create `PosePanelHeader`

**Files:**
- Create: `src/components/PoseDisplay/PosePanelHeader.tsx`

This component owns the local `editValue` state for the name input and syncs it back when `poseName` changes externally (e.g. via the JSON editor).

- [ ] **Step 1: Create `PosePanelHeader.tsx`**

```tsx
import { useEffect, useState } from 'react';

interface PosePanelHeaderProps {
  poseName: string | undefined;
  fallbackLabel: string;          // e.g. "Pose 1"
  onRename?: (name: string | undefined) => void;
  onRemove?: () => void;
}

export function PosePanelHeader({
  poseName,
  fallbackLabel,
  onRename,
  onRemove,
}: PosePanelHeaderProps) {
  const [editValue, setEditValue] = useState(poseName ?? '');

  // Keep input in sync when poseName changes externally (JSON editor edits).
  useEffect(() => {
    setEditValue(poseName ?? '');
  }, [poseName]);

  const commit = () => {
    const trimmed = editValue.trim();
    onRename?.(trimmed !== '' ? trimmed : undefined);
  };

  return (
    <div className="flex items-center justify-between px-2 pt-1 pb-0">
      <input
        className="bg-transparent text-white text-sm font-semibold flex-1 min-w-0 outline-none border-b border-transparent focus:border-gray-500 transition-colors"
        value={editValue}
        placeholder={fallbackLabel}
        onChange={e => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
      />
      {onRemove && (
        <button
          className="ml-2 text-gray-500 hover:text-red-400 transition-colors text-xs leading-none"
          onClick={onRemove}
          aria-label="Remove pose"
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify file is saved and TypeScript is happy**

```bash
cd /home/adam/code/frame_viz && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors mentioning `PosePanelHeader`.

---

### Task 2: Update `PoseDisplay` to use `PosePanelHeader` and add callbacks

**Files:**
- Modify: `src/components/PoseDisplay/index.tsx`

- [ ] **Step 1: Update `PoseDisplay`**

Replace the full contents of `src/components/PoseDisplay/index.tsx`:

```tsx
import { Representation } from '../../types/Representation';
import { Pose, Poses } from '../../types/Pose';
import { MatrixDisplay } from './MatrixDisplay';
import { poseToTransformationMatrix } from '../../utils/matrixUtils';
import { PositionQuaternionDisplay } from './PositionQuaternionDisplay';
import { EulerAngleDisplay } from './EulerAngleDisplay';
import { PosePanelHeader } from './PosePanelHeader';

interface PoseDisplayProps {
  poses: Poses;
  representation: Representation;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onRename?: (index: number, name: string | undefined) => void;
}

export function PoseDisplay({ poses, representation, onAdd, onRemove, onRename }: PoseDisplayProps) {
  return (
    <div className="text-sm text-gray-900 text-center space-y-1">
      {poses.map((pose, index) => {
        const fallbackLabel = `Pose ${index + 1}`;

        let display: React.ReactNode = null;
        if (representation === 'Matrix') {
          display = <MatrixDisplay matrix={poseToTransformationMatrix(pose)} />;
        } else if (representation === 'Quaternion') {
          display = <PositionQuaternionDisplay pose={pose} />;
        } else if (representation.startsWith('Euler')) {
          display = <EulerAngleDisplay pose={pose} representation={representation} />;
        }

        return (
          <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
            <PosePanelHeader
              poseName={pose.name}
              fallbackLabel={fallbackLabel}
              onRename={onRename ? (name) => onRename(index, name) : undefined}
              onRemove={onRemove ? () => onRemove(index) : undefined}
            />
            {display}
          </div>
        );
      })}

      {onAdd && (
        <button
          className="w-full border border-dashed border-gray-600 rounded-lg p-2 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
          onClick={onAdd}
        >
          + Add Pose
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check that child display components compile without the `label` prop**

The `label` prop was optional on all three child components, so removing it is safe. Verify:

```bash
cd /home/adam/code/frame_viz && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Quick visual check in dev server**

```bash
npm run dev
```

Open the app. The panels should still render correctly (matrix/quaternion/euler display unchanged). Names should appear in the header inputs. No ✕ buttons yet (callbacks not wired up).

---

### Task 3: Wire callbacks in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the three handlers to `App.tsx`**

After the existing `useState` declarations (around line 26), add:

```tsx
const handleAdd = () =>
  setPoses(prev => [...prev, {
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
  }]);

const handleRemove = (index: number) =>
  setPoses(prev => prev.filter((_, i) => i !== index));

// Destructuring removes the `name` key entirely when clearing, so the
// serialized JSON never contains `name: undefined` as an explicit property.
const handleRename = (index: number, name: string | undefined) =>
  setPoses(prev => prev.map((pose, i) => {
    if (i !== index) return pose;
    const { name: _removed, ...rest } = pose;
    return name !== undefined ? { ...rest, name } : rest;
  }));
```

- [ ] **Step 2: Pass callbacks to `PoseDisplay`**

Find the existing `<PoseDisplay poses={poses} representation={representation} />` line and update it:

```tsx
<PoseDisplay
  poses={poses}
  representation={representation}
  onAdd={handleAdd}
  onRemove={handleRemove}
  onRename={handleRename}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
cd /home/adam/code/frame_viz && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

With the dev server running, verify:
1. Each panel shows the pose name in the editable input (or the placeholder "Pose N" for unnamed poses)
2. Editing a name and pressing Enter or clicking away updates the name in the JSON editor
3. Clearing a name removes the `name` field from the JSON
4. The ✕ button removes the pose from both the panel list and the 3D view
5. Clicking "+ Add Pose" adds an unnamed identity pose at the end
6. Removing the last pose leaves an empty scene with only the "+ Add Pose" button

- [ ] **Step 5: Commit**

```bash
cd /home/adam/code/frame_viz
git add src/components/PoseDisplay/PosePanelHeader.tsx \
        src/components/PoseDisplay/index.tsx \
        src/App.tsx
git commit -m "feat: add/remove/rename poses from representation panels"
```
