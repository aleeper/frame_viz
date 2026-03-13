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
