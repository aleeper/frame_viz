import { describe, it, expect } from 'vitest';
import { getTreeRoot, isConnectedToObserver } from './treeUtils';
import type { Pose } from '../types/Pose';

const p = (id: string, parent_id?: string): Pose => ({
  id, parent_id,
  position: { x: 0, y: 0, z: 0 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
});

describe('getTreeRoot', () => {
  it('returns self when no parent', () => {
    expect(getTreeRoot('a', [p('a')])).toBe('a');
  });

  it('walks up to the root', () => {
    const frames = [p('a'), p('b', 'a'), p('c', 'b')];
    expect(getTreeRoot('c', frames)).toBe('a');
    expect(getTreeRoot('b', frames)).toBe('a');
    expect(getTreeRoot('a', frames)).toBe('a');
  });

  it('treats dangling parent_id as root', () => {
    const frames = [p('b', 'missing')];
    expect(getTreeRoot('b', frames)).toBe('b');
  });

  it('returns frameId itself when not found in frames', () => {
    expect(getTreeRoot('unknown', [p('a')])).toBe('unknown');
  });
});

describe('isConnectedToObserver', () => {
  it('returns true when same tree', () => {
    const frames = [p('world'), p('a', 'world'), p('b', 'a')];
    expect(isConnectedToObserver('b', 'world', frames)).toBe(true);
    expect(isConnectedToObserver('a', 'world', frames)).toBe(true);
    expect(isConnectedToObserver('world', 'world', frames)).toBe(true);
  });

  it('returns false when different tree', () => {
    const frames = [p('world'), p('a', 'world'), p('isolated')];
    expect(isConnectedToObserver('isolated', 'world', frames)).toBe(false);
  });

  it('observer frame itself is always connected', () => {
    const frames = [p('world'), p('orphan')];
    expect(isConnectedToObserver('world', 'world', frames)).toBe(true);
  });
});
