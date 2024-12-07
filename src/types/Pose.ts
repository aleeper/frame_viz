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