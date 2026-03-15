import type { Poses } from '../types/Pose';

/**
 * Returns the id of the tree root for the given frame.
 * Walks the parent_id chain until no parent exists or the parent is not in the list (dangling).
 * Cycle-safe: stops if a visited id is encountered.
 */
export function getTreeRoot(frameId: string, frames: Poses): string {
  const idSet = new Set(frames.map(f => f.id));
  const frameMap = new Map(frames.map(f => [f.id, f]));

  let current = frameId;
  const visited = new Set<string>();

  while (true) {
    if (visited.has(current)) break; // cycle guard
    visited.add(current);
    const frame = frameMap.get(current);
    if (!frame) break;
    const parentId = frame.parent_id;
    if (!parentId || !idSet.has(parentId)) break; // no parent or dangling
    current = parentId;
  }
  return current;
}

/**
 * Returns true if frameId shares a tree root with observerFrameId.
 * Frames in different trees are disconnected and cannot be positioned relative to the observer.
 */
export function isConnectedToObserver(
  frameId: string,
  observerFrameId: string,
  frames: Poses,
): boolean {
  return getTreeRoot(frameId, frames) === getTreeRoot(observerFrameId, frames);
}
