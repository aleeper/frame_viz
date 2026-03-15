/**
 * Per-view display settings. Each 3D view has its own ViewState.
 * Currently there is one view; future: views: ViewState[] in AppSnapshot.
 */
export interface ViewState {
  observer_frame_id: string;  // the frame nailed to the renderer origin; all others shown relative to it
}
