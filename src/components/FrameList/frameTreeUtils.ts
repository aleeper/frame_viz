import { Pose, Poses } from '../../types/Pose';

export const PANEL_MAX_INDENT_DEPTH = 2;

/** One row in the flat display list produced by buildDisplayList. */
export interface FrameListEntry {
  pose: Pose;
  depth: number;
}

/**
 * Converts a flat Poses array into a depth-first display order with depth info.
 * Frames with no parent_id are roots (depth 0). Children are ordered by their
 * position in the original array within each parent group.
 *
 * Frames whose parent_id points to a frame not in the list are treated as roots
 * (dangling references, e.g. after a parent was deleted).
 */
export function buildDisplayList(frames: Poses): FrameListEntry[] {
  const idSet = new Set(frames.map(f => f.id));
  // Build parent → children[] map. Dangling parent_id treated as undefined.
  const childMap = new Map<string | undefined, Pose[]>();

  for (const pose of frames) {
    const parentKey = pose.parent_id && idSet.has(pose.parent_id)
      ? pose.parent_id
      : undefined;
    if (!childMap.has(parentKey)) childMap.set(parentKey, []);
    childMap.get(parentKey)!.push(pose);
  }

  const result: FrameListEntry[] = [];

  function visit(parentId: string | undefined, depth: number) {
    const children = childMap.get(parentId) ?? [];
    for (const child of children) {
      result.push({ pose: child, depth });
      visit(child.id, depth + 1);
    }
  }

  visit(undefined, 0);
  return result;
}

/**
 * Returns the frames that are valid parent candidates for the given frameId.
 * Excludes:
 *   - The frame itself (self-parent)
 *   - Any descendant of the frame (would create a cycle)
 */
export function getValidParents(frameId: string, frames: Poses): Poses {
  // Build a set of all descendant IDs of frameId using DFS.
  const childMap = new Map<string, Pose[]>();
  for (const pose of frames) {
    if (!pose.parent_id) continue;
    if (!childMap.has(pose.parent_id)) childMap.set(pose.parent_id, []);
    childMap.get(pose.parent_id)!.push(pose);
  }

  const descendants = new Set<string>();
  function collectDescendants(id: string) {
    for (const child of childMap.get(id) ?? []) {
      descendants.add(child.id);
      collectDescendants(child.id);
    }
  }
  collectDescendants(frameId);

  return frames.filter(f => f.id !== frameId && !descendants.has(f.id));
}
