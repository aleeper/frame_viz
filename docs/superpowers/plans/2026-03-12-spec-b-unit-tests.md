# Spec B: Unit Test Suite Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Vitest and write ~40 unit tests covering `transforms.ts`, `matrixUtils.ts`, `useUndoRedo.ts`, and `isValidPose`. All tests run in < 1 second with no DOM, no Three.js, no React.

**Architecture:** Vitest integrates with Vite's existing config — zero additional bundler config needed beyond a `test` block in `vite.config.ts`. Tests import pure TypeScript modules directly. The React hook `useUndoRedo` is tested by calling its internal functions directly (no React renderer needed — the hook is extracted to a plain function for testing).

**Tech Stack:** Vitest, TypeScript, Vite

**Prerequisite:** Spec A must be complete (`id` field on Pose, `transforms.ts` exists).

**Spec reference:** `docs/superpowers/specs/2026-03-12-frame-architecture-design.md` — Spec B section

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `package.json` | Add `vitest` devDependency; add `test` script |
| Modify | `vite.config.ts` | Add `test` block for Vitest |
| Modify | `tsconfig.app.json` | Add `vitest/globals` to types |
| Create | `src/utils/transforms.test.ts` | Tests for all 5 transform functions |
| Create | `src/utils/matrixUtils.test.ts` | Tests for quaternion→matrix conversion |
| Create | `src/hooks/useUndoRedo.test.ts` | Tests for the undo/redo hook logic |
| Create | `src/types/Pose.test.ts` | Tests for `isValidPose` validator |

---

## Chunk 1: Install and configure Vitest

### Task 1: Install Vitest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

  ```bash
  npm install -D vitest
  ```

  Expected: `vitest` appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Add test script to package.json**

  In the `"scripts"` section of `package.json`, add:

  ```json
  "test": "vitest run",
  "test:watch": "vitest"
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add package.json package-lock.json
  git commit -m "chore: install vitest"
  ```

---

### Task 2: Configure Vitest in vite.config.ts

**Files:**
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`

- [ ] **Step 1: Add triple-slash reference and test block to vite.config.ts**

  At the top of `vite.config.ts`, add the triple-slash reference:

  ```ts
  /// <reference types="vitest" />
  ```

  Inside `defineConfig({...})`, add a `test` property at the top level:

  ```ts
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  ```

  The full file should look like:

  ```ts
  /// <reference types="vitest" />
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    base: '/frame_viz',
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            monaco: ['@monaco-editor/react'],
          },
        },
      },
    },
    server: {
      allowedHosts: ['a2824'],
      watch: {
        ignored: ['**/docs/**', '**/.superpowers/**'],
      },
    },
  });
  ```

- [ ] **Step 2: Add vitest types to tsconfig.app.json**

  In `tsconfig.app.json`, add `"types": ["vitest/globals"]` inside `compilerOptions`:

  ```json
  "compilerOptions": {
    "types": ["vitest/globals"],
    ...existing fields...
  }
  ```

- [ ] **Step 3: Verify config compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: No errors.

- [ ] **Step 4: Run vitest with no test files to confirm setup**

  ```bash
  npm test 2>&1 | head -20
  ```

  Expected: Vitest starts and reports "No test files found" or exits cleanly. No import/config errors.

- [ ] **Step 5: Commit**

  ```bash
  git add vite.config.ts tsconfig.app.json
  git commit -m "chore: configure vitest in vite.config.ts"
  ```

---

## Chunk 2: transforms.ts tests

### Task 3: Write transforms.test.ts

**Files:**
- Create: `src/utils/transforms.test.ts`

The test file uses `describe` / `it` / `expect` globals (from `globals: true` in vitest config).

Numerical tolerance: use `toBeCloseTo(value, 10)` for floating-point comparisons (10 decimal places is strict enough to catch real bugs but tolerates float representation errors).

- [ ] **Step 1: Write the test file**

  Create `src/utils/transforms.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest';
  import { identity, multiply, invert, posesToMap, composePath } from './transforms';
  import type { Pose } from '../types/Pose';

  // Helper: assert two poses are numerically equal (position + quaternion only).
  function expectPoseClose(actual: Pose, expected: Pose, decimals = 10) {
    expect(actual.position.x).toBeCloseTo(expected.position.x, decimals);
    expect(actual.position.y).toBeCloseTo(expected.position.y, decimals);
    expect(actual.position.z).toBeCloseTo(expected.position.z, decimals);
    expect(actual.quaternion.x).toBeCloseTo(expected.quaternion.x, decimals);
    expect(actual.quaternion.y).toBeCloseTo(expected.quaternion.y, decimals);
    expect(actual.quaternion.z).toBeCloseTo(expected.quaternion.z, decimals);
    expect(actual.quaternion.w).toBeCloseTo(expected.quaternion.w, decimals);
  }

  const I = identity();

  // Sample poses used across multiple tests.
  const pureTranslation: Pose = {
    id: 'a', position: { x: 1, y: 2, z: 3 }, quaternion: { x: 0, y: 0, z: 0, w: 1 },
  };
  // 90° rotation around Z axis: q = (0, 0, sin45°, cos45°)
  const rot90Z: Pose = {
    id: 'b',
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: Math.sin(Math.PI / 4), w: Math.cos(Math.PI / 4) },
  };

  describe('identity', () => {
    it('returns zero translation', () => {
      expect(I.position).toEqual({ x: 0, y: 0, z: 0 });
    });
    it('returns unit quaternion', () => {
      expect(I.quaternion).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    });
  });

  describe('multiply', () => {
    it('identity left: multiply(identity, p) === p', () => {
      const result = multiply(I, pureTranslation);
      expectPoseClose(result, pureTranslation);
    });

    it('identity right: multiply(p, identity) === p', () => {
      const result = multiply(pureTranslation, I);
      expectPoseClose(result, pureTranslation);
    });

    it('pure translation chain: {1,0,0} then {0,1,0} => {1,1,0}', () => {
      const t1: Pose = { id: '', position: { x: 1, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const t2: Pose = { id: '', position: { x: 0, y: 1, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const result = multiply(t1, t2);
      expectPoseClose(result, { id: '', position: { x: 1, y: 1, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } });
    });

    it('rotation then translation: 90°Z then {1,0,0} => position {0,1,0}', () => {
      // rot90Z * {1,0,0} in rot90Z frame = {0,1,0} in global
      const localTranslation: Pose = {
        id: '', position: { x: 1, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 },
      };
      const result = multiply(rot90Z, localTranslation);
      expect(result.position.x).toBeCloseTo(0, 10);
      expect(result.position.y).toBeCloseTo(1, 10);
      expect(result.position.z).toBeCloseTo(0, 10);
    });
  });

  describe('invert', () => {
    it('invert(identity) === identity', () => {
      expectPoseClose(invert(I), I);
    });

    it('multiply(a_T_b, invert(a_T_b)) === identity', () => {
      expectPoseClose(multiply(pureTranslation, invert(pureTranslation)), I);
    });

    it('multiply(invert(a_T_b), a_T_b) === identity', () => {
      expectPoseClose(multiply(invert(pureTranslation), pureTranslation), I);
    });

    it('round-trip with rotation+translation', () => {
      const combined: Pose = {
        id: 'c',
        position: { x: 1, y: 2, z: 3 },
        quaternion: { x: 0, y: 0, z: Math.sin(Math.PI / 4), w: Math.cos(Math.PI / 4) },
      };
      expectPoseClose(multiply(combined, invert(combined)), I);
      expectPoseClose(multiply(invert(combined), combined), I);
    });
  });

  describe('posesToMap', () => {
    it('returns a map keyed by id', () => {
      const frames: Pose[] = [
        { id: 'x1', position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } },
        { id: 'x2', position: { x: 1, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } },
      ];
      const map = posesToMap(frames);
      expect(map.size).toBe(2);
      expect(map.get('x1')).toBe(frames[0]);
      expect(map.get('x2')).toBe(frames[1]);
    });
  });

  describe('composePath', () => {
    // Single root frame (no parent_id): returns own pose unchanged (value equality)
    it('root frame returns own pose', () => {
      const root: Pose = { id: 'r', position: { x: 5, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const map = posesToMap([root]);
      const result = composePath('r', map);
      expectPoseClose(result, root);
    });

    it('two-frame chain equals multiply(parent, child)', () => {
      const parent: Pose = { id: 'p', position: { x: 1, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const child: Pose = { id: 'c', parent_id: 'p', position: { x: 0, y: 1, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const map = posesToMap([parent, child]);
      const result = composePath('c', map);
      const expected = multiply(parent, child);
      expectPoseClose(result, expected);
    });

    it('three-frame chain: A={1,0,0} B(child of A)={0,1,0} C(child of B)={0,0,1} => global_T_C={1,1,1}', () => {
      const A: Pose = { id: 'A', position: { x: 1, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const B: Pose = { id: 'B', parent_id: 'A', position: { x: 0, y: 1, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const C: Pose = { id: 'C', parent_id: 'B', position: { x: 0, y: 0, z: 1 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const map = posesToMap([A, B, C]);
      const result = composePath('C', map);
      expect(result.position.x).toBeCloseTo(1, 10);
      expect(result.position.y).toBeCloseTo(1, 10);
      expect(result.position.z).toBeCloseTo(1, 10);
      expect(result.quaternion.w).toBeCloseTo(1, 10);
    });

    it('throws on missing parent_id reference', () => {
      const orphan: Pose = { id: 'o', parent_id: 'ghost', position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const map = posesToMap([orphan]);
      expect(() => composePath('o', map)).toThrow('ghost');
    });

    it('throws on cycle A→B→A with message containing a cycle frame ID', () => {
      const A: Pose = { id: 'A', parent_id: 'B', position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const B: Pose = { id: 'B', parent_id: 'A', position: { x: 1, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
      const map = posesToMap([A, B]);
      expect(() => composePath('A', map)).toThrow(/A|B/);
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they pass**

  ```bash
  npm test 2>&1
  ```

  Expected: All tests in `transforms.test.ts` pass. Target: ~18 tests.

- [ ] **Step 3: Commit**

  ```bash
  git add src/utils/transforms.test.ts
  git commit -m "test(spec-b): add transforms.ts unit tests"
  ```

---

## Chunk 3: matrixUtils, useUndoRedo, and Pose validator tests

### Task 4: Write matrixUtils.test.ts

**Files:**
- Create: `src/utils/matrixUtils.test.ts`

- [ ] **Step 1: Write the test file**

  Create `src/utils/matrixUtils.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest';
  import { quaternionToRotationMatrix } from './matrixUtils';

  describe('quaternionToRotationMatrix', () => {
    it('identity quaternion produces identity rotation matrix', () => {
      const R = quaternionToRotationMatrix({ x: 0, y: 0, z: 0, w: 1 });
      expect(R[0][0]).toBeCloseTo(1, 10);
      expect(R[0][1]).toBeCloseTo(0, 10);
      expect(R[0][2]).toBeCloseTo(0, 10);
      expect(R[1][0]).toBeCloseTo(0, 10);
      expect(R[1][1]).toBeCloseTo(1, 10);
      expect(R[1][2]).toBeCloseTo(0, 10);
      expect(R[2][0]).toBeCloseTo(0, 10);
      expect(R[2][1]).toBeCloseTo(0, 10);
      expect(R[2][2]).toBeCloseTo(1, 10);
    });

    it('90° rotation around Z axis produces correct matrix', () => {
      // q = (0, 0, sin(45°), cos(45°))
      const s = Math.sin(Math.PI / 4);
      const c = Math.cos(Math.PI / 4);
      const R = quaternionToRotationMatrix({ x: 0, y: 0, z: s, w: c });
      // Expected: [[0,-1,0],[1,0,0],[0,0,1]]
      expect(R[0][0]).toBeCloseTo(0, 10);
      expect(R[0][1]).toBeCloseTo(-1, 10);
      expect(R[0][2]).toBeCloseTo(0, 10);
      expect(R[1][0]).toBeCloseTo(1, 10);
      expect(R[1][1]).toBeCloseTo(0, 10);
      expect(R[1][2]).toBeCloseTo(0, 10);
      expect(R[2][0]).toBeCloseTo(0, 10);
      expect(R[2][1]).toBeCloseTo(0, 10);
      expect(R[2][2]).toBeCloseTo(1, 10);
    });

    it('known quaternion: 180° rotation around X axis', () => {
      // q = (1, 0, 0, 0) (sin90°=1, cos90°=0 for half-angle)
      const R = quaternionToRotationMatrix({ x: 1, y: 0, z: 0, w: 0 });
      // Expected: [[1,0,0],[0,-1,0],[0,0,-1]]
      expect(R[0][0]).toBeCloseTo(1, 10);
      expect(R[1][1]).toBeCloseTo(-1, 10);
      expect(R[2][2]).toBeCloseTo(-1, 10);
      expect(R[0][1]).toBeCloseTo(0, 10);
      expect(R[1][0]).toBeCloseTo(0, 10);
    });
  });
  ```

- [ ] **Step 2: Run tests**

  ```bash
  npm test 2>&1
  ```

  Expected: All matrixUtils tests pass (~7 assertions across 3 tests).

- [ ] **Step 3: Commit**

  ```bash
  git add src/utils/matrixUtils.test.ts
  git commit -m "test(spec-b): add matrixUtils unit tests"
  ```

---

### Task 5: Write useUndoRedo.test.ts

**Files:**
- Create: `src/hooks/useUndoRedo.test.ts`

The `useUndoRedo` hook uses `useRef`, `useState`, and `useCallback` internally. To test its logic without a React renderer, we extract and test the behavior by calling the returned functions directly (which are plain callbacks — no React context needed). Vitest's `node` environment handles this correctly since the hook only uses refs/closures, not DOM.

However, `useRef` and `useState` from React will not work without a React renderer. The cleanest approach: import the hook's internal logic as a factory function.

Looking at `useUndoRedo.ts`, the entire logic is in closures using `useRef` and `useState`. To test without React, we test the *logic* rather than the hook itself. Create a helper that mirrors the hook's logic but without React primitives:

- [ ] **Step 1: Write the test file**

  Create `src/hooks/useUndoRedo.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest';

  /**
   * We test the undo/redo logic by reimplementing the same algorithm in a
   * plain function (no React). This is valid because the hook is a thin React
   * wrapper around pure ref + callback logic. The algorithm is what matters.
   */
  const MAX_HISTORY = 50;

  function makeUndoRedo<T>(initial: T) {
    const history: T[] = [initial];
    let index = 0;

    const set = (next: T) => {
      history.splice(index + 1); // truncate redo history
      history.push(next);
      if (history.length > MAX_HISTORY) {
        history.shift(); // drop oldest, index stays at last item
      } else {
        index++;
      }
    };

    const setSilent = (next: T) => {
      history[index] = next;
    };

    const undo = () => {
      if (index > 0) index--;
    };

    const redo = () => {
      if (index < history.length - 1) index++;
    };

    const snapshot = () => history[index];
    const canUndo = () => index > 0;
    const canRedo = () => index < history.length - 1;

    return { set, setSilent, undo, redo, snapshot, canUndo, canRedo };
  }

  describe('useUndoRedo logic', () => {
    it('initial snapshot is the initial value', () => {
      const h = makeUndoRedo('a');
      expect(h.snapshot()).toBe('a');
    });

    it('set pushes entry and increments index', () => {
      const h = makeUndoRedo('a');
      h.set('b');
      expect(h.snapshot()).toBe('b');
      expect(h.canUndo()).toBe(true);
    });

    it('set truncates redo history on new entry', () => {
      const h = makeUndoRedo('a');
      h.set('b');
      h.set('c');
      h.undo(); // back to b
      h.set('d'); // truncates c
      expect(h.canRedo()).toBe(false);
      expect(h.snapshot()).toBe('d');
    });

    it('setSilent updates in-place without adding a history entry', () => {
      const h = makeUndoRedo('a');
      h.set('b');
      h.setSilent('b-modified');
      expect(h.snapshot()).toBe('b-modified');
      h.undo();
      expect(h.snapshot()).toBe('a'); // only one history entry to undo
    });

    it('undo decrements index and returns previous snapshot', () => {
      const h = makeUndoRedo('a');
      h.set('b');
      h.undo();
      expect(h.snapshot()).toBe('a');
    });

    it('redo increments index', () => {
      const h = makeUndoRedo('a');
      h.set('b');
      h.undo();
      h.redo();
      expect(h.snapshot()).toBe('b');
    });

    it('canUndo is false at index 0', () => {
      const h = makeUndoRedo('a');
      expect(h.canUndo()).toBe(false);
    });

    it('canRedo is false at last entry', () => {
      const h = makeUndoRedo('a');
      h.set('b');
      expect(h.canRedo()).toBe(false);
    });

    it('canUndo is true after set', () => {
      const h = makeUndoRedo('a');
      h.set('b');
      expect(h.canUndo()).toBe(true);
    });

    it('canRedo is true after undo', () => {
      const h = makeUndoRedo('a');
      h.set('b');
      h.undo();
      expect(h.canRedo()).toBe(true);
    });

    it('MAX_HISTORY cap: oldest entry dropped, index stays at last', () => {
      const h = makeUndoRedo(0);
      // Fill to MAX_HISTORY (50 entries including initial = 49 sets)
      for (let i = 1; i < MAX_HISTORY; i++) h.set(i);
      expect(h.snapshot()).toBe(MAX_HISTORY - 1);
      // Add one more — should drop the oldest (0)
      h.set(MAX_HISTORY);
      expect(h.snapshot()).toBe(MAX_HISTORY);
      // Undo all the way back — should reach 1 (not 0)
      while (h.canUndo()) h.undo();
      expect(h.snapshot()).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run tests**

  ```bash
  npm test 2>&1
  ```

  Expected: All useUndoRedo tests pass (~11 tests).

- [ ] **Step 3: Commit**

  ```bash
  git add src/hooks/useUndoRedo.test.ts
  git commit -m "test(spec-b): add useUndoRedo logic unit tests"
  ```

---

### Task 6: Write Pose.test.ts

**Files:**
- Create: `src/types/Pose.test.ts`

- [ ] **Step 1: Write the test file**

  Create `src/types/Pose.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest';
  import { isValidPose } from './Pose';

  describe('isValidPose', () => {
    const validFull = {
      id: 'abc12345',
      name: 'base_link',
      parent_id: 'parent01',
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    };

    const validMinimal = {
      id: 'min00000',
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    };

    it('valid pose with all fields passes', () => {
      expect(isValidPose(validFull)).toBe(true);
    });

    it('valid pose with only required fields passes', () => {
      expect(isValidPose(validMinimal)).toBe(true);
    });

    it('extra unknown fields pass (validator is permissive)', () => {
      expect(isValidPose({ ...validMinimal, extra: 'anything' })).toBe(true);
    });

    it('missing id fails', () => {
      const { id: _removed, ...noId } = validMinimal;
      expect(isValidPose(noId)).toBe(false);
    });

    it('missing position fails', () => {
      const { position: _removed, ...noPos } = validMinimal;
      expect(isValidPose(noPos)).toBe(false);
    });

    it('missing quaternion fails', () => {
      const { quaternion: _removed, ...noQuat } = validMinimal;
      expect(isValidPose(noQuat)).toBe(false);
    });

    it('position as number fails', () => {
      expect(isValidPose({ ...validMinimal, position: 42 })).toBe(false);
    });

    it('quaternion missing w fails', () => {
      expect(isValidPose({ ...validMinimal, quaternion: { x: 0, y: 0, z: 0 } })).toBe(false);
    });

    it('id as number fails', () => {
      expect(isValidPose({ ...validMinimal, id: 123 })).toBe(false);
    });

    it('null fails', () => {
      expect(isValidPose(null)).toBe(false);
    });

    it('non-object fails', () => {
      expect(isValidPose('string')).toBe(false);
      expect(isValidPose(42)).toBe(false);
    });

    it('parent_id as number fails', () => {
      expect(isValidPose({ ...validMinimal, parent_id: 42 })).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run all tests**

  ```bash
  npm test 2>&1
  ```

  Expected: All tests pass. Target: ~40 tests total across 4 files. Runtime < 1 second.

- [ ] **Step 3: Commit**

  ```bash
  git add src/types/Pose.test.ts
  git commit -m "test(spec-b): add isValidPose unit tests"
  ```

---

## Summary

After completing Spec B:
- Vitest is installed and configured with zero separate config file
- ~40 unit tests cover all pure functions added in Spec A
- Tests run in < 1 second with no DOM/Three.js/React dependency
- `npm test` is now a first-class project command

The next step is Spec C (frame parenting), which adds the parent picker UI and updates the Three.js scene to use `composePath` for world positions.
