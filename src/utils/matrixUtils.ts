import { Pose, Matrix } from '../types/Pose';

export function quaternionToRotationMatrix(q: { x: number; y: number; z: number; w: number }): Matrix {
  const { x, y, z, w } = q;
  
  return [
    [1 - 2*y*y - 2*z*z, 2*x*y - 2*w*z, 2*x*z + 2*w*y],
    [2*x*y + 2*w*z, 1 - 2*x*x - 2*z*z, 2*y*z - 2*w*x],
    [2*x*z - 2*w*y, 2*y*z + 2*w*x, 1 - 2*x*x - 2*y*y]
  ];
}

export function poseToTransformationMatrix(pose: Pose): Matrix {
  const rotationMatrix = quaternionToRotationMatrix(pose.quaternion);
  const { x, y, z } = pose.position;
  
  return [
    [...rotationMatrix[0], x],
    [...rotationMatrix[1], y],
    [...rotationMatrix[2], z],
    [0, 0, 0, 1]
  ];
}