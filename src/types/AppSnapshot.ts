import { Poses } from './Pose';

export interface AppSnapshot {
  poses: Poses;
  // Future: cameraTarget, panels, simulationConfig, parentage, etc.
}
