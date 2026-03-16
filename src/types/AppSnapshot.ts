import { Poses } from './Pose';
import { PinnedExpression } from './PinnedExpression';
import { ViewState } from './ViewState';

export interface AppSnapshot {
  version?: number;  // schema version; currently always 1 when set
  poses: Poses;
  pinnedExpressions?: PinnedExpression[];  // defaults to [] when absent; optional for backward compat
  view?: ViewState;  // optional for backward compat; defaults computed from poses at runtime
  // Future: views: ViewState[] for multi-view
}
