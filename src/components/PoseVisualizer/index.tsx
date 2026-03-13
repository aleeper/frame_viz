import { useEffect, useRef, useCallback, useState } from 'react';
import { Scene } from './Scene';
import { createFrame } from './utils';
import { Pose, Poses } from '../../types/Pose';
import { UpDirection } from '../../types/Representation';
import { InteractionState } from './types/InteractionState';
import { composePath, posesToMap, multiply, invert } from '../../utils/transforms';

interface PoseVisualizerProps {
  poses: Poses;
  upDirection: UpDirection;
  showWorldAxes?: boolean;
  showParentLines?: boolean;
  onChange?: (newPoses: Poses) => void;
  onChangeCommit?: (newPoses: Poses) => void;
}

export function PoseVisualizer({ poses, upDirection, showWorldAxes = true, showParentLines = true, onChange, onChangeCommit }: PoseVisualizerProps) {
  // console.log("PoseVisualize constructor!");
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene>();
  const posesRef = useRef<Poses>(poses);
  posesRef.current = poses;
  const [prevPoses, setPrevPoses] = useState([]);
  const [interactionState, setInteractionState] = useState<InteractionState>("Off");
  // Incremented each time the scene is recreated (e.g. upDirection change).
  // Adding it to the frames effect deps ensures frames are rebuilt on the new scene.
  const [sceneVersion, setSceneVersion] = useState(0);
  // const [upDirection, setUpDirection] = useState("Y");

  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        setPrevPoses([]); // Reset prevPoses to ensure reinitialization.
      });
    }
  }, []);

  // Callback for pose updates from the Three.js window.
  // Uses posesRef so it can be stable (not recreated each render).
  const handleTransformChange = useCallback(() => {
    if (!sceneRef.current || !onChange) return;

    const scene = sceneRef.current;
    const currentPoses = posesRef.current;
    const frameMap = posesToMap(currentPoses);
    const draggedIndex = scene.getDraggedFrameIndex();

    const newPoses = scene.frames.map((frame, index) => {
      const pose = currentPoses[index];

      // Non-dragged children: local position is unchanged — only their parent moved.
      // Recomputing here would use stale parent world coords from posesRef (not yet
      // re-rendered), corrupting the local offset on every intermediate pointermove.
      if (pose.parent_id && index !== draggedIndex) {
        return pose;
      }

      const worldPos = { x: frame.position.x, y: frame.position.y, z: frame.position.z };
      const worldQuat = { x: frame.quaternion.x, y: frame.quaternion.y, z: frame.quaternion.z, w: frame.quaternion.w };

      if (pose.parent_id) {
        // Convert world transform → parent-relative.
        const global_T_parent = composePath(pose.parent_id, frameMap);
        const world_T_frame = { ...pose, position: worldPos, quaternion: worldQuat };
        const parent_T_frame = multiply(invert(global_T_parent), world_T_frame);
        return { ...pose, position: parent_T_frame.position, quaternion: parent_T_frame.quaternion };
      } else {
        return { ...pose, position: worldPos, quaternion: worldQuat };
      }
    });

    if (JSON.stringify(newPoses) !== JSON.stringify(currentPoses)) {
      // Update world positions of all frames so children follow their parents live.
      const newFrameMap = posesToMap(newPoses);
      scene.frames.forEach((threeFrame, index) => {
        const pose = newPoses[index];
        const global_T_frame = composePath(pose.id, newFrameMap);
        threeFrame.position.set(
          global_T_frame.position.x,
          global_T_frame.position.y,
          global_T_frame.position.z,
        );
        threeFrame.quaternion.set(
          global_T_frame.quaternion.x,
          global_T_frame.quaternion.y,
          global_T_frame.quaternion.z,
          global_T_frame.quaternion.w,
        );
      });
      setPrevPoses(newPoses);
      onChange(newPoses);
    }
  }, [onChange]);

  // Setup resize handler for Three.js window.
  useEffect(() => {
    if (!containerRef.current) return;
    setPrevPoses([]);
    setSceneVersion(v => v + 1);
    const scene = new Scene(containerRef.current, upDirection);
    sceneRef.current = scene;
    scene.onInteractionStateChange = (state) => setInteractionState(state);

    const handleResize = () => {
      if (!containerRef.current) return;
      scene.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
    };
  }, [upDirection]);

  useEffect(() => {
    // console.log("X");
    if (!sceneRef.current) return;
    if (poses === prevPoses) return;
    if (JSON.stringify(poses) === JSON.stringify(prevPoses)) return;

    const scene = sceneRef.current;
    scene.clearFrames();
    const frameMap = posesToMap(poses);
    poses.forEach((pose) => {
      // Compute world pose — scene is flat, all groups live at the scene root.
      const global_T_frame = composePath(pose.id, frameMap);
      const worldPose = { ...pose, position: global_T_frame.position, quaternion: global_T_frame.quaternion };
      const frame = createFrame(worldPose, upDirection);
      scene.addFrame(frame, handleTransformChange);
    });
    // Add semi-transparent lines from each parent to its children.
    poses.forEach((pose, childIndex) => {
      if (!pose.parent_id) return;
      const parentIndex = poses.findIndex(p => p.id === pose.parent_id);
      if (parentIndex !== -1) scene.addParentLine(childIndex, parentIndex);
    });
    setPrevPoses(poses);
    // console.log("Setting interactionState: " + interactionState);
    scene.setInteractionState(interactionState);
    scene.onDragCommit = () => {
      if (!onChangeCommit) return;
      const currentPoses = posesRef.current;
      const frameMap = posesToMap(currentPoses);
      // At commit time activeDragControl is still set (cleared after this callback).
      const draggedIndex = scene.getDraggedFrameIndex();

      const newPoses = scene.frames.map((frame, index) => {
        const pose = currentPoses[index];

        if (pose.parent_id && index !== draggedIndex) {
          return pose;
        }

        const worldPos = { x: frame.position.x, y: frame.position.y, z: frame.position.z };
        const worldQuat = { x: frame.quaternion.x, y: frame.quaternion.y, z: frame.quaternion.z, w: frame.quaternion.w };

        if (pose.parent_id) {
          const global_T_parent = composePath(pose.parent_id, frameMap);
          const world_T_frame = { ...pose, position: worldPos, quaternion: worldQuat };
          const parent_T_frame = multiply(invert(global_T_parent), world_T_frame);
          return { ...pose, position: parent_T_frame.position, quaternion: parent_T_frame.quaternion };
        } else {
          return { ...pose, position: worldPos, quaternion: worldQuat };
        }
      });

      onChangeCommit(newPoses);
    };
  }, [poses, handleTransformChange, onChangeCommit, sceneVersion]);

  useEffect(() => {
    let isKeyDown = false;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKeyDown) return;
      // console.log("PoseVisualizer.keydown");
      if (!sceneRef.current) return;
      const scene = sceneRef.current;
      console.log("Event: " + event.key);
      setInteractionState((prevState) => {
        let newInteractionState: InteractionState = prevState;
        switch (event.key.toLowerCase()) {
          case 'q':
            newInteractionState = "Off";
            break;
          case 'w':
            newInteractionState = "Translate";
            break;
          case 'e':
            newInteractionState = "Rotate";
            break;
        }
        // console.log("interactionState: " + prevState + ", newInteractionState: " + newInteractionState);
        if (newInteractionState !== prevState) {
          scene.setInteractionState(newInteractionState);
        }
        return newInteractionState;
      });
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      isKeyDown = false;
    };
    console.log("Adding keydown listener.");
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyDown);
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


  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-80 p-2 rounded-lg">
        <p className="text-sm text-white">
          Q: Controls Off | W: Translate | E: Rotate | S: local vs global
        </p>
        {/* <p className="text-sm text-white">
          +/-: Adjust Control Size | Click and drag to orbit | Scroll to zoom
        </p> */}
      </div>
    </div>
  );
}