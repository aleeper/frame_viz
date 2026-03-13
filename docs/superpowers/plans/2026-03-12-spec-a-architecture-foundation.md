# Spec A: Architecture Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add required `id` and optional `parent_id` fields to the `Pose` type, install nanoid for ID generation, and create the `src/utils/transforms.ts` math module.

**Architecture:** The `Pose` type gains `id` (required, nanoid 8 chars) and `parent_id` (optional). `isValidPose` is tightened to reject poses missing `id`. A new pure-math module `transforms.ts` provides `identity`, `multiply`, `invert`, `posesToMap`, and `composePath` — no Three.js, fully unit-testable.

**Tech Stack:** TypeScript, nanoid, Vite/React (no new UI frameworks)

**Spec reference:** `docs/superpowers/specs/2026-03-12-frame-architecture-design.md` — Spec A section

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/types/Pose.ts` | Add `id`, `parent_id`; update `isValidPose` |
| Create | `src/utils/transforms.ts` | Pure coordinate-frame math module |
| Modify | `src/App.tsx` | Add `nanoid` import; give `defaultPoses` stable IDs; generate ID in `handleAdd` |
| Modify | `package.json` | Add `nanoid` dependency |

---

## Chunk 1: Install nanoid and update Pose type

### Task 1: Install nanoid

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install nanoid**

  ```bash
  npm install nanoid
  ```

  Expected: `nanoid` appears in `package.json` dependencies section.

- [ ] **Step 2: Verify the import works**

  ```bash
  node --input-type=module <<'EOF'
  import { nanoid } from 'nanoid';
  console.log(nanoid(8));
  EOF
  ```

  Expected: prints an 8-character alphanumeric string like `a1b2c3d4`.

- [ ] **Step 3: Commit**

  ```bash
  git add package.json package-lock.json
  git commit -m "chore: install nanoid for Pose ID generation"
  ```

---

### Task 2: Update Pose type and validator

**Files:**
- Modify: `src/types/Pose.ts`

- [ ] **Step 1: Replace the file contents**

  Replace the entire file with:

  ```ts
  export interface Pose {
    id: string;           // stable, auto-generated (nanoid 8 chars). Never changes after creation.
    name?: string;        // display only, user-editable
    parent_id?: string;   // references another Pose's id. Absent = root in global space.
    position: {
      x: number;
      y: number;
      z: number;
    };
    quaternion: {
      x: number;
      y: number;
      z: number;
      w: number;
    };
  }

  export type Poses = Pose[];

  export type Matrix = number[][];

  export function isValidPose(pose: any): pose is Pose {
    return (
      typeof pose === 'object' &&
      pose !== null &&
      typeof pose.id === 'string' &&
      typeof pose.position === 'object' &&
      pose.position !== null &&
      typeof pose.position.x === 'number' &&
      typeof pose.position.y === 'number' &&
      typeof pose.position.z === 'number' &&
      typeof pose.quaternion === 'object' &&
      pose.quaternion !== null &&
      typeof pose.quaternion.x === 'number' &&
      typeof pose.quaternion.y === 'number' &&
      typeof pose.quaternion.z === 'number' &&
      typeof pose.quaternion.w === 'number' &&
      (pose.name === undefined || typeof pose.name === 'string') &&
      (pose.parent_id === undefined || typeof pose.parent_id === 'string')
    );
  }
  ```

- [ ] **Step 2: Check for TypeScript errors**

  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: TypeScript errors pointing to `App.tsx` (defaultPoses missing `id` fields) and possibly `PoseVisualizer/index.tsx`. These are expected — they will be fixed in the next task. There should be NO errors in `Pose.ts` itself.

---

### Task 3: Update App.tsx — add IDs to defaultPoses and handleAdd

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add nanoid import at top of App.tsx**

  Add after the existing imports:

  ```ts
  import { nanoid } from 'nanoid';
  ```

- [ ] **Step 2: Update defaultPoses with stable IDs**

  Replace the `defaultPoses` constant with:

  ```ts
  const defaultPoses: Poses = [
    {
      id: 'pose1aaa',
      name: "Pose1",
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    },
    {
      id: 'pose2bbb',
      name: "Pose 2",
      position: { x: 2, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: -0.383, w: 0.924 }
    },
  ];
  ```

  Note: Hard-coded IDs here are intentional — they give stable references for tests and dev HMR resets. All other Pose creation uses `nanoid(8)`.

- [ ] **Step 3: Update handleAdd to generate an ID**

  Replace the `handleAdd` callback with:

  ```ts
  const handleAdd = useCallback(() =>
    set({ poses: [...poses, {
      id: nanoid(8),
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    }] }), [poses, set]);
  ```

- [ ] **Step 4: Check TypeScript errors**

  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: No errors in `App.tsx`. There may still be errors in `PoseVisualizer/index.tsx` if it spreads Pose objects — that code uses `...currentPoses[index]` which will include `id` automatically, so there should be no errors there either. All errors should be resolved.

- [ ] **Step 5: Smoke test the dev server**

  ```bash
  npm run dev
  ```

  Open the app, verify two poses display, drag works, undo/redo works, YAML panel round-trips correctly (IDs visible in YAML). Add a new pose and verify it appears with a random 8-char ID in the YAML view.

- [ ] **Step 6: Commit**

  ```bash
  git add src/types/Pose.ts src/App.tsx
  git commit -m "feat(spec-a): add id and parent_id fields to Pose type"
  ```

---

## Chunk 2: Create transforms.ts math module

### Task 4: Create src/utils/transforms.ts

**Files:**
- Create: `src/utils/transforms.ts`

- [ ] **Step 1: Create the file**

  Create `src/utils/transforms.ts` with the following content:

  ```ts
  import { quaternionToRotationMatrix } from './matrixUtils';
  import { Pose } from '../types/Pose';

  // Rotate vector v by unit quaternion q.
  // Uses the rotation matrix from matrixUtils (no Three.js).
  function rotateVec(
    q: { x: number; y: number; z: number; w: number },
    v: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    const R = quaternionToRotationMatrix(q);
    return {
      x: R[0][0] * v.x + R[0][1] * v.y + R[0][2] * v.z,
      y: R[1][0] * v.x + R[1][1] * v.y + R[1][2] * v.z,
      z: R[2][0] * v.x + R[2][1] * v.y + R[2][2] * v.z,
    };
  }

  /** Returns zero translation, unit quaternion. id field is empty string (math result, not a real frame). */
  export function identity(): Pose {
    return {
      id: '',
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    };
  }

  /**
   * multiply(a_T_b, b_T_c) → a_T_c
   *
   * Position: a_pos + rotate(a_quat, b_pos)
   * Quaternion: Hamilton product a_quat * b_quat
   *
   * The returned Pose has an empty id — callers assign identity as needed.
   */
  export function multiply(a_T_b: Pose, b_T_c: Pose): Pose {
    const rotated = rotateVec(a_T_b.quaternion, b_T_c.position);
    const position = {
      x: a_T_b.position.x + rotated.x,
      y: a_T_b.position.y + rotated.y,
      z: a_T_b.position.z + rotated.z,
    };
    // Hamilton product: p * q
    const p = a_T_b.quaternion;
    const q = b_T_c.quaternion;
    const quaternion = {
      w: p.w * q.w - p.x * q.x - p.y * q.y - p.z * q.z,
      x: p.w * q.x + p.x * q.w + p.y * q.z - p.z * q.y,
      y: p.w * q.y - p.x * q.z + p.y * q.w + p.z * q.x,
      z: p.w * q.z + p.x * q.y - p.y * q.x + p.z * q.w,
    };
    return { id: '', position, quaternion };
  }

  /**
   * invert(a_T_b) → b_T_a
   *
   * Quaternion: conjugate (negate x,y,z)
   * Position: -rotate(q_inv, a_pos)
   */
  export function invert(a_T_b: Pose): Pose {
    const q_inv = {
      x: -a_T_b.quaternion.x,
      y: -a_T_b.quaternion.y,
      z: -a_T_b.quaternion.z,
      w: a_T_b.quaternion.w,
    };
    const rotated = rotateVec(q_inv, a_T_b.position);
    return {
      id: '',
      position: { x: -rotated.x, y: -rotated.y, z: -rotated.z },
      quaternion: q_inv,
    };
  }

  /** Convert Pose[] to Map<id, Pose> for O(1) lookup. */
  export function posesToMap(frames: Pose[]): Map<string, Pose> {
    return new Map(frames.map(f => [f.id, f]));
  }

  /**
   * composePath(frameId, frameMap) → global_T_frame
   *
   * Walks the parent_id chain from frameId up to the root, then multiplies
   * transforms root→leaf to get the frame's world pose.
   *
   * Contract:
   * - Frame with no parent_id returns its own pose unchanged (already in global space).
   * - Dangling parent_id reference throws: Unknown parent_id "${id}" for frame "${frameId}"
   * - Cycle throws: Cycle detected in parent chain at frame "${id}"
   */
  export function composePath(frameId: string, frameMap: Map<string, Pose>): Pose {
    const startFrame = frameMap.get(frameId);
    if (!startFrame) {
      throw new Error(`Unknown frame "${frameId}"`);
    }

    // Fast path: root frame (no parent)
    if (!startFrame.parent_id) return startFrame;

    // Walk parent chain, collecting frames from leaf to root.
    const chain: Pose[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = frameId;

    while (currentId !== undefined) {
      if (visited.has(currentId)) {
        throw new Error(`Cycle detected in parent chain at frame "${currentId}"`);
      }
      visited.add(currentId);

      const current = frameMap.get(currentId);
      if (!current) {
        throw new Error(`Unknown parent_id "${currentId}" for frame "${frameId}"`);
      }
      chain.push(current);
      currentId = current.parent_id;
    }

    // chain = [frame, parent, grandparent, ..., root]
    // Multiply from root to leaf: global_T_root × root_T_parent × ... × parent_T_frame
    let result: Pose = chain[chain.length - 1]; // root (already in global space)
    for (let i = chain.length - 2; i >= 0; i--) {
      result = multiply(result, chain[i]);
    }
    return result;
  }
  ```

- [ ] **Step 2: Check TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: No errors.

- [ ] **Step 3: Quick sanity check via dev server**

  ```bash
  npm run dev
  ```

  Verify the app still loads correctly. No console errors. Drag and undo/redo still work (transforms.ts is not used by the runtime yet — that comes in Spec C).

- [ ] **Step 4: Commit**

  ```bash
  git add src/utils/transforms.ts
  git commit -m "feat(spec-a): add transforms.ts math module (identity, multiply, invert, composePath)"
  ```

---

## Summary

After completing Spec A:
- `Pose` type has `id: string` (required) and `parent_id?: string`
- `isValidPose` rejects poses missing `id`
- All Pose creation sites supply an ID (defaultPoses hardcoded, handleAdd uses nanoid)
- `src/utils/transforms.ts` provides the full coordinate-frame math module
- The app continues to work identically from the user's perspective (parenting is not yet exposed in the UI)

The next step is Spec B (unit tests), which will verify `transforms.ts`, `matrixUtils.ts`, `useUndoRedo.ts`, and the updated `isValidPose`.
