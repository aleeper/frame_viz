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
