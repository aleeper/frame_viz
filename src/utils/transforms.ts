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
