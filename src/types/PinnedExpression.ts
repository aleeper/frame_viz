/**
 * A pinned expression is a derived quantity computed from two frames that the
 * user wants to continuously observe.
 *
 * The `kind` field is extensible: 'rotation' | 'position' and future kinematic
 * types (velocity, etc.) may be added without breaking existing entries.
 */
export interface PinnedExpression {
  id: string;               // nanoid(8), stable
  base_frame_id: string;    // the "a" in a_T_b notation
  target_frame_id: string;  // the "b" in a_T_b notation
  kind: 'transform';        // extensible; only 'transform' supported in UI today
}
