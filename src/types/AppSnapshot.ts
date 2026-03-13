import { Poses } from './Pose';
import { PinnedExpression } from './PinnedExpression';

export interface AppSnapshot {
  poses: Poses;
  pinnedExpressions?: PinnedExpression[];  // defaults to [] when absent; optional for backward compat
  // Future: cameraTarget, panels, simulationConfig, etc.
}
