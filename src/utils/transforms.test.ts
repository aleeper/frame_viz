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

const SIN45 = Math.SQRT2 / 2;

function makePose(
  position: { x: number; y: number; z: number },
  quaternion: { x: number; y: number; z: number; w: number },
  id = '',
): Pose {
  return { id, position, quaternion };
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
    const localTranslation: Pose = {
      id: '', position: { x: 1, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 },
    };
    const result = multiply(rot90Z, localTranslation);
    // quaternion should be unchanged from the left-side rotation
    expectPoseClose(result, makePose({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: SIN45, w: SIN45 }));
  });

  it('rotation composition: 90°Z * 90°Z => 180°Z rotation', () => {
    const result = multiply(rot90Z, rot90Z);
    // 180° around Z: q = (0, 0, 1, 0); position stays at origin
    expectPoseClose(result, makePose({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1, w: 0 }));
  });
});

describe('invert', () => {
  it('invert of pure rotation flips sign of quaternion xyz', () => {
    const rot90Z = makePose({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: SIN45, w: SIN45 });
    const inv = invert(rot90Z);
    // conjugate: negate x,y,z; w unchanged; position stays zero
    expectPoseClose(inv, makePose({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -SIN45, w: SIN45 }));
  });

  it('invert of pure translation {3,0,0} => {-3,0,0}', () => {
    const t: Pose = { id: '', position: { x: 3, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } };
    expectPoseClose(invert(t), { id: '', position: { x: -3, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } });
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
    expectPoseClose(result, makePose({ x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0, w: 1 }));
  });

  it('throws on unknown frameId', () => {
    const map = posesToMap([]);
    expect(() => composePath('nonexistent', map)).toThrow('nonexistent');
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
