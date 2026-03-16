import { useEffect, useRef, useCallback, useState } from 'react';
import { Scene } from './Scene';
import type { CameraState } from './Scene';
import { createFrame } from './utils';
import { Pose, Poses } from '../../types/Pose';
import { UpDirection } from '../../types/Representation';
import { InteractionState } from './types/InteractionState';
import { composePath, posesToMap, multiply, invert, identity } from '../../utils/transforms';
import { isConnectedToObserver } from '../../utils/treeUtils';

interface PoseVisualizerProps {
  poses: Poses;
  upDirection: UpDirection;
  showWorldAxes?: boolean;
  showParentLines?: boolean;
  frameScale?: number;
  observerFrameId?: string;
  selectedFrameId?: string | null;
  onChange?: (newPoses: Poses) => void;
  onChangeCommit?: (newPoses: Poses) => void;
  onSelectFrame?: (id: string) => void;
  onDeselect?: () => void;
}

type FrameTransform = {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
};

/**
 * Pure function: given the current Three.js frame positions and authoritative poses,
 * returns updated poses reflecting the user's drag — or null if nothing changed.
 *
 * Handles two drag cases:
 *   - Normal (non-ancestor) frame: update its own stored transform.
 *   - Ancestor of observer: dragging it has no effect on its own global position
 *     (the observer rides along). Instead, update its direct child toward the observer
 *     so the ancestor *appears* at the dragged position from the observer's view.
 *     Formula: new_parent_T_child = invert(obs_T_ancestor_dragged) * obs_T_child
 */
function computeDraggedPoses(
  sceneFrames: FrameTransform[],
  draggedIndex: number,
  currentPoses: Poses,
  obsId: string,
  // Maps each ancestor ID → direct child ID toward the observer.
  ancestorChildMap: Map<string, string>
): Poses | null {
  if (draggedIndex < 0 || draggedIndex >= sceneFrames.length) return null;

  const frameMap = posesToMap(currentPoses);
  const global_T_observer = obsId
    ? (() => { try { return composePath(obsId, frameMap); } catch { return identity(); } })()
    : identity();

  const connectedPoses = currentPoses.filter(pose =>
    !obsId || isConnectedToObserver(pose.id, obsId, currentPoses)
  );

  const draggedPose = connectedPoses[draggedIndex];
  const tf = sceneFrames[draggedIndex];
  if (!draggedPose || !tf) return null;

  const obs_T_dragged: Pose = {
    id: '',
    position: { x: tf.position.x, y: tf.position.y, z: tf.position.z },
    quaternion: { x: tf.quaternion.x, y: tf.quaternion.y, z: tf.quaternion.z, w: tf.quaternion.w },
  };

  const updatedById = new Map<string, Pose>();

  if (ancestorChildMap.has(draggedPose.id)) {
    // Ancestor drag: update the child-toward-observer's local transform so the
    // ancestor appears at the dragged position. The ancestor's own data is unchanged.
    const childId = ancestorChildMap.get(draggedPose.id)!;
    const childPose = currentPoses.find(p => p.id === childId);
    if (!childPose) return null;
    const global_T_child = composePath(childId, frameMap);
    const obs_T_child = multiply(invert(global_T_observer), global_T_child);
    const new_parent_T_child = multiply(invert(obs_T_dragged), obs_T_child);
    updatedById.set(childId, { ...childPose, position: new_parent_T_child.position, quaternion: new_parent_T_child.quaternion });
  } else {
    // Normal drag: update the frame's own stored transform.
    const global_T_dragged = multiply(global_T_observer, obs_T_dragged);
    if (draggedPose.parent_id) {
      const global_T_parent = composePath(draggedPose.parent_id, frameMap);
      const parent_T_dragged = multiply(invert(global_T_parent), global_T_dragged);
      updatedById.set(draggedPose.id, { ...draggedPose, position: parent_T_dragged.position, quaternion: parent_T_dragged.quaternion });
    } else {
      updatedById.set(draggedPose.id, { ...draggedPose, position: global_T_dragged.position, quaternion: global_T_dragged.quaternion });
    }
  }

  const newPoses = currentPoses.map(p => updatedById.get(p.id) ?? p);
  if (JSON.stringify(newPoses) === JSON.stringify(currentPoses)) return null;
  return newPoses;
}

/** Compute which frame indices should NOT have gizmos.
 * Observer is always excluded. If selectedId is null, all frames are excluded.
 * If selectedId is set, all frames except the selected one are excluded.
 */
function computeNoGizmo(connectedPoses: { id: string }[], obsIdx: number, selectedId: string | null): Set<number> {
  const noGizmo = new Set<number>();
  if (obsIdx !== -1) noGizmo.add(obsIdx);
  if (selectedId !== null) {
    const selIdx = connectedPoses.findIndex(p => p.id === selectedId);
    connectedPoses.forEach((_, i) => { if (i !== selIdx) noGizmo.add(i); });
  } else {
    connectedPoses.forEach((_, i) => noGizmo.add(i));
  }
  return noGizmo;
}

export function PoseVisualizer({ poses, upDirection, showWorldAxes = true, showParentLines = true, frameScale = 1, observerFrameId, selectedFrameId, onChange, onChangeCommit, onSelectFrame, onDeselect }: PoseVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene>();
  const posesRef = useRef<Poses>(poses);
  posesRef.current = poses;
  const observerFrameIdRef = useRef<string>(observerFrameId ?? '');
  observerFrameIdRef.current = observerFrameId ?? '';
  // Tracks the observer ID from the last frames rebuild — NOT updated every render.
  // Used to detect observer changes that need a scene rebuild even when poses are unchanged.
  const prevObserverIdRef = useRef<string>(observerFrameId ?? '');
  // Maps each ancestor frame ID → its direct child ID toward the observer.
  // Updated in the frames effect alongside the scene rebuild.
  const ancestorChildMapRef = useRef<Map<string, string>>(new Map());
  const [prevPoses, setPrevPoses] = useState([]);
  const [interactionState, setInteractionState] = useState<InteractionState>("Off");
  // Incremented each time the scene is recreated (e.g. after up-direction animation).
  // Adding it to the frames effect deps ensures frames are rebuilt on the new scene.
  const [sceneKey, setSceneKey] = useState(0);
  // Saved camera state to restore position/orientation after scene recreation.
  const cameraStateRef = useRef<CameraState | null>(null);
  // Snapshot of poses captured at drag start. All drag computations use this
  // fixed baseline so they are anchored to mousedown — matching how
  // TransformControls itself uses _quaternionStart / _positionStart.
  // Reset to null by onDragCommit so the next drag captures a fresh snapshot.
  const dragStartPosesRef = useRef<Poses | null>(null);
  const frameScaleRef = useRef(frameScale);
  frameScaleRef.current = frameScale;
  const selectedFrameIdRef = useRef(selectedFrameId ?? null);
  selectedFrameIdRef.current = selectedFrameId ?? null;
  const onSelectFrameRef = useRef(onSelectFrame);
  onSelectFrameRef.current = onSelectFrame;
  const onDeselectRef = useRef(onDeselect);
  onDeselectRef.current = onDeselect;
  const interactionStateRef = useRef<InteractionState>('Off');
  interactionStateRef.current = interactionState;
  // Stable connected-poses snapshot for use in the selection effect.
  const connectedPosesRef = useRef<Pose[]>([]);
  const obsIdxRef = useRef(-1);

  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        setPrevPoses([]); // Reset prevPoses to ensure reinitialization.
      });
    }
  }, []);

  // Callback for pose updates from the Three.js window.
  // Uses posesRef/ancestorChildMapRef so it can be stable (not recreated each render).
  const handleTransformChange = useCallback(() => {
    if (!sceneRef.current || !onChange) return;
    const scene = sceneRef.current;

    // change event fires on hover (axis highlight change), not just actual drags.
    const draggedIndex = scene.getDraggedFrameIndex();
    if (draggedIndex === -1) return;

    // Capture a snapshot of poses at the start of each drag gesture.
    // All computations during this drag use this fixed baseline, preventing
    // any accumulated-state drift across multiple change events.
    if (dragStartPosesRef.current === null) {
      dragStartPosesRef.current = posesRef.current;
    }
    const basePoses = dragStartPosesRef.current;

    const newPoses = computeDraggedPoses(
      scene.frames,
      draggedIndex,
      basePoses,
      observerFrameIdRef.current,
      ancestorChildMapRef.current
    );
    if (!newPoses) return;

    // Live refresh: reposition all Three.js frames so children follow parents during drag.
    const newFrameMap = posesToMap(newPoses);
    const obsId = observerFrameIdRef.current;
    const global_T_obs_new = obsId
      ? (() => { try { return composePath(obsId, newFrameMap); } catch { return identity(); } })()
      : identity();

    const newConnectedPoses = newPoses.filter(pose =>
      !obsId || isConnectedToObserver(pose.id, obsId, newPoses)
    );
    scene.frames.forEach((threeFrame, index) => {
      // Never overwrite the dragged frame's position/quaternion mid-drag.
      // Three.js already placed it correctly, and overwriting it would move the
      // drag plane (TransformControlsPlane repositions to worldPosition every frame),
      // corrupting subsequent planeIntersect calculations in pointerMove.
      if (index === draggedIndex) return;
      const pose = newConnectedPoses[index];
      if (!pose) return;
      const global_T_f = composePath(pose.id, newFrameMap);
      const obs_T_f = multiply(invert(global_T_obs_new), global_T_f);
      threeFrame.position.set(obs_T_f.position.x, obs_T_f.position.y, obs_T_f.position.z);
      threeFrame.quaternion.set(obs_T_f.quaternion.x, obs_T_f.quaternion.y, obs_T_f.quaternion.z, obs_T_f.quaternion.w);
    });

    setPrevPoses(newPoses);
    onChange(newPoses);
  }, [onChange]);

  // Create (or recreate) the scene. Triggered on mount and after each
  // up-direction animation via sceneKey. Uses saved camera state when available.
  useEffect(() => {
    if (!containerRef.current) return;
    const state = cameraStateRef.current;
    cameraStateRef.current = null;
    const scene = new Scene(containerRef.current, upDirection, state ?? undefined);
    sceneRef.current = scene;
    scene.onInteractionStateChange = (s) => setInteractionState(s);
    scene.onDeselect = () => onDeselectRef.current?.();
    scene.onUpAnimComplete = () => {
      cameraStateRef.current = scene.getCameraState();
      setSceneKey(k => k + 1);
      setPrevPoses([]);
    };

    const handleResize = () => {
      if (!containerRef.current) return;
      scene.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  useEffect(() => {
    if (!sceneRef.current) return;
    if (poses === prevPoses && observerFrameId === prevObserverIdRef.current) return;
    if (JSON.stringify(poses) === JSON.stringify(prevPoses) && observerFrameId === prevObserverIdRef.current) return;

    const scene = sceneRef.current;
    scene.clearFrames();
    const frameMap = posesToMap(poses);
    const obsId = observerFrameId ?? '';

    // Compute observer's global pose once
    const global_T_observer = obsId
      ? (() => { try { return composePath(obsId, frameMap); } catch { return identity(); } })()
      : identity();

    const connectedPoses = poses.filter(pose =>
      !obsId || isConnectedToObserver(pose.id, obsId, poses)
    );

    connectedPoses.forEach((pose) => {
      const global_T_frame = composePath(pose.id, frameMap);
      const observer_T_frame = multiply(invert(global_T_observer), global_T_frame);
      const worldPose = { ...pose, position: observer_T_frame.position, quaternion: observer_T_frame.quaternion };
      const isObserver = pose.id === obsId;
      const frame = createFrame(worldPose, upDirection);
      frame.scale.setScalar(frameScaleRef.current);
      // Observer has no gizmo (noGizmoIndices below), so () => {} is just explicit safety.
      scene.addFrame(frame, isObserver ? () => {} : handleTransformChange);
    });

    // Build ancestor→child map: walking parent_id upward from observer, at each step
    // the previous node is the "child toward observer" for the current ancestor.
    // Also note which connectedPoses index is the observer for gizmo suppression.
    const ancestorChildMap = new Map<string, string>();
    let walkId: string | undefined = obsId || undefined;
    let childWalkId: string | undefined = undefined;
    while (walkId) {
      if (childWalkId !== undefined) ancestorChildMap.set(walkId, childWalkId);
      childWalkId = walkId;
      walkId = poses.find(p => p.id === walkId)?.parent_id;
    }
    ancestorChildMapRef.current = ancestorChildMap;

    const obsIdx = connectedPoses.findIndex(p => p.id === obsId);
    connectedPosesRef.current = connectedPoses;
    obsIdxRef.current = obsIdx;
    scene.setNoGizmoIndices(computeNoGizmo(connectedPoses, obsIdx, selectedFrameIdRef.current));
    // Grid follows the tree root (the frame with no parent) so it stays at the
    // "ground" reference regardless of which frame is the observer.
    const rootIdx = connectedPoses.findIndex(p => !p.parent_id);
    scene.setGridTargetFrame(rootIdx !== -1 ? rootIdx : null);
    scene.onFrameSelect = (index) => {
      const pose = connectedPosesRef.current[index];
      if (pose) onSelectFrameRef.current?.(pose.id);
    };

    // Add semi-transparent lines from each parent to its children.
    connectedPoses.forEach((pose, childIndex) => {
      if (!pose.parent_id) return;
      const parentIndex = connectedPoses.findIndex(p => p.id === pose.parent_id);
      if (parentIndex !== -1) scene.addParentLine(childIndex, parentIndex);
    });
    setPrevPoses(poses);
    prevObserverIdRef.current = observerFrameId ?? '';
    scene.setInteractionState(interactionState);
    scene.onDragCommit = () => {
      // Use the drag-start snapshot for the commit computation, then clear it
      // so the next drag gesture captures a fresh snapshot.
      const commitBase = dragStartPosesRef.current ?? posesRef.current;
      dragStartPosesRef.current = null;
      if (!onChangeCommit) return;
      const newPoses = computeDraggedPoses(
        scene.frames,
        scene.getDraggedFrameIndex(),
        commitBase,
        observerFrameIdRef.current,
        ancestorChildMapRef.current
      );
      if (newPoses) onChangeCommit(newPoses);
    };
  }, [poses, handleTransformChange, onChangeCommit, sceneKey, observerFrameId]);

  useEffect(() => {
    let isKeyDown = false;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKeyDown) return;
      if (!sceneRef.current) return;
      const scene = sceneRef.current;
      if (event.key === 'Escape') {
        onDeselectRef.current?.();
        return;
      }
      setInteractionState((prevState) => {
        let newInteractionState: InteractionState = prevState;
        switch (event.key.toLowerCase()) {
          case 'w':
            newInteractionState = "Translate";
            break;
          case 'e':
            newInteractionState = "Rotate";
            break;
        }
        if (newInteractionState !== prevState) {
          scene.setInteractionState(newInteractionState);
        }
        return newInteractionState;
      });
    };
    const handleKeyUp = (_event: KeyboardEvent) => {
      isKeyDown = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setUpDirection(upDirection);
  }, [upDirection]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setWorldAxesVisible(showWorldAxes);
  }, [showWorldAxes]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setParentLinesVisible(showParentLines);
  }, [showParentLines]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setFrameScale(frameScale);
  }, [frameScale]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const noGizmo = computeNoGizmo(connectedPosesRef.current, obsIdxRef.current, selectedFrameId ?? null);
    scene.setNoGizmoIndices(noGizmo);
    if (selectedFrameId != null) {
      // Always show gizmo when a frame is selected.
      // If mode is currently Off (e.g. after Escape then list-click), switch to last active mode.
      if (interactionStateRef.current === 'Off') {
        scene.activateLastMode();
      } else {
        scene.setInteractionState(interactionStateRef.current);
      }
    } else {
      scene.setInteractionState('Off');
    }
  }, [selectedFrameId]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-80 px-3 py-1.5 rounded-lg">
        {selectedFrameId != null ? (
          <p className="text-xs text-gray-300">
            <span className={interactionState === 'Translate' ? 'text-white font-semibold' : ''}>W: Translate</span>
            {' · '}
            <span className={interactionState === 'Rotate' ? 'text-white font-semibold' : ''}>E: Rotate</span>
            {' · S: local/world · Esc: deselect'}
          </p>
        ) : (
          <p className="text-xs text-gray-500">Click a frame to select</p>
        )}
      </div>
    </div>
  );
}
