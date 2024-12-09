export interface Pose {
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
  name?: string;
}

export type Poses = Pose[];

export type Matrix = number[][];

export function isValidPose(pose: any): pose is Pose {
  return (
    typeof pose === 'object' &&
    pose !== null &&
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
    (pose.name === undefined || typeof pose.name === 'string')
  );
}